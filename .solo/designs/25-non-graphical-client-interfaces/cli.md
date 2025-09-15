# CLI Interface Design

## Overview

Solo Unicorn CLI is a Bun-compiled single-file tool that registers a workstation, connects to Monster Realtime, manages repositories and git worktrees, and coordinates AI code agents locally. It consumes versioned HTTP APIs (/api) and receives push events via realtime channels.

## Architecture

```
Solo Unicorn Server ──HTTP /api──▶ CLI (Workstation)
                      ◀─WS push─── Monster Realtime
CLI ⇄ Local Agents (Claude Code, Cursor...)
CLI ⇄ Git (clone, worktrees)
CLI ⇄ Dev server (optional) ⇄ Tunnel proxy
```

Key integrations:
- Monster Auth (PAT/org key); OS keychain for secret storage
- Monster Realtime (presence + mission push)
- Git worktrees (auto-managed pools)
- Optional dev server + Cloudflare Tunnel proxy (MVP)

## Commands (MVP)

Authentication
- `solo-unicorn auth login [--web|--api-key KEY|--org-key KEY] [--org ORG]`
- `solo-unicorn auth logout`
- `solo-unicorn auth whoami`

Workstation lifecycle (aliases: start/stop/status/restart)
- `solo-unicorn workstation register [--name NAME] [--force]`
- `solo-unicorn workstation start [--background]`
- `solo-unicorn workstation stop [--force]`
- `solo-unicorn workstation status [--json]`
- `solo-unicorn workstation restart`

Repositories (GitHub linking)
- `solo-unicorn repo add GITHUB_URL [--path PATH]`
- `solo-unicorn repo list`
- `solo-unicorn repo remove REPO_ID`

Configuration
- `solo-unicorn config get [KEY]`
- `solo-unicorn config set KEY VALUE`
- `solo-unicorn config list`
- `solo-unicorn config reset [KEY]`

Agents
- `solo-unicorn agent scan`
- `solo-unicorn agent list`
- `solo-unicorn agent add TYPE [--version VERSION]`

Dev Server & Tunnel (post-MVP friendly; MVP supports tunnel)
- `solo-unicorn dev-server start [--port PORT] [--project PROJECT_ID]`
- `solo-unicorn dev-server stop|status`
- `solo-unicorn tunnel open [--target-port PORT] [--project PROJECT_ID]`
- `solo-unicorn tunnel close|status`

Self-management
- `solo-unicorn self update|version`

## Realtime Integration

Channels
- `workstation:{workstation_id}` (presence + mission:assign)
- `project:{project_id}:workstations`
- `mission:{mission_id}`

Presence payload (example)
```json
{
  "status": "online",
  "availableCodeAgents": ["claude-code", "cursor"],
  "activeProjects": ["proj_123"],
  "devServerPort": 3000,
  "currentMissionCount": 1,
  "maxConcurrency": 2
}
```

Status surfaces (summary)
- Auth state (user/org, token freshness)
- Realtime connection (gateway, channels, latency)
- Repositories and worktrees (paths, branches, cloning status)
- Code agents (type, version, availability, health)
- Dev server (local URL, public tunnel URL)
- Active missions (id, repo/branch, agent)

## Repository & Worktree Management

Identifier
- `repository_id` = GitHub numeric repo ID (BIGINT); optional `additionalRepositoryIds[]`

Flow
1) Clone to workspace root on first use
2) On first mission/branch: auto-create worktree at `repo-branch` path
3) Reuse existing worktrees when possible; keep a small vacant pool
4) Cleanup unused worktrees after 7+ days (keep ≥1 vacant)

Pool policy
- Max worktrees per repo = `maxConcurrencyLimit + 3`
- Reuse same-branch worktree when available

## Dev Server & Public Tunneling

MVP choice: Cloudflare Tunnel (cloudflared). Server proxies via channel path:
`https://channel.solounicorn.lol/workstation/{ws}/project/{proj}`

Tunnel message shapes
```ts
type TunnelRequest = { type: 'http:request', requestId: string, method: string, path: string, headers: Record<string,string>, body?: string }
type TunnelResponse = { type: 'http:response', requestId: string, status: number, headers: Record<string,string>, body?: string }
```

Use cases
- Live preview, remote QA, demos, debugging

## Configuration Files

Main config: `~/.solo-unicorn/config.json`
```json
{
  "version": "1",
  "workstation": { "id": "ws_...", "name": "MacBook-Pro" },
  "auth": { "organizationId": "org_...", "email": "user@org.com", "personalAccessToken": "encrypted" },
  "realtime": { "gatewayUrl": "wss://...", "timeout": 30000 },
  "server": { "apiUrl": "https://api...", "tunnelUrl": "https://channel..." },
  "workspace": { "rootPath": "~/workspace", "defaultBranch": "main" },
  "devServer": { "enabled": true, "defaultPort": 3000, "publicTunneling": true },
  "repositories": [
    { "id": "repo_123", "githubUrl": "https://github.com/user/repo", "mainPath": "~/repos/repo", "worktrees": [] }
  ]
}
```

Agent config: `~/.solo-unicorn/code-agents.json`
```json
{
  "version": "1",
  "workstationId": "ws_...",
  "codeAgents": {
    "codeagent_claude_001": {
      "id": "codeagent_claude_001", "type": "claude-code", "name": "Claude Code",
      "customSettings": { "claudeCode": { "configDir": "~/.claude", "defaultModel": "claude-3.5-sonnet" } },
      "enabled": true, "healthStatus": "healthy"
    }
  },
  "settings": { "autoUpdateCodeAgentStatus": true, "healthCheckInterval": 300 }
}
```

## Errors & UX

Patterns
- Clear actionable errors with next steps
- Progress bars for long operations (clone)
- Status dashboards for workstation/agents/repos

Examples
- Not logged in → prompt to run `auth login`
- Branch not found → suggest creating or picking an existing branch
- Realtime failure → verify auth, check tunnel, retry

## Installation & Distribution

Methods
- npm/bun global install
- Direct binary install script
- Homebrew (macOS), Scoop (Windows), Snap (Linux)

Cross-platform
- Windows: PowerShell; Windows Service for background
- macOS: Keychain; launchd integration; notarized binaries
- Linux: systemd; distro packages; AppImage; container support

## PR Support

Modes
- YOLO: direct push to default branch
- PR Mode: auto-branch and PR, review cycles; merge strategies; auto-delete branch

Agent integration
- Read PR comments via `gh`; implement changes; respond if needed

## Future Enhancements

- Multi-agent orchestration per mission
- Mission templates
- Remote development (VS Code server)
- Team workstation pools
- CI/CD integration (GitHub Actions)
- Metrics & analytics
- Plugin system
- Loop mission scheduling
