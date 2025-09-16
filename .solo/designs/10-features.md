# Features Design

## Problems
- AI missions feel opaque and hard to monitor
- Workstation setup requires confusing manual steps
- Reviews stall missions without timely nudges
- Public collaborators lack clarity on permissions
- Mission backlog dries up when Todo empties, wasting AI capacity

## Overview

### Vision
Deliver a mission-first development companion where humans feel in control, AI agents stay transparent, and collaboration across web, CLI, and public surfaces feels consistent and friendly from day one.

### Product Goals
- Make mission progress legible with live context and actionable nudges
- Keep workstation setup under five minutes with guided guardrails
- Support flexible change management (YOLO or PR) without configuration fatigue
- Enable secure public discovery with clear permission messaging and low-friction access requests
- Maintain a healthy mission backlog using the Mission Fallback so AI capacity is always productive

## Features

### FEAT-001 - Authentication & Authorization
- **ID:** FEAT-001
- **Name:** Authentication & Authorization
- **Status:** Draft (MVP)

#### Intent
Authenticate through Monster Auth and authorize by org/project roles so every surface knows who the user is and what they can do.

#### Goals
- Support Google OAuth and password flows via Monster Auth
- Provide PAT/org keys for CLI and MCP usage
- Keep cookie-based /rpc sessions with CSRF protection
- Expose role-based context to UI and CLI responses

#### Non-Goals
- Support non-Monster Auth providers in MVP
- Manage passwords or MFA locally

#### Solution
Monster Auth handles identity; server issues HTTP-only cookies for web and scoped PAT/org keys for CLI/MCP. A context resolver injects org/project roles into every request, and UI surfaces assumed context clearly.

