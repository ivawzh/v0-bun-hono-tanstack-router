# Mission 0017 - Dev Server & Public Tunneling

## Mission Goal
Enable developers to share local previews securely via managed dev server processes and on-demand Cloudflare (or equivalent) tunnels, with controls in web UI and CLI.

## Why This Matters
- FEAT-015 ensures teams can showcase work without manual tunnel setup, aligned with mission workflows and security guardrails.
- Tunnel lifecycle must respect PAT scopes and auditing introduced in Mission 0016.
- Completing this mission rounds out the MVP feature set described in `.solo/designs/10-features.md`.

## Current Context
- **Previous mission**: `0016-public-api-security` delivered PATs, rate limits, and structured error handling necessary for secure tunnel control.
- **Next mission**: None currently planned; future backlog should build on completed MVP.

## Deliverables
- Dev server controller for launching/stopping preview servers linked to missions/projects.
- Tunnel management service integrating with Cloudflare (or provider) to provision temporary URLs with expiry + revocation.
- Web UI + CLI commands to start/stop tunnels, monitor status, and revoke tokens.
- Audit log + notification integration for tunnel events.

## Out of Scope
- Persistent staging environments (future work).
- Running GUI tests inside tunnel (document TODOs if needed).

## Dependencies
- PAT + rate limiting (Mission 0016).
- Workstation + agent context (Mission 0010) to host dev servers.
- Realtime notifications (Mission 0011) to broadcast tunnel status.

## Constraints & Guardrails
- Tunnels must auto-expire based on config (default 2 hours) with manual extension option.
- Store tunnel credentials securely (encrypted at rest) and never expose secrets in UI.
- Dev server should support multiple frameworks (Bun, Node) but start with current stack.

## Kickoff Checklist
Create `kickoffs/0017-dev-tunneling.kickoff.md` and complete all four steps with human confirmation before implementation.

## Tasks
- [ ] Task 1: Dev Server Controller
  - Description: Build service to start/stop dev servers on workstations.
  - Acceptance Criteria: CLI command `solo dev start --mission <id>` instructs workstation daemon to launch `bun dev` (or configured command). Controller tracks process ID, logs, health checks. Web UI shows status and stop button.
  - Implementation Notes: Use existing agent communication channel (Mission 0010). Ensure logs accessible via CLI + UI.
  - File Targets: `apps/server/src/services/devServer.ts`, CLI commands, agent protocol updates.
  - Validation: Manual run verifying server starts/stops.
  - Log:
- [ ] Task 2: Tunnel Provisioning Service
  - Description: Integrate with Cloudflare Tunnel (or provider) to expose dev server publicly.
  - Acceptance Criteria: `apps/server/src/services/tunnel.ts` handles create/destroy, returns URL + expiry. Configurable provider credentials via `packages/config`. Background job monitors expiry and closes tunnels.
  - Implementation Notes: Use PAT scope `tunnel:manage`; ensure tokens stored encrypted. Support manual revoke.
  - File Targets: Service files, DB migrations for tunnel records, job scripts.
  - Validation: Manual create tunnel, verify accessible, auto-expire works.
  - Log:
- [ ] Task 3: Web UI Controls
  - Description: Add tunnel controls to Mission Room + Launchpad.
  - Acceptance Criteria: Buttons to start tunnel (with confirmation), show tunnel URL, expiry countdown, revoke button. Display audit log link. Provide status indicator in workstation widget.
  - Implementation Notes: Use shadcn `Dialog`, `Badge`, `Countdown`. Show warnings about security.
  - File Targets: `apps/web/src/components/mission-room/DevServerPanel.tsx`, `apps/web/src/components/workstations/WorkstationCard.tsx` updates.
  - Validation: Manual QA.
  - Log:
- [ ] Task 4: CLI Commands for Tunnels
  - Description: Provide CLI parity for tunnel management.
  - Acceptance Criteria: Commands `solo tunnel start`, `solo tunnel status`, `solo tunnel stop`, `solo dev logs`. Output includes URL, expiry, mission. Respect PAT scope.
  - Implementation Notes: Use same API endpoints; display logs tail. Provide JSON output flag.
  - File Targets: `apps/cli/src/commands/tunnel.ts`, `apps/cli/src/commands/dev.ts`.
  - Validation: Manual CLI usage.
  - Log:
- [ ] Task 5: Notifications & Audit
  - Description: Emit notifications when tunnel created/expired/revoked and record audit events.
  - Acceptance Criteria: Notification to mission assignees and org owners; audit event with actor + reason. Optional Slack webhook stub for future integration.
  - Implementation Notes: Use existing event service (Mission 0011) and audit service (Mission 0015).
  - File Targets: Event emission in tunnel service, tests.
  - Validation: Manual: start tunnel → see toast + audit entry.
  - Log:
- [ ] Task 6: Documentation
  - Description: Document dev server/tunnel usage and security considerations.
  - Acceptance Criteria: `docs/product/dev-server.md`, `docs/security/tunnels.md`, update README quick start with tunnel instructions.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun test apps/server` with mocked tunnel provider.
- Manual integration test: start dev server, open tunnel from external network.
- CLI smoke tests.

## Documentation Updates
- Mission log per task.
- Note future enhancements (auto-tunnel on PR, slack notifications) in `notes/tunnel-followups.md`.

## Handoff Notes
- With MVP missions complete, compile mission retrospective referencing this mission once product backlog shifts. Future missions should reference docs produced here for tunnel workflow.
