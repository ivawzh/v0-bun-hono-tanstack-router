# Data Design

## Overview
The Solo Unicorn schema centers on missions, workstations, and transparent automation. Mission Fallback replaces loop missions: instead of looping tasks, the system generates new missions from templates when the backlog is low. Those templates appear in the Todo column “Fallback” area so users can launch work instantly while the template remains available. Hybrid storage keeps rich mission docs on the filesystem with DB pointers for cross-session continuity.

## Data Relations Diagram
```mermaid
erDiagram
  ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERSHIPS : includes
  ORGANIZATIONS ||--o{ PROJECTS : owns
  ORGANIZATIONS ||--o{ WORKSTATIONS : owns
  ORGANIZATIONS ||--o{ NOTIFICATION_PREFERENCES : configures

  USERS ||--o{ ORGANIZATION_MEMBERSHIPS : joins
  USERS ||--o{ PROJECT_MEMBERS : collaborates
  USERS ||--o{ PROJECT_STARS : stars
  USERS ||--o{ ACCESS_REQUESTS : submits
  USERS ||--o{ NOTIFICATIONS : receives

  PROJECTS ||--o{ PROJECT_MEMBERS : assigns
  PROJECTS ||--o{ PROJECT_REPOSITORIES : links
  PROJECTS ||--o{ FLOWS : defines
  PROJECTS ||--o{ ACTORS : defines
  PROJECTS ||--o{ MISSIONS : contains
  PROJECTS ||--o{ MISSION_FALLBACK_CONFIGS : configures
  PROJECTS ||--o{ MISSION_FALLBACK_TEMPLATES : stores
  PROJECTS ||--o{ MISSION_FALLBACK_RUNS : records
  PROJECTS ||--o{ PROJECT_ACTIVITY : logs

  WORKSTATIONS ||--o{ PROJECT_WORKSTATIONS : maps
  WORKSTATIONS ||--o{ WORKSTATION_SESSIONS : tracks
  WORKSTATIONS ||--o{ WORKSTATION_REPOSITORIES : clones
  WORKSTATIONS ||--o{ WORKSTATION_WORKTREES : pools

  MISSIONS ||--o{ MISSION_DEPENDENCIES : depends
  MISSIONS ||--o{ MISSION_EVENTS : emits
  MISSIONS ||--o{ CODE_AGENT_SESSIONS : runs
  MISSIONS ||--o{ GITHUB_PULL_REQUESTS : opens
  GITHUB_PULL_REQUESTS ||--o{ GITHUB_PR_COMMENTS : includes
  MISSIONS ||--o{ NOTIFICATIONS : triggers
  MISSION_FALLBACK_RUNS ||--o{ MISSION_FALLBACK_ITEMS : proposes
  MISSION_FALLBACK_ITEMS }o--|| MISSIONS : may_create
```

## Conceptual Entities
- **ENT-ORG:** Organization owning projects and workstations.
- **ENT-USER:** Monster Auth identity, receives notifications.
- **ENT-MEM:** Organization membership with role.
- **ENT-PROJECT:** Collaboration container with defaults, privacy, metrics, mission fallback settings.
- **ENT-PROJECT-MEMBER:** Project-level permission overrides.
- **ENT-WORKSTATION / ENT-WORKSTATION-SESSION:** Machines + daemon sessions.
- **ENT-REPOSITORY / ENT-WORKTREE:** GitHub linkage and mission worktrees.
- **ENT-FLOW / ENT-ACTOR:** Workflow templates and personas.
- **ENT-MISSION:** Core task, always ends in Done (no loop list).
- **ENT-MISSION-EVENT:** Timeline events for transparency.
- **ENT-CODE-AGENT-SESSION:** Execution attempts metadata.
- **ENT-MISSION-FACTORY-CONFIG/TEMPLATE/RUN/ITEM:** Configuration, template definitions, run history, and individual mission proposals. Templates power the Todo Fallback area; items record each generated mission while leaving the template in place.
- **ENT-ACCESS-REQUEST / ENT-NOTIFICATION / ENT-AUDIT-EVENT:** Collaboration, alerts, compliance.

## Database Schema (key tables)
(Columns abbreviated; migrations capture full structure.)