#### User Flow Links
- [UF-LAUNCH-001](./20-gui/web.md#uf-launch-001---organization-launchpad)

#### Transport Flow Links
- HTTP: GET /api/oauth/callback
- HTTP: POST /api/v1/auth/pat

#### Risks & Mitigations
- Token leak → PAT stored in OS keychain with scoped expiry and revoke endpoint

---

### FEAT-002 - Workstation Management
- **ID:** FEAT-002
- **Name:** Workstation Management
- **Status:** Draft (MVP)

#### Intent
Let humans register, monitor, and pause workstations quickly so agents run where expected.

#### Goals
- Guided workstation onboarding wizard with real-time status
- Daemon supervision with diagnostics and pause/resume controls
- Cross-platform auto-start helpers (launchd, systemd, Task Scheduler)
- Workstation health widgets on Launchpad + CLI parity

#### Non-Goals
- Remote desktop or shell access

#### Solution
Web wizard pairs with CLI register command; realtime updates drive checklist completion. Workstation console and CLI status share the same `/api/v1/workstations/*` endpoints.

#### User Flow Links
- [UF-WORKSTATION-ONBOARD-001](./20-gui/web.md#uf-workstation-onboard-001---workstation-onboarding)

#### Transport Flow Links
- HTTP: POST /api/v1/workstations
- HTTP: POST /api/v1/workstations/{id}/sessions
- WS: workstation:{id}

#### Risks & Mitigations
- Daemon crash → watchdog restarts plus `doctor` command bundling logs

---

### FEAT-003 - Code Agent Orchestration
- **ID:** FEAT-003
- **Name:** Code Agent Orchestration
- **Status:** Draft (MVP)

#### Intent
Discover local agents, track health, and respect concurrency so missions land on capable machines.

#### Goals
- CLI agent scan/add/check commands with friendly prompts
- Presence payload includes agent type, version, capacity
- Mission assignment considers agent load and repo compatibility

#### Non-Goals
- Persist agent configuration server-side

#### Solution
Agents remain in `code-agents.json`; workstation presence publishes metadata consumed by assignment service, Mission Room, and CLI status.

#### Transport Flow Links
- WS: workstation:{id} presence payload
- HTTP: PATCH /api/v1/workstations/{id}

---

### FEAT-004 - Repositories & Worktrees
- **ID:** FEAT-004
- **Name:** Repositories & Worktrees
- **Status:** Draft (MVP)

#### Intent
Keep git operations predictable with managed clones and worktree pools per mission.

#### Goals
- Repository linking via GitHub ID with validation
- Auto-create worktrees on mission accept; reuse when idle
- CLI clean-up with preview; server visibility of worktree state

#### Non-Goals
- Supporting non-git VCS in MVP

#### Solution
CLI manages clones/worktrees; server stores repo metadata and receives worktree telemetry for dashboards and conflicts prevention.

#### Transport Flow Links
- HTTP: POST /api/v1/projects/{projectId}/repositories
- HTTP: POST /api/v1/workstations/{id}/worktrees/sync

---

### FEAT-005 - Missions & Flows
- **ID:** FEAT-005
- **Name:** Missions & Flows
- **Status:** Draft (MVP)

#### Intent
Create missions with flow-first configuration, provide live mission rooms, and keep agents aligned with human intent.

#### Goals
- Flow templates with stage toggles and review flags
- Mission Room with live transcript, diff preview, and Ready guardrails
- Dependencies and priority management without "Loop" list (all missions complete in Done)

#### Non-Goals
- Dragging tasks between missions in MVP

#### Solution
Mission creation modal highlights flow preview and prerequisites. Mission Room unifies status, transcripts, flow editing, and PR view. Board lists remain Todo → Doing → Review → Done for simple mental model.

#### User Flow Links
- [UF-MISSION-CREATE-001](./20-gui/web.md#uf-mission-create-001---mission-creation)
- [UF-MISSION-EXECUTE-001](./20-gui/web.md#uf-mission-execute-001---mission-execution)

#### Transport Flow Links
- HTTP: POST /api/v1/projects/{projectId}/missions
- HTTP: PATCH /api/v1/missions/{id}
- Event: mission.updated

---

### FEAT-006 - Change Management (PR & YOLO)
- **ID:** FEAT-006
- **Name:** Change Management (PR/YOLO)
- **Status:** Draft (MVP)

#### Intent
Let teams choose YOLO or PR mode per mission with effortless review handling.

#### Goals
- Per-project default change policy with per-mission override
- Auto-branching, PR creation, and status syncing
- Inline diff preview even for YOLO missions

#### Non-Goals
- Hosting PR comments natively in MVP

#### Solution
When review required, mission entering Review triggers PR creation via GitHub. UI surfaces PR state, comments digest, and approval controls; YOLO missions get diff summary + confirm commit CTA.

#### User Flow Links
- [UF-MISSION-REVIEW-001](./20-gui/web.md#uf-mission-review-001---mission-review--iteration)

#### Transport Flow Links
- HTTP: POST /api/v1/missions/{id}/pull-request
- HTTP: POST /api/v1/missions/{id}/review
- Event: mission.review.requested

---

### FEAT-007 - Realtime Presence & Push
- **ID:** FEAT-007
- **Name:** Realtime Presence & Push
- **Status:** Draft (MVP)

#### Intent
Keep UI and CLI live with push-only updates while falling back gracefully when offline.

#### Goals
- Presence updates for workstations, missions, notifications
- Assignment events with idempotent payloads
- Offline fallback with 15s polling and stale markers

#### Solution
Monster Realtime handles push events; watchers degrade to HTTP polls when disconnected while surfacing offline badges in UI.

#### Transport Flow Links
- WS: workstation:{id}
- Event: mission.assign
- Event: notification.created

---

### FEAT-008 - Projects & Organizations
- **ID:** FEAT-008
- **Name:** Projects & Organizations
- **Status:** Draft (MVP)

#### Intent
Structure work by org and project with defaults for flows, actors, repositories, and team roles.

#### Goals
- Org Launchpad with health snapshot and quick actions
- Project workspace with board, mission room, workstations, library, PR center
- Project defaults for flow/actor/PR policy and workstation priority

#### Non-Goals
- Cross-org shared projects in MVP

#### Solution
Launchpad surfaces org summary, recents, and alerts. Projects expose tabbed workspace. Settings manage defaults and invites with guardrails.

#### User Flow Links
- [UF-LAUNCH-001](./20-gui/web.md#uf-launch-001---organization-launchpad)
- [UF-ACCESS-REQUEST-001](./20-gui/web.md#uf-access-request-001---access-request--approval)

#### Transport Flow Links
- HTTP: GET /api/v1/organizations/{id}
- HTTP: POST /api/v1/projects

---

### FEAT-009 - Configuration Management
- **ID:** FEAT-009
- **Name:** Configuration Management
- **Status:** Draft (MVP)

#### Intent
Keep configuration typed, discoverable, and safe across CLI and server.

#### Goals
- `apps/*/env.ts` typed access; no direct `process.env`
- CLI config editing with validation and backup
- Config diff hints when CLI/server versions mismatch

#### Solution
Config service validates schema on load, surfaces context in CLI and Mission Room. Version negotiation endpoint shares supported ranges.

#### Transport Flow Links
- HTTP: GET /api/v1/meta/features

---

### FEAT-010 - Flow Reviews
- **ID:** FEAT-010
- **Name:** Flow Reviews
- **Status:** Draft (MVP)

#### Intent
Deliver review queue with approve/reject workflows, shortcuts, and rationale capture.

#### Goals
- Review column with keyboard shortcuts
- Review history metadata with who/when/feedback
- Quick assign reviewer plus optional auto-assign policies

#### Solution
Mission Room review tab surfaces diffs, comment digest, and required checklist before approval.

#### User Flow Links
- [UF-MISSION-REVIEW-001](./20-gui/web.md#uf-mission-review-001---mission-review--iteration)

#### Transport Flow Links
- HTTP: POST /api/v1/missions/{id}/review
- Event: mission.review.decision

---

### FEAT-011 - Solution & Tasks Docs
- **ID:** FEAT-011
- **Name:** Solution & Tasks Docs
- **Status:** Draft (MVP)

#### Intent
Persist mission reasoning and task lists on filesystem with DB sync so humans and agents share context.

#### Goals
- `solution.md` + `tasks/{n}.md` stored per mission
- DB fields track progress, sync status, and last editor
- CLI and GUI open docs with correct path hints

#### Solution
FS watcher records updates, CLI surfaces path in mission show, Mission Room preview renders Markdown.

#### Transport Flow Links
- HTTP: POST /api/v1/missions/{id}/documents/sync

---

### FEAT-012 - Public Projects & ACL
- **ID:** FEAT-012
- **Name:** Public Projects & ACL
- **Status:** Draft (MVP)

#### Intent
Expose public projects safely, clarify what visitors can see, and respect workstation privacy.

#### Goals
- Permission-aware sections (missions, docs, repositories, workstations)
- Public slug + SEO-friendly metadata
- Workstation visibility levels (hidden, status only, full)

#### Solution
Public project detail uses access matrix to toggle sections. Access requests tie into notifications and approvals.

#### User Flow Links
- [UF-PUBLIC-001](./20-gui/web.md#uf-public-001---public-project-discovery)
- [UF-ACCESS-REQUEST-001](./20-gui/web.md#uf-access-request-001---access-request--approval)

#### Transport Flow Links
- HTTP: GET /api/v1/public/projects
- HTTP: GET /api/v1/public/projects/{slug}
- HTTP: POST /api/v1/public/projects/{slug}/access-requests

---

### FEAT-013 - Discovery & Community
- **ID:** FEAT-013
- **Name:** Discovery & Community
- **Status:** Draft (Beta)

#### Intent
Encourage exploration via gallery, categories, templates, stars, and highlight activity trends.

#### Goals
- Search, filters, categories, trending insights
- Template usage CTA with shareable link
- Activity feed summarizing stars, mission completions, contributors

#### Solution
Gallery page reads from discovery endpoints with caching; cards highlight permission state, achievements, and CTA buttons.

#### Transport Flow Links
- HTTP: GET /api/v1/public/projects/search
- HTTP: GET /api/v1/public/categories

---

### FEAT-014 - Public API & Security
- **ID:** FEAT-014
- **Name:** Public API & Security
- **Status:** Draft (MVP)

#### Intent
Provide stable versioned API for CLI, MCP, and third parties with guardrails and observability.

#### Goals
- `/api/v1` versioning with deprecation headers
- Rate limits by role (anon/auth/contributor)
- OpenAPI docs plus schema endpoint
- Structured error payloads with trace ids

#### Solution
Hono server exposes API format routes via oRPC; middleware handles auth, rate limits, logging, caching.

#### Transport Flow Links
- HTTP: GET /api/v1/public/system-schema
- HTTP: GET /api/v1/meta/status

---

### FEAT-015 - Dev Server & Public Tunneling
- **ID:** FEAT-015
- **Name:** Dev Server & Public Tunneling
- **Status:** Draft (MVP)

#### Intent
Let teams share local previews securely with minimal configuration.

#### Goals
- CLI dev-server start/stop/status commands
- Cloudflare Tunnel integration with TTL tokens
- UI surfaces public URL with expiration indicator

#### Solution
Daemon manages tunnel lifecycle; Mission Room surfaces preview link and revocation control.

#### Transport Flow Links
- HTTP: POST /api/v1/workstations/{id}/tunnels
- WS: workstation:{id} tunnel events

---

### FEAT-016 - Flow Templates & Prompts
- **ID:** FEAT-016
- **Name:** Flow Templates & Prompts
- **Status:** Draft (Beta)

#### Intent
Version flow templates and prompts to keep missions consistent while enabling customization.

#### Goals
- Versioned flow library (semantic versions)
- Prompt preview with quick edit and rollout plan
- Export/import templates for org sharing

#### Solution
Templates stored in DB with JSON schema; Mission creation references them, CLI can pull updates.

#### Transport Flow Links
- HTTP: GET /api/v1/projects/{projectId}/flows
- HTTP: POST /api/v1/projects/{projectId}/flows

---

### FEAT-017 - Unified Notifications
- **ID:** FEAT-017
- **Name:** Unified Notifications
- **Status:** Draft (Beta)

#### Intent
Consolidate mission, workstation, and community events across web and CLI with snooze controls.

#### Goals
- Real-time toasts + inbox with filters and quiet hours
- CLI notifications pull/watch commands
- Weekly digest email option

#### Solution
Notification service writes to DB, emits realtime event, and surfaces restful endpoints for inbox, read receipts, and preferences.

#### User Flow Links
- [UF-NOTIFY-001](./20-gui/web.md#uf-notify-001---notification-inbox)

#### Transport Flow Links
- HTTP: GET /api/v1/notifications
- HTTP: POST /api/v1/notifications/{id}/read
- Event: notification.created

---

### FEAT-018 - Global Search & Command
- **ID:** FEAT-018
- **Name:** Global Search & Command
- **Status:** Draft (Beta)

#### Intent
Give users a lightning-fast command palette to navigate and act without context switching.

#### Goals
- <200ms initial results with keyboard-first navigation
- Search across missions, projects, documentation, commands
- CLI parity via `mission`, `project`, `doc` open commands

#### Solution
Search service indexes DB tables and mission docs; command palette fetches suggestion bundles and executes actions via restful endpoints.

#### User Flow Links
- [UF-SEARCH-001](./20-gui/web.md#uf-search-001---global-search--command-palette)

#### Transport Flow Links
- HTTP: GET /api/v1/search?q=
- HTTP: POST /api/v1/commands/execute

---

### FEAT-019 - Observability & Auditing
- **ID:** FEAT-019
- **Name:** Observability & Auditing
- **Status:** Draft (Beta)

#### Intent
Surface mission health, workstation uptime, and audit trails that humans can trust.

#### Goals
- Launchpad and Project dashboards with SLA and uptime charts
- Mission timeline events stored with diff, actor, agent, reviewer
- Audit logs for sensitive actions with retention policy

#### Solution
Mission events table drives dashboards; analytics endpoints feed UI cards and CLI doctor command.

#### Transport Flow Links
- HTTP: GET /api/v1/projects/{projectId}/metrics
- HTTP: GET /api/v1/audit-events

---

### FEAT-020 - Access Requests & Approvals
- **ID:** FEAT-020
- **Name:** Access Requests & Approvals
- **Status:** Draft (MVP)

#### Intent
Allow visitors to request contributor roles and give maintainers a tidy approval workflow.

#### Goals
- Friendly request form with expectations and SLA estimate
- Maintainer approvals from inbox or CLI
- Timeline updates for requester with status changes

#### Solution
Public request form posts to access request service; maintainers act via notifications or CLI; mission timeline logs outcomes.

#### User Flow Links
- [UF-ACCESS-REQUEST-001](./20-gui/web.md#uf-access-request-001---access-request--approval)

#### Transport Flow Links
- HTTP: POST /api/v1/public/projects/{slug}/access-requests
- HTTP: POST /api/v1/access-requests/{id}/decision
- Event: access-request.updated

---

### FEAT-021 - Mission Fallback
- **ID:** FEAT-021
- **Name:** Mission Fallback
- **Status:** Draft (Beta)

#### Intent
Automatically generate ready-to-start missions when the Todo backlog is empty, and surface those templates inside the Todo "Fallback" area so agents stay productive without manual prep.

#### Goals
- Configurable triggers (Todo count, cadence, manual run)
- Template gallery defining intent, effort, flow, actor, repository
- Approval workflow to accept/discard generated missions
- Analytics on fallback output (accepted vs discarded, time saved)

#### Non-Goals
- Blindly auto-accepting missions without human opt-in (unless explicitly toggled)
- Generating missions without predefined templates in MVP

#### Solution
Mission Fallback service evaluates backlog thresholds and monthly budget. When conditions met, it creates mission proposals using templates and posts them to both the approval queue and the Todo Fallback area. Users can accept via web modal or CLI, or launch directly from the Fallback panel. Accepted missions land in Todo with `Fallback` badge while the template remains available for next time.

#### User Flow Links
- [Kanban Board Layout](./20-gui/web.md#kanban-board-layout)
- [Mission Modal (Popup)](./20-gui/web.md#mission-modal-popup)
- [Mission Creation Modal](./20-gui/web.md#mission-creation-modal)

#### Transport Flow Links
- HTTP: GET /api/v1/projects/{projectId}/mission-fallback/config
- HTTP: PATCH /api/v1/projects/{projectId}/mission-fallback/config
- HTTP: POST /api/v1/projects/{projectId}/mission-fallback/run
- Event: mission-fallback.generated

#### Risks & Mitigations
- Fallback templates spamming irrelevant missions → Template quality review + discard feedback loop
- Budget overspend → Guardrail fields (max missions/week, monthly hour targets) enforced server-side

---

## Design Notes
- Board columns now fixed to Todo, Doing, Review, Done. Loop missions removed; the Todo Fallback panel keeps reusable templates powered by Mission Fallback.
- Mission Fallback produces missions tagged with origin metadata for transparency and leaves templates visible in Fallback after execution.
- All mission creation surfaces are modals centered on screen (mobile sheets) for focus, matching the Mission Modal experience in the board design.
- Ready toggle component stays visually consistent on cards, modals, and mobile layouts.
- Notifications and CLI commands expose mission fallback activity for parity across interfaces.

## Acceptance Criteria
- Mission creation to mission completion remains traceable within Mission Room timeline without leaving the page.
- Workstation onboarding from CTA to healthy online state averages <5 minutes with checklist guidance.
- Mission Fallback keeps Todo backlog ≥ configured threshold 90% of active hours or surfaces actionable alerts when budget guardrails prevent generation; Fallback always offers templates when backlog is empty.
- Access requests receive response (auto or manual) within SLA surfaced to requester and maintainer.
- Notifications stay consistent across web and CLI, with unread counts matching and quiet hours respected.
- Global search results respond in <200ms median with zero dead links.
