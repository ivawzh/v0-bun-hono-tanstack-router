# Mission 0005 - Organizations & Project Workspace

## Mission Goal
Deliver the Launchpad and Project Workspace experiences so authenticated users can view org health, switch projects, and understand mission status at a glance.

## Why This Matters
- FEAT-008 defines the Launchpad + Project workspace as the center of gravity for the product.
- Many later missions (missions board, fallback, workstations) mount inside the workspace shell built here.
- Role-aware navigation must align with the permissions resolved in Mission 0004.

## Current Context
- **Previous mission**: `0004-auth-session` provides authenticated user + roles.
- **Next mission**: `0006-mission-board` will populate the workspace with the Kanban board and fallback templates.

## Deliverables
- Server-side queries returning org Launchpad summary, project metadata, and workspace defaults.
- Frontend Launchpad route with health snapshot, quick actions, and CTA surfaces matching `.solo/designs/20-gui/web.md`.
- Project workspace route scaffolding showing board placeholder, mission stats, workstation summary, and Ready toggle indicator.
- Role-aware UI (owners see admin controls, contributors see limited actions).

## Out of Scope
- Mission board cards (next mission) beyond placeholders.
- Workstation detail modals (Mission 0009).
- Editing project defaults (Mission 0011 handles config management).

## Dependencies
- ORPC mock endpoints from Mission 0002; extend as needed for Launchpad data.
- Session roles from Mission 0004.

## Constraints & Guardrails
- Keep network requests minimal: compose aggregated Launchpad summary server-side.
- Provide optimistic UI for quick actions (e.g. `+ Mission` button opens placeholder modal for now).
- Use shadcn UI primitives for cards, stats, tabs (install via CLI where missing).

## Kickoff Checklist
Create `kickoffs/0005-projects-org.kickoff.md` and complete steps sequentially with human sign-off.

## Tasks
- [ ] Task 1: Server Launchpad Aggregates
  - Description: Add ORPC/REST handlers to fetch Launchpad data in a single request.
  - Acceptance Criteria: `/rpc/organizations.getLaunchpad` returns org summary (mission counts per stage, workstation health, notifications preview). Extend mock store to generate metrics.
  - Implementation Notes: Compose data by aggregating missions/workstations/notifications from store; ensure role gating (contributors see subset of admin actions).
  - File Targets: `apps/server/src/routers/rpc/organizations.ts`, `apps/server/src/mocks/store.ts` (aggregations), tests.
  - Validation: Unit test verifying counts match underlying data; unauthorized user gets 403.
  - Log:
- [ ] Task 2: Project Workspace API
  - Description: Provide endpoints returning project-level dashboard data.
  - Acceptance Criteria: `/rpc/projects.getWorkspace` returns mission stage counts, fallback template references, active flows, connected repositories, workstation summary. `projects.list` includes slug + policy toggles.
  - Implementation Notes: Extend domain schema if new types needed (update Mission 0001 docs). Provide restful GET `/api/v1/projects/{id}/workspace` for CLI.
  - File Targets: `apps/server/src/routers/rpc/projects.ts`, `apps/server/src/routers/api/projects.ts`.
  - Validation: Contract tests ensure consistent response shapes.
  - Log:
- [ ] Task 3: Launchpad UI
  - Description: Build Launchpad route following design.
  - Acceptance Criteria: `apps/web/src/routes/index.tsx` shows health cards (missions, workstations, notifications), quick actions (`+ Mission`, `Invite teammate`, `Edit project`), Fallback panel preview (if backlog low). Responsive layout matches design.
  - Implementation Notes: Use shadcn `Card`, `Button`, `Separator`, `Badge`. Provide loading skeletons. Ensure accessible headings and aria labels.
  - File Targets: `apps/web/src/routes/index.tsx`, `apps/web/src/components/launchpad/*`.
  - Validation: Visual QA, run `bun dev:web`.
  - Log:
- [ ] Task 4: Project Workspace Shell
  - Description: Implement project workspace route with tabs.
  - Acceptance Criteria: `apps/web/src/routes/projects/$projectId/index.tsx` renders stats banner, board placeholder, mission summary list, workstation widget, Ready toggle status. Use TanStack Router data prefetch to load workspace summary.
  - Implementation Notes: Factor subcomponents under `apps/web/src/components/project/`. Include guard for unauthorized roles (show request access CTA). Provide crumb navigation.
  - File Targets: `apps/web/src/routes/projects/$projectId/*.tsx`, `apps/web/src/components/project/*`.
  - Validation: Navigate between projects; ensure query caches by project id.
  - Log:
- [ ] Task 5: Documentation & Role Matrix
  - Description: Document role-based capabilities for Launchpad & workspace features.
  - Acceptance Criteria: `docs/product/roles.md` table for Owner, Maintainer, Contributor, Viewer. Update `docs/architecture/rules.md` referencing new doc.
  - Implementation Notes: Outline what each role sees in Launchpad vs project.
  - File Targets: `docs/product/roles.md`.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun test apps/server` for new endpoints.
- Visual QA on desktop + mobile widths.

## Documentation Updates
- Update `docs/frontend/app-shell.md` with workspace navigation details.
- Log key decisions inside mission file upon completion.

## Handoff Notes for Mission 0006
- Provide exported hook names (`useProjectWorkspace`) for mission board team.
- Note any placeholder components to be replaced (board, fallback) and relevant TODO comments.