```sql
-- Missions (list excludes "loop")
CREATE TABLE missions (
  id VARCHAR(26) PRIMARY KEY,
  project_id VARCHAR(26) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  clarification TEXT,
  priority INTEGER DEFAULT 3,
  list ENUM('todo','doing','review','done') DEFAULT 'todo',
  list_order DECIMAL(10,5) DEFAULT 1000,
  flow_id VARCHAR(26),
  stage VARCHAR(64) DEFAULT 'clarify',
  requires_review BOOLEAN DEFAULT false,
  actor_id VARCHAR(26),
  repository_id VARCHAR(26),
  target_branch VARCHAR(120) DEFAULT 'main',
  pr_mode ENUM('disabled','enabled','auto') DEFAULT 'auto',
  pr_branch_name VARCHAR(255),
  github_pr_number INTEGER,
  ready BOOLEAN DEFAULT false,
  origin ENUM('manual','fallback','imported') DEFAULT 'manual',
  fallback_item_id VARCHAR(26),
  agent_session_status ENUM('inactive','pushing','active') DEFAULT 'inactive',
  solution_path TEXT,
  tasks_path TEXT,
  review_status ENUM('pending','approved','rejected') DEFAULT NULL,
  review_feedback TEXT,
  dependency_count INTEGER DEFAULT 0,
  last_event_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Mission Fallback Configuration
CREATE TABLE mission_fallback_configs (
  id VARCHAR(26) PRIMARY KEY,
  project_id VARCHAR(26) NOT NULL UNIQUE,
  backlog_threshold INTEGER DEFAULT 5,
  check_cadence_minutes INTEGER DEFAULT 15,
  auto_accept BOOLEAN DEFAULT false,
  monthly_target_hours INTEGER DEFAULT 120,
  weekly_mission_cap INTEGER DEFAULT 20,
  status ENUM('active','paused','snoozed') DEFAULT 'active',
  last_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE mission_fallback_templates (
  id VARCHAR(26) PRIMARY KEY,
  project_id VARCHAR(26) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  flow_id VARCHAR(26) NOT NULL,
  actor_id VARCHAR(26) NOT NULL,
  repository_id VARCHAR(26) NOT NULL,
  priority INTEGER DEFAULT 3,
  estimated_effort_minutes INTEGER NOT NULL,
  acceptance_criteria TEXT,
  enabled BOOLEAN DEFAULT true,
  tags JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE mission_fallback_runs (
  id VARCHAR(26) PRIMARY KEY,
  project_id VARCHAR(26) NOT NULL,
  triggered_by ENUM('automatic','manual','api') NOT NULL,
  backlog_count_before INTEGER,
  backlog_threshold INTEGER,
  generated_count INTEGER DEFAULT 0,
  accepted_count INTEGER DEFAULT 0,
  discarded_count INTEGER DEFAULT 0,
  status ENUM('pending','awaiting_review','completed','cancelled','errored') DEFAULT 'awaiting_review',
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE mission_fallback_items (
  id VARCHAR(26) PRIMARY KEY,
  mission_fallback_run_id VARCHAR(26) NOT NULL,
  template_id VARCHAR(26) NOT NULL,
  project_id VARCHAR(26) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  flow_id VARCHAR(26) NOT NULL,
  actor_id VARCHAR(26) NOT NULL,
  repository_id VARCHAR(26) NOT NULL,
  priority INTEGER,
  estimated_effort_minutes INTEGER,
  status ENUM('proposed','accepted','discarded') DEFAULT 'proposed',
  mission_id VARCHAR(26),
  feedback TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Additional mission / fallback indexes
CREATE INDEX idx_missions_project_list_ready ON missions(project_id, list, ready);
CREATE INDEX idx_mission_fallback_runs_project ON mission_fallback_runs(project_id, started_at DESC);
CREATE INDEX idx_mission_fallback_items_run_status ON mission_fallback_items(mission_fallback_run_id, status);
```

Other core tables (organizations, users, workstations, repositories, mission events, notifications, audit events) remain as in previous revision but remove any `is_loop` or `loop_schedule` columns.

## Mission Events
Mission events capture all lifecycle updates including fallback signals.
```sql
ALTER TABLE mission_events ADD COLUMN origin ENUM('system','user','agent','fallback') DEFAULT 'system';
```
Fallback run completion inserts summary events with payload `{ "runId": "run_123", "generated": 3, "accepted": 2 }`.

## Hybrid Storage
- Mission docs: `solo-unicorn-docs/missions/{missionId}/solution.md`, `tasks/{n}.md`
- Fallback run reports (JSON) stored under `solo-unicorn-docs/fallback/{runId}.json` for audit
- Agent logs remain in `logs/{sessionId}.log` (gitignored)

## Derived Views & Metrics
- `mv_project_metrics_daily` includes columns `fallback_generated`, `fallback_accepted`, `fallback_discarded`, `avg_backlog_size`.
- `mv_fallback_health` summarizes backlog threshold adherence and guardrail usage.
- `mv_notification_counts` adds fallback segment counts.

## Retention & Compliance
- Fallback runs retained 180 days; aggregated stats remain in metrics view.
- Notifications older than 180 days archived.
- Access request messages anonymized 30 days post decision.
- Audit events WORM for 400 days.
- When user deleted, mission `reviewed_by` replaced with pseudonymous token; fallback feedback retains anonymized reviewer reference.

## Performance
- Mission queries: partial indexes on `(list='todo', ready=true)` for fast backlog checks.
- Fallback run listing uses covering index `(project_id, started_at DESC, status)` to keep UI responsive.
- Notification unread counts rely on partial index `WHERE read_at IS NULL`.
- All thresholds ensure mission backlog check stays <20ms.

## Migration Strategy
1. Introduce new fallback tables and add `origin`, `fallback_item_id` columns to missions.
2. Backfill existing missions with `origin='manual'`.
3. Drop `is_loop`, `loop_schedule`, and `list` enum values referencing loop (with fallback conversions to `todo`).
4. Update APIs/CLI to reference new structures.
5. Deploy mission fallback service with feature flag for progressive rollout.

## Data Quality
- Database constraints: `mission_fallback_items.mission_id` references missions; `missions.fallback_item_id` references items when accepted.
- Guardrail check ensures accepted mission count per week ≤ cap.
- Application enforces backlog threshold evaluation; DB triggers ensure Mission Fallback runs update counts on accept/discard.

## Monster Service Integrations
- Monster Realtime publishes fallback events on `project:{id}:fallback` channel, payload stored in `mission_fallback_runs`.
- Monster Auth metadata remains canonical identity source.

## Open Questions & Future Work
- Template marketplace across organizations (post-MVP).
- Machine learning scoring for template selection (future).
- Auto-accept policies per template once confidence high.
