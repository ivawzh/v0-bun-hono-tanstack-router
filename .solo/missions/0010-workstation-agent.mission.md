# Mission 0010 - Workstations, Agents & Repositories

## Mission Goal
Implement workstation onboarding, agent orchestration, and repository/worktree management across server, web, and CLI surfaces.

## Why This Matters
- FEAT-002, FEAT-003, and FEAT-004 describe how humans monitor workstations and assign missions to available agents.
- Reliable workstation data unlocks guardrails for mission assignment and future realtime presence.
- Repository/worktree automation prevents git conflicts and ensures missions land on clean worktrees.

## Current Context
- **Previous mission**: `0009-persistence-upgrade` established durable DB and job queue infrastructure.
- **Next mission**: `0011-realtime-notifications` will build realtime presence + notifications on top of workstation/agent data.

## Deliverables
- Server endpoints for workstation CRUD, session management, agent presence updates, repository linking, and worktree lifecycle.
- Background tasks to monitor workstation heartbeat and clean up stale worktrees.
- Web UI: onboarding wizard, workstation console, project workspace widget.
- CLI application (new workspace) supporting workstation register/status commands.

## Out of Scope
- Realtime push (Mission 0011 handles websockets).
- Deep analytics dashboards (Mission 0014).

## Dependencies
- Persistence layer with tables for workstations, agents, repositories, worktrees (created in Mission 0009).
- Domain schema definitions for Workstation, Agent, Repository, Worktree.

## Constraints & Guardrails
- Workstation registration flow must be idempotent; repeated register should update record not duplicate.
- Agent presence updates should be batched to avoid noisy writes (maybe job queue aggregator).
- CLI must run under Bun and reuse shared domain package.

## Kickoff Checklist
Create `kickoffs/0010-workstation-agent.kickoff.md` and follow the four steps with human confirmation before coding.

## Tasks
- [ ] Task 1: Server Workstation APIs
  - Description: Build ORPC/REST endpoints for workstation CRUD, session start/stop, heartbeat, diagnostics.
  - Acceptance Criteria: `/rpc/workstations.register`, `.update`, `.list`, `.pause`, `.resume`, `.reportStatus`. Heartbeat writes lastSeen + metrics; background job marks offline after threshold. REST endpoints for CLI parity.
  - Implementation Notes: Use repository layer; ensure auth gating (only same org). Add audit events for status changes.
  - File Targets: `apps/server/src/routers/rpc/workstations.ts`, `apps/server/src/routers/api/workstations.ts`, background jobs.
  - Validation: Tests verifying offline detection, permission gating.
  - Log:
- [ ] Task 2: Agent Orchestration Services
  - Description: Implement agent registration, capacity tracking, and mission assignment heuristics.
  - Acceptance Criteria: `apps/server/src/services/agents.ts` manages agent metadata; `/rpc/agents.register`, `.updateCapacity`, `.list`. Mission assignment service ensures available capacity, repository compatibility.
  - Implementation Notes: Use ts-pattern to match assignment rules. Store agent capabilities in DB (languages, runtime version).
  - File Targets: `apps/server/src/services/agents.ts`, router updates, DB migrations if extra columns needed.
  - Validation: Tests simulating assignment scenarios.
  - Log:
- [ ] Task 3: Repository & Worktree Management
  - Description: Manage repository links, worktree pool per mission, cleanup tasks.
  - Acceptance Criteria: Endpoints `repositories.link`, `worktrees.provision`, `worktrees.release`, `worktrees.status`. Background job cleans stale worktrees and logs to audit trail. Provide CLI command preview before cleanup.
  - Implementation Notes: Reuse git CLI via Bun spawn; ensure operations run in sandbox directory. Document local path conventions.
  - File Targets: `apps/server/src/services/repositories.ts`, `apps/server/src/jobs/worktreeCleanup.ts`, routers, CLI commands.
  - Validation: Integration tests using temporary git repos.
  - Log:
- [ ] Task 4: Web UI - Workstation Onboarding
  - Description: Create wizard guiding user through workstation setup per FEAT-002.
  - Acceptance Criteria: Route `/workstations/onboard` with steps (prereqs, install daemon, register, verify heartbeat). Real-time status updates via polling (upgrade to realtime later). Provide components for health widget on Launchpad + project workspace.
  - Implementation Notes: Use shadcn `Stepper`, `Alert`, `Badge`. Provide CTA to pause/resume agent.
  - File Targets: `apps/web/src/routes/workstations/*.tsx`, `apps/web/src/components/workstations/*`.
  - Validation: Manual QA: register new workstation from UI, see status update.
  - Log:
- [ ] Task 5: Web UI - Workstation Console & Agent List
  - Description: Build console showing each workstation with agents, logs, diagnostics.
  - Acceptance Criteria: `/workstations` route displays table/list, filter by status, actions (pause/resume). Include agent chips showing capacity.
  - Implementation Notes: Use shadcn `DataTable`. Integrate with new hooks `useWorkstationsQuery`, `useAgentListQuery`.
  - File Targets: `apps/web/src/routes/workstations/index.tsx`, `apps/web/src/components/workstations/WorkstationTable.tsx`.
  - Validation: Visual QA.
  - Log:
- [ ] Task 6: CLI Workspace
  - Description: Scaffold new CLI workspace providing register/status commands.
  - Acceptance Criteria: Create `apps/cli` with Bun entrypoint. Commands: `solo workstations register`, `solo workstations status`, `solo agents list`. CLI authenticates via PAT (generate stub). Document install instructions in README.
  - Implementation Notes: Use `commander` or similar. Share API client via `packages/domain-schema` + new `packages/api-client` if needed.
  - File Targets: `apps/cli/**`, root `package.json` workspace entry, docs.
  - Validation: Manual run of CLI commands against dev server.
  - Log:
- [ ] Task 7: Documentation
  - Description: Document workstation management flows.
  - Acceptance Criteria: `docs/product/workstations.md`, `docs/cli/workstations.md`, updates to `docs/architecture/persistence.md` detailing queue + heartbeat sweepers.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun test apps/server` for workstation/agent/repo services.
- CLI smoke tests: `bun run --filter solo-cli dev` (or equivalent) hitting register/status.
- Manual QA: Onboard new workstation, verify status in UI + CLI.

## Documentation Updates
- Mission log per task.
- Add TODO for realtime presence upgrade (Mission 0011) to `notes/realtime-followups.md`.

## Handoff Notes for Mission 0011
- Provide event contracts for presence updates and notifications to broadcast.
- Document CLI PAT issuance gap for Mission 0011/0015 to handle securely.
