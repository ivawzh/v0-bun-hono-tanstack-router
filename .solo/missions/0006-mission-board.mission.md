# Mission 0006 - Mission Board & Fallback Templates

## Mission Goal
Implement the Kanban mission board (Todo → Doing → Review → Done) and the Mission Fallback panel so teams can manage mission flow and auto-generated fallback work.

## Why This Matters
- FEAT-005 and FEAT-021 define core UX: transparent mission progress plus automated backlog support.
- Upcoming missions (0007–0008) extend Mission Room and review flows; they depend on board interactions and metadata established here.
- Correctly handling Ready toggles, priorities, and fallback metadata keeps UX consistent across web/CLI.

## Current Context
- **Previous mission**: `0005-projects-org` delivered project workspace shell + data hooks.
- **Next mission**: `0007-mission-room` will build Mission Room experience using board state.

## Deliverables
- Server endpoints to list missions by column, reorder/advance missions, and serve fallback templates (including acceptance/discard actions).
- Frontend board UI with drag-and-drop, mission cards (status badges, Ready toggle, assignees, fallback origin), and actions (mark Ready, move stage, open Mission Room).
- Mission Fallback panel inside Todo column showing generated templates with accept/discard interactions.
- Audit log entries (in mock store) capturing stage changes for later timeline use.

## Out of Scope
- Mission detail view (handled next mission).
- Review-specific UI (Mission 0008).
- GitHub integration or persistence (mock store only for now).

## Dependencies
- Hooks from Mission 0005 (`useProjectWorkspace` etc.).
- Drag-and-drop: prefer shadcn DnD wrappers (install via CLI if not present) or integrate `@dnd-kit`.

## Constraints & Guardrails
- Ensure operations are idempotent; moving mission to same stage should no-op.
- Simulate concurrency control in mocks (e.g. version numbers) to prepare for DB mission later.
- Provide accessible drag-and-drop fallback controls (buttons to move to next stage).

## Kickoff Checklist
Create `kickoffs/0006-mission-board.kickoff.md` and complete all four steps with human sign-off before implementing UI/handlers.

## Tasks
- [ ] Task 1: Mission Board API Extensions
  - Description: Extend ORPC/REST routers to support mission list, stage mutations, ready toggle, assignment, fallback actions.
  - Acceptance Criteria: Endpoints such as `missions.listByProject`, `missions.updateStage`, `missions.toggleReady`, `missions.assign`, `missionFallback.list`, `missionFallback.accept`, `missionFallback.discard`. Mock store tracks stage history with timestamps and user info.
  - Implementation Notes: Validate transitions using ts-pattern; record timeline entry for every change.
  - File Targets: `apps/server/src/routers/rpc/missions.ts`, `apps/server/src/routers/api/missions.ts`, `apps/server/src/mocks/store.ts`.
  - Validation: Tests ensuring invalid transitions (skipping from Todo→Done) throw `BAD_REQUEST`.
  - Log:
- [ ] Task 2: Mission Card Components
  - Description: Build card UI representing mission metadata per design.
  - Acceptance Criteria: `apps/web/src/components/mission/MissionCard.tsx` displays title, stage icon, Ready toggle, fallback badge, actor avatars, priority, review required indicator. Provide skeleton states and accessible semantics.
  - Implementation Notes: Use shadcn `Card`, `Badge`, `Avatar`, `Tooltip`. Connect `useMutation` hooks for ready toggle (optimistic update, invalidation).
  - File Targets: `apps/web/src/components/mission/*`.
  - Validation: Unit test component snapshots or use React Testing Library.
  - Log:
- [ ] Task 3: Kanban Board Interaction
  - Description: Implement drag-and-drop across columns with fallback controls.
  - Acceptance Criteria: Board component at `apps/web/src/components/mission/MissionBoard.tsx` uses `@dnd-kit` or shadcn DnD to reorder within and across columns, with keyboard-accessible controls (`Move to Doing` button). Stage changes optimistic with rollback on failure.
  - Implementation Notes: Debounce reorder updates; highlight target column when dragging. Display column-level counts from query data.
  - File Targets: `apps/web/src/components/mission/MissionBoard.tsx`, update route `projects/$projectId/index.tsx` to embed board.
  - Validation: Manual QA for drag/drop; ensure no console errors.
  - Log:
- [ ] Task 4: Mission Fallback Panel
  - Description: Build panel listing generated fallback templates with ability to accept/discard.
  - Acceptance Criteria: Panel in Todo column shows template name, intent, effort estimate, triggered reason. `Accept` converts template into active mission (calls API). `Discard` logs reason. Provide `Fallback` badge on accepted missions.
  - Implementation Notes: Use hooks for fallback queries/mutations; update workspace summary counts. Document accepted/discarded events for timeline (mock store `fallbackEvents`).
  - File Targets: `apps/web/src/components/mission/FallbackPanel.tsx`, server fallback API modules.
  - Validation: Tests verifying accept/discard updates list.
  - Log:
- [ ] Task 5: Documentation & UX Notes
  - Description: Capture board interaction guidelines and fallback behaviours.
  - Acceptance Criteria: `docs/product/mission-board.md` describing UX, accessibility, keyboard shortcuts, optimistic update pattern. Update `docs/architecture/rules.md` with stage transition rules.
  - File Targets: `docs/product/mission-board.md`.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun test apps/server` for mission API transitions.
- `bun test apps/web` for components if tests added.
- Manual QA: move missions between columns, toggle ready, accept fallback.

## Documentation Updates
- Update mission log per task.
- Add TODO entries for features deferred to Mission 0007/0008 (e.g. Mission Room navigation) in `notes/`.

## Handoff Notes for Mission 0007
- Provide API endpoints for mission detail fetch and timeline seeds.
- Document how to navigate from board to Mission Room (card `onClick` open new route) so Mission 0007 can hook into `useMissionDetails`.
