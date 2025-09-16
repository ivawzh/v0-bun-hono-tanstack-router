# CLI Interface Design

## Overview
Solo Unicorn CLI is a Bun-compiled single binary that keeps humans in the loop for workstation operations, mission execution, and Mission Fallback management. It mirrors the web experience with mobile-first language, smart defaults, and actionable guidance.

## Experience Principles
- Plain-language feedback with next steps and undo hints
- Smart context inference (org/project/workstation) while always stating assumptions
- Safety nets: dry runs, confirmations, resumable operations, offline queue
- Observability: emoji-rich TTY output plus JSON for scripting
- Fallback-first mindset: keep Todo backlog healthy without loop missions

## Architecture
```
Solo Unicorn Server ─HTTP /api────────▶ CLI commands
                   ◀──WS push───────── Monster Realtime (presence, mission/fallback events)
CLI daemon ───────▶ Background telemetry + mission supervision + fallback alerts
CLI ─────────────▶ Local code agents, Git, dev servers, OS notifications
```
- **Daemon mode (`workstation daemon`)** maintains realtime connection, supervises missions, watches backlog thresholds, and emits desktop notifications.
- Foreground commands talk to daemon via local IPC for fast status and queue updates.

## Command System

### Authentication
- `solo-unicorn auth login [--web|--api-key KEY|--org-key KEY] [--org ORG]`
- `solo-unicorn auth logout [--all]`
- `solo-unicorn auth whoami [--json]`

### Workstations
- `solo-unicorn workstation register [--name NAME] [--force]`
- `solo-unicorn workstation daemon [--foreground] [--log-level LEVEL]`
- `solo-unicorn workstation status [--json] [--watch]`
- `solo-unicorn workstation pause|resume [--reason TEXT]`
- `solo-unicorn workstation diagnostics`

### Projects & Context
- `solo-unicorn project list [--org ORG]`
- `solo-unicorn project switch PROJECT_ID`
- `solo-unicorn project status [--json]`

### Missions
- `solo-unicorn mission list [--project PROJECT_ID] [--filter REVIEW|DOING|READY|FALLBACK] [--json]`
- `solo-unicorn mission accept MISSION_ID [--worktree WORKTREE]`
- `solo-unicorn mission show MISSION_ID [--log --json]`
- `solo-unicorn mission ready MISSION_ID [--note TEXT]`
- `solo-unicorn mission handoff MISSION_ID [--workstation WS_ID]`
- `solo-unicorn mission complete MISSION_ID [--summary FILE|--stdin]`
- `solo-unicorn mission retry MISSION_ID [--reason TEXT]`

### Mission Fallback
- `solo-unicorn fallback status [--json]` — show backlog threshold, last run, accepted/discarded counts
- `solo-unicorn fallback run [--project PROJECT_ID] [--accept-all|--dry-run]` — trigger generation immediately
- `solo-unicorn fallback approve RUN_ID [MISSION_ID...] [--all]` — accept generated missions
- `solo-unicorn fallback discard RUN_ID [MISSION_ID...] [--note TEXT]`
- `solo-unicorn fallback templates list|enable|disable|edit` — manage templates (opens editor or uses flags)
- `solo-unicorn fallback config` — open configuration in `$EDITOR`, validates before saving

### Repositories & Worktrees
- `solo-unicorn repo add GITHUB_URL [--path PATH] [--default-branch main]`
- `solo-unicorn repo list [--json]`
- `solo-unicorn repo remove REPO_ID [--preserve-clone]`
- `solo-unicorn worktree list [--repo REPO_ID]`
- `solo-unicorn worktree clean [--repo REPO_ID] [--days N]`

### Agents
- `solo-unicorn agent scan [--include PATH]`
- `solo-unicorn agent list [--json]`
- `solo-unicorn agent add TYPE [--version VERSION] [--config FILE]`
- `solo-unicorn agent check TYPE`

### Notifications & Inbox
- `solo-unicorn notifications pull [--json] [--since TIMESTAMP]`
- `solo-unicorn notifications read NOTIFICATION_ID...`
- `solo-unicorn notifications watch` — streams realtime events, including fallback runs

