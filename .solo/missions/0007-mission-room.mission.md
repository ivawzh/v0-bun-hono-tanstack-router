# Mission 0007 - Mission Room & Document Sync

## Mission Goal
Build the Mission Room experience with live transcript, diff preview placeholder, and synchronized mission documents (solution.md + tasks docs) between filesystem and mock backend.

## Why This Matters
- FEAT-005 and FEAT-011 emphasize that missions should be fully managed from the Mission Room, with docs kept in sync across agents.
- Later missions (0008 change management, 0014 observability) depend on timeline events and document sync implemented here.

## Current Context
- **Previous mission**: `0006-mission-board` exposes mission data, stage transitions, and timeline stubs.
- **Next mission**: `0008-change-management` will add PR/YOLO flows and review tooling to the Mission Room.

## Deliverables
- Server support for mission detail queries, timeline events, document metadata, and doc synchronization endpoints (FS ↔ mock store).
- File watcher/service to sync `/missions/<missionId>/solution.md` and `/missions/<missionId>/tasks/*.md` with backend in both directions.
- Frontend Mission Room route with tabs for Timeline, Docs, Transcript placeholder, Task list.
- UI to edit docs inline (using shadcn Minimal Tiptap component) and optimistic update to backend.

## Out of Scope
- Git diff preview (Mission 0008).
- Real database persistence (Mission 0009 productionizes data layer).
- CLI doc editing (document TODOs for later CLI mission).

## Dependencies
- Domain schema includes MissionDocument, MissionTimelineEvent from Mission 0001.
- Board navigation opens Mission Room route.

## Constraints & Guardrails
- Ensure doc sync handles conflicts (last-write-wins with conflict warning). Provide `updatedAt` timestamps.
- File watcher should run only in development; in production rely on API updates.
- Use streaming updates for docs where possible (long-poll or SSE stub prepping for realtime mission 0010).

## Kickoff Checklist
Create `kickoffs/0007-mission-room.kickoff.md` and follow all four steps with human feedback before implementation.

## Tasks
- [ ] Task 1: Mission Detail API
  - Description: Provide endpoints returning mission details, timeline, docs metadata.
  - Acceptance Criteria: `/rpc/missions.getDetail` returns mission, participants, latest timeline events, doc revision hashes. `/rpc/missions.getDocuments` retrieves doc contents. Provide REST GET `/api/v1/missions/{id}` + `/docs`.
  - Implementation Notes: Extend mock store to maintain timeline array + doc contents. When board updates stage, append timeline entry.
  - File Targets: `apps/server/src/routers/rpc/missions.ts`, `apps/server/src/routers/api/missions.ts`, `apps/server/src/mocks/store.ts` (docs/timeline state).
  - Validation: Tests verifying detail payload includes fallback metadata, stage history.
  - Log:
- [ ] Task 2: Document Sync Service (Server)
  - Description: Implement endpoints for uploading/downloading mission docs with conflict detection.
  - Acceptance Criteria: `POST /rpc/missions.saveDocument` accepting doc id + content + revision; backend stores new revision after verifying revision match or returns conflict. Provide `GET /api/v1/missions/{id}/documents/{docId}`.
  - Implementation Notes: Use simple revision increments (optimistic concurrency). Record timeline event `document.updated`.
  - File Targets: `apps/server/src/services/missionDocuments.ts`, router updates, tests.
  - Validation: Unit tests for conflict detection.
  - Log:
- [ ] Task 3: Local FS Sync Worker
  - Description: Build Node/Bun service to watch `.solo/missions/<missionId>/` docs in repo and sync with server.
  - Acceptance Criteria: New workspace script `bun run mission-docs:sync` (or dev server integration) starts watcher using `chokidar`. On change, push to server; on server update (polling) update local file. Config stored in `apps/server/src/config/docSync.ts`.
  - Implementation Notes: Guard against infinite loops by comparing revision hash. Document how to run in `docs/dev/mission-doc-sync.md`.
  - File Targets: `apps/server/src/workers/docSync.ts`, new script entry in root `package.json`, relevant config files.
  - Validation: Manual test editing local doc reflects in Mission Room after refresh and vice versa.
  - Log:
- [ ] Task 4: Mission Room UI
  - Description: Create Mission Room route with tabs and doc editor.
  - Acceptance Criteria: `apps/web/src/routes/missions/$missionId.tsx` showing header (mission title, status, Ready toggle, assignees), tabs: Overview (timeline feed), Docs (editor for solution/tasks), Transcript (placeholder), Activity (list of doc updates). Document panel uses Minimal Tiptap for editing solution doc; tasks listed with ability to mark complete (updates store).
  - Implementation Notes: Use shadcn `Tabs`, `ScrollArea`, `Timeline` pattern. Provide `useMissionDetailQuery`, `useMissionDocsQuery`, `useSaveDocumentMutation` hooks. Add toast notifications (sonner) for conflict warnings.
  - File Targets: `apps/web/src/routes/missions/$missionId.tsx`, `apps/web/src/components/mission-room/*`.
  - Validation: Manual flow: open mission, edit doc, save, reload.
  - Log:
- [ ] Task 5: Timeline Rendering
  - Description: Render timeline events within Mission Room.
  - Acceptance Criteria: `Timeline` component lists events (stage change, doc update, fallback accepted). Provide icons per event type. Show relative time (use `date-fns`).
  - Implementation Notes: Keep component pure; rely on domain schema for event shapes.
  - File Targets: `apps/web/src/components/mission-room/Timeline.tsx`.
  - Validation: Unit tests with sample events.
  - Log:
- [ ] Task 6: Documentation
  - Description: Capture doc sync and Mission Room behaviour.
  - Acceptance Criteria: `docs/product/mission-room.md` with sections for timeline, docs, transcript placeholder. Update `docs/dev/mission-doc-sync.md` (created earlier) with run instructions and troubleshooting.
  - File Targets: `docs/product/mission-room.md`, `docs/dev/mission-doc-sync.md`.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun test apps/server` for doc sync endpoints.
- End-to-end manual: edit local doc, verify UI updates.
- `bun test apps/web` for timeline/doc components.

## Documentation Updates
- Mission log entries per task.
- Add TODOs for future features (diff preview, reviews) to `notes/mission-room-followups.md`.

## Handoff Notes for Mission 0008
- Provide endpoints/mutations for review operations to build upon.
- Document where diff preview placeholder sits so review mission can slot in.
