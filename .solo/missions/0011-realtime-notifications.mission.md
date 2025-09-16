# Mission 0011 - Realtime Presence & Unified Notifications

## Mission Goal
Add realtime infrastructure for presence updates, mission events, and unified notifications across web and CLI surfaces.

## Why This Matters
- FEAT-007 and FEAT-017 require push updates for mission stages, workstation health, and notifications to keep UX responsive.
- Later missions (search, observability) reuse these event streams.
- Ensures CLI parity with unread counts and quiet hour controls.

## Current Context
- **Previous mission**: `0010-workstation-agent` introduced workstation/agent data and CLI.
- **Next mission**: `0012-configuration-templates` will use realtime context to refresh config/flow changes.

## Deliverables
- Realtime transport (Monster Realtime or WebSocket server) broadcasting presence and notification events.
- Subscription endpoints and token issuance (PAT integration) for clients to connect securely.
- Web UI components for toast notifications, inbox page, presence indicators on board/workstation list.
- CLI commands to watch notifications/presence.

## Out of Scope
- Advanced analytics dashboards (Mission 0014).
- Email digest scheduling (document TODO for later). 

## Dependencies
- Persistence tables for notifications, presence events (Mission 0009).
- Workstation/agent data (Mission 0010).

## Constraints & Guardrails
- Ensure events are idempotent (include version + timestamp).
- Provide offline fallback polling (15s) when realtime disconnected.
- Respect quiet hours preferences (store in config for later mission 0012 but allow default).

## Kickoff Checklist
Create `kickoffs/0011-realtime-notifications.kickoff.md` and follow the four steps with human confirmation before implementing realtime features.

## Tasks
- [ ] Task 1: Realtime Infrastructure Setup
  - Description: Integrate Monster Realtime SDK or self-hosted WebSocket server.
  - Acceptance Criteria: `apps/server/src/realtime/server.ts` establishing channels `workstation:{id}`, `mission:{id}`, `notifications:{userId}`. Authentication via PAT or session tokens. Provide fallback for local dev (ws server in same Bun process).
  - Implementation Notes: Ensure heartbeat/ping to keep connections alive. Document env variables.
  - File Targets: `apps/server/src/realtime/*`, `apps/server/src/index.ts` to mount.
  - Validation: Manual connection test via WebSocket client.
  - Log:
- [ ] Task 2: Presence & Event Publishing
  - Description: Publish events for workstation heartbeat, mission stage changes, review decisions, fallback generation.
  - Acceptance Criteria: Repository layer emits events into realtime service + persists event history. Provide background job to resend on failure. Ensure events include `traceId` for auditing.
  - Implementation Notes: Hook into job queue (Mission 0009). Provide TypeScript event types in `packages/domain-schema`.
  - File Targets: `apps/server/src/services/events.ts`, update existing services to emit events.
  - Validation: Tests verifying event payloads when stage changes occur.
  - Log:
- [ ] Task 3: Notification Service & Inbox
  - Description: Implement unified notification service delivering toasts + inbox + CLI.
  - Acceptance Criteria: Notification creation API, read/unread toggles, quiet hours preferences. Web UI: toast via `sonner`, inbox route `/notifications` with filters (All, Missions, Workstations, Community), mark-as-read. CLI command `solo notifications watch`. Sync unread badge to header.
  - Implementation Notes: Use TanStack Query subscriptions for realtime (update cache). Store quiet hours in config table.
  - File Targets: `apps/server/src/routers/rpc/notifications.ts`, `apps/web/src/routes/notifications.tsx`, CLI updates.
  - Validation: Manual: trigger mission stage change, see toast + inbox entry.
  - Log:
- [ ] Task 4: Presence Indicators in UI
  - Description: Surface presence states across UI.
  - Acceptance Criteria: Board shows agent avatars with live status, workstation console updates status without refresh, Launchpad shows online counts. Provide offline banner when realtime disconnected.
  - Implementation Notes: Use `useEffect` to subscribe to webs socket events, update `queryClient` cache.
  - File Targets: `apps/web/src/components/mission/MissionCard.tsx`, `apps/web/src/components/workstations/*.tsx`, global provider for realtime connection.
  - Validation: Manual QA (simulate offline, ensure fallback polling kicks in).
  - Log:
- [ ] Task 5: Documentation & Runbook
  - Description: Document realtime architecture and troubleshooting.
  - Acceptance Criteria: `docs/architecture/realtime.md` (channels, payloads, reconnect logic), `docs/dev/runbooks/realtime.md` with debugging steps.
  - Validation: Human review.
  - Log:

## Testing & Validation
- Automated tests mocking realtime server to verify event emission.
- Manual QA: run dev server, open two browsers, observe mission board updates.
- CLI `solo notifications watch` receives events.

## Documentation Updates
- Mission log per task.
- Note follow-up for quiet hours UI customizing in `notes/realtime-followups.md` if not completed.

## Handoff Notes for Mission 0012
- Provide API/event references for config/template updates so Mission 0012 can refresh state promptly.
- Document PAT issuance steps for CLI to subscribe (Mission 0015 will harden security PATS).
