# Mission 0008 - Change Management & Flow Reviews

## Mission Goal
Implement PR/YOLO change policies, review workflows, and diff presentation inside Mission Room so teams can manage approvals without leaving the app.

## Why This Matters
- FEAT-006 and FEAT-010 define mission-ready guardrails, review queues, and diff previews.
- Integrations with GitHub PRs (or equivalent) need to align with board transitions and mission room data.
- Review outcomes drive Mission timeline events and notifications (later mission 0010).

## Current Context
- **Previous mission**: `0007-mission-room` delivered mission detail UI, docs, and timeline.
- **Next mission**: `0009-persistence-upgrade` will introduce real database persistence; design decisions here should anticipate that swap.

## Deliverables
- Server integration layer abstracting GitHub (or placeholder) for PR creation, status syncing, and YOLO commit logging.
- Mission policy management (project default + per-mission override) with API support.
- Mission Room Review tab featuring diff viewer, review checklist, assignment UI, and approve/reject actions.
- Review history stored in timeline + accessible via API.

## Out of Scope
- Realtime notifications (Mission 0010).
- CLI automation for reviews (document TODOs).

## Dependencies
- Domain schema includes `ChangePolicy`, `ReviewDecision`, `ChangeRequest` (extend if missing).
- Mission Room route exists with placeholders for Review tab.

## Constraints & Guardrails
- Keep GitHub integration behind abstraction (`apps/server/src/services/changeManagement/github.ts`) so we can swap providers.
- Provide fallback flow when GitHub credentials absent (mock PR objects for dev).
- Review actions must be idempotent and record actor, timestamp, rationale.

## Kickoff Checklist
Create `kickoffs/0008-change-management.kickoff.md` and complete the four steps with human confirmation before implementing.

## Tasks
- [ ] Task 1: Change Policy Model & API
  - Description: Extend mock store and routers to support project-level change policies + per-mission override.
  - Acceptance Criteria: `projects.getWorkspace` returns policy info; `missions.updatePolicy` mutates override; domain schema updated accordingly. Policies include `mode: 'pr' | 'yolo'`, required reviewers, ready guard toggle.
  - Implementation Notes: Validate only owners can update; store audit event.
  - File Targets: `apps/server/src/routers/rpc/projects.ts`, `apps/server/src/routers/rpc/missions.ts`, `apps/server/src/mocks/store.ts`.
  - Validation: Tests ensuring permission gating.
  - Log:
- [ ] Task 2: GitHub Integration Abstraction
  - Description: Implement service for PR creation/sync with fallback mock.
  - Acceptance Criteria: `apps/server/src/services/changeManagement/github.ts` provides `createPullRequest`, `syncStatus`, `postReviewComment`. When env vars missing, use in-memory stub. Document env requirements in `.env.example`.
  - Implementation Notes: Use Octokit; wrap in retry logic. Provide tests with mocked Octokit.
  - File Targets: `apps/server/src/services/changeManagement/github.ts`, config updates.
  - Validation: Unit tests verifying request payloads; manual test hitting GitHub sandbox.
  - Log:
- [ ] Task 3: Review API Endpoints
  - Description: Expose endpoints for requesting review, approving, rejecting, and logging rationale.
  - Acceptance Criteria: ORPC endpoints `missions.requestReview`, `missions.submitReviewDecision`, `missions.syncReviewStatus`. Timeline event recorded for each action. REST endpoints for CLI parity.
  - Implementation Notes: Ensure YOLO mode bypasses PR creation but still logs commit summary. Provide idempotency keys to avoid duplicate actions.
  - File Targets: `apps/server/src/routers/rpc/missions.ts`, `apps/server/src/routers/api/missions.ts`, tests.
  - Validation: Tests verifying state transitions (Todo->Review on request, etc.).
  - Log:
- [ ] Task 4: Mission Room Review Tab UI
  - Description: Build Review tab with diff viewer and checklist.
  - Acceptance Criteria: `MissionReviewPanel` component displays diff preview (use Monaco diff or codemirror diff), metadata (PR link or YOLO summary), required checklist, reviewer assignment dropdown, approve/reject buttons with comment box. Integrates with mutations from Task 3.
  - Implementation Notes: Use shadcn `Tabs`, `Textarea`, `Button`, `Badge`. Provide fallback message when diff unavailable (mock).
  - File Targets: `apps/web/src/components/mission-room/MissionReviewPanel.tsx`, route updates.
  - Validation: Manual flow: request review, approve, see timeline update.
  - Log:
- [ ] Task 5: Review Queue Surfaces
  - Description: Add Review column view + notifications preview hook.
  - Acceptance Criteria: Project workspace board highlights Review column with summary card; Launchpad shows Review queue count; add `/review` route listing missions awaiting decision.
  - Implementation Notes: Use data from `missions.listByStage('Review')` and `notifications`. Provide keyboard shortcuts stub (document for later).
  - File Targets: `apps/web/src/routes/projects/$projectId/review.tsx`, components.
  - Validation: Visual QA.
  - Log:
- [ ] Task 6: Documentation
  - Description: Document change management workflow.
  - Acceptance Criteria: `docs/product/change-management.md` covering PR vs YOLO, how review flows operate, env requirements for GitHub integration.
  - File Targets: `docs/product/change-management.md`, update `docs/architecture/rules.md`.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun test apps/server` covering review endpoints + GitHub service (with mocks).
- Manual scenario: request review, approve, observe timeline + board update.

## Documentation Updates
- Mission log per task.
- Add TODO for CLI review support under `notes/cli-roadmap.md`.

## Handoff Notes for Mission 0009
- Document event shapes and status fields introduced so persistence mission can create tables/migrations accordingly.
- Note outstanding scaling concerns (webhook handling, background jobs) for Mission 0009.