### Access Requests
- `solo-unicorn access request PROJECT_ID --role contributor|collaborator [--message TEXT]`
- `solo-unicorn access list [--project PROJECT_ID] [--json]`
- `solo-unicorn access approve REQUEST_ID [--note TEXT]`
- `solo-unicorn access decline REQUEST_ID [--note TEXT]`

### Diagnostics & Support
- `solo-unicorn doctor`
- `solo-unicorn bugreport [--mission MISSION_ID]`
- `solo-unicorn update [--channel stable|beta|nightly]`

### Configuration & Self
- `solo-unicorn config get|set|list|reset`
- `solo-unicorn config edit`
- `solo-unicorn version`
- `solo-unicorn completion install|uninstall`

## Output Patterns
- **TTY:** Tables with Monster Theme emojis (🟢 online, 🟡 idle, 🔴 offline, 🧪 review, 🏭 fallback). Progress bars show clone/generation status.
- **JSON:** Structured as `{ context, data, meta }` for scripting. Fallback runs include `missions[]` with status `proposed|accepted|discarded`.
- **Quiet (-q):** Silence on success, errors only.

## Background Daemon
- Autostarts after `register` (unless `--no-daemon`).
- Monitors Todo count; when below threshold, triggers Mission Fallback run (subject to project config) and notifies via desktop + CLI.
- Persists mission queue and fallback proposals under `~/.solo-unicorn/state.json` with journaling for offline replay.
- Sends heartbeats every 15s; backs off when offline and surfaces local notifications.

## Realtime Contracts
- `workstation:{id}` → presence, mission assignment, tunnel updates.
- `mission:{id}` → timeline updates, review actions.
- `user:{id}:notifications` → inbox events, including fallback run results.
- `project:{id}:fallback` → mission fallback status, run summaries.

## Offline Queue & Retry
- Mutative commands append to `~/.solo-unicorn/offline-queue.jsonl` when disconnected.
- Daemon replays with exponential backoff and tags output `⚡ replayed at 12:04`.
- Conflicts prompt diff: user chooses remote, local, or abort.

## Configuration Files
- `~/.solo-unicorn/config.json` — global prefs.
- `~/.solo-unicorn/code-agents.json` — agent registry.
- `~/.solo-unicorn/settings.d/{project-id}.json` — per-project overrides (workspace path, concurrency, fallback defaults).
- `.solo-unicorn/settings.json` inside repo for hints (optional).

Mission Fallback template sample (`~/.solo-unicorn/templates/fallback/landing-polish.json`):
```json
{
  "id": "tmpl_landing_polish",
  "name": "Polish landing hero copy",
  "flowId": "flow_copy_polish",
  "actorId": "actor_storyteller",
  "repositoryId": "repo_web",
  "estimatedEffortMinutes": 45,
  "priority": 2,
  "description": "Refine hero headline and CTA to match current campaign.",
  "acceptance": "Preview includes before/after diff and fallback copy."
}
```

## Error Handling & Guidance
- Errors show `What happened`, `Why it matters`, `Try this next`, docs link.
- Exit codes follow POSIX conventions.
- `--debug` prints stack trace + HTTP trace id; `mission` and `fallback` commands include correlation ids for support.

## Installation & Distribution
- npm/bun global install, signed installer script, Homebrew, Scoop, GitHub releases, container image.
- Ed25519 signatures validated post-install; CLI warns if binary outdated per `/api/v1/meta/status`.

## Cross-Platform Notes
- Windows: Task Scheduler integration for daemon, Credential Manager for secrets.
- macOS: LaunchAgent plist generator, Keychain storage, Notification Center hooks.
- Linux: systemd unit generator, libsecret support, DBus notifications.
- Containers: `--container` flag disables desktop integrations, logs to STDOUT.

## Future Hooks
- Plugin system placeholder (`solo-unicorn plugin ...`) behind feature flag.
- Mission Fallback scoring engine improvements (accept/discard feedback loops) planned post-beta.

## Support & Documentation
- `solo-unicorn help <command>` includes examples referencing web flows.
- `solo-unicorn doc open mission-fallback` opens docs on backlog automation.
- `doctor` command exports shareable Markdown summary with mission + fallback diagnostics.
