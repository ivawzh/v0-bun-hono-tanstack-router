# Solo Unicorn! — Project Brief

Status: Draft

Audience & Tone: Public learning tone

## One-liner

An AI‑centric platform that orchestrates AI agents through Kanban flows. A dynamic AI workflow framework. Supports optional GitHub PR‑based development, and enables public project collaboration with granular permissions.

## Marketing & Vision

Solo Unicorn! helps build Unicorn startups with solo founders.

Primary domain: solounicorn.lol

## Goals

- Business
  - Accelerate delivery via AI-assisted “missions” that follow clear flows (Clarify → Plan → Code).
  - Support both fast iteration (YOLO/direct push) and controlled development (PR mode) to fit project maturity.
  - Enable public project discovery, community contribution, and reusable templates to grow the ecosystem.
- Technical
  - Workstation-first execution: agents run on user machines; the server orchestrates over WebSocket presence.
  - Stable repository identification (GitHub numeric repository_id) and git worktrees for parallel development.
  - Real-time mission orchestration, presence, and status via Monster Realtime.
  - Hybrid mission documentation: filesystem (solution.md, tasks/{n}.md) + DB tracking for progress and prompting.

## Maximum Magic

- Smart proactive UX design: Provide before the user starts thinking (e.g., prefill dropdowns if there is only one option).
- Batteries included: Optimal defaults out-of-the-box; minimal user configuration required.

## Target users and roles

- Organization Owner/Admin: Project setup, repository linking, permission management, flows.
- Maintainer: Execute missions, manage repos, approve PRs (when PR mode).
- Collaborator: Broader access than Contributor; can review and view analytics (as configured).
- Contributor: Create/edit missions for public/private projects (permission-aware).
- Public (Anonymous): View public projects and completed missions with limited details.
- Workstation Operator/Developer: Runs CLI, registers workstation, manages local repos/worktrees.
- Human Reviewer: Reviews GitHub PRs; uses app “Reject” action to trigger agent iteration.

## MVP scope

- In
  - Auth & tenancy: Monster Auth (OAuth, PAT, org API keys); email as canonical identity; org-based multi-tenancy and RBAC in app layer.
  - Mission management: Kanban (Todo/Doing/Review/Done), flows (Clarify/Plan/Code), optional review, dependencies, loop missions, priority + list ordering.
  - Optional PR support (default disabled): mission branch creation, PR creation on Review, PR link/status on cards; reviews happen in GitHub; app “Reject” loops agent via gh.
  - Workstations: Registration, presence, basic agent availability reporting; repository concurrency respected.
  - Repositories & worktrees: GitHub linking with numeric repo_id; CLI auto-manages worktrees on first mission per repo/branch.
  - Web UI: Kanban board + Mission modals (Base/Flow/Review/Dependencies/Settings), project/org settings, public project read views; mobile-first.
  - CLI: auth/login/whoami; workstation register/start/status; repo add/list/remove; agent scan/list/add; config get/set/list/reset; self version/update.
  - API & Public endpoints: Public discovery endpoints (permission-aware) for browsing public projects and completed missions.
  - Database: Schema supporting projects, missions, flows, actors, repositories, workstations, PR tracking, permissions, stars, activity, helpers (locking) with performance indexes.
- Out (deferred)
  - In-app PR comments UI and full PR conversation sync (reviews occur in GitHub; agent reads via gh).
  - Dynamic prompt generation (keep static prompt templates for MVP).
  - Rich community features beyond basic public visibility and minimal discovery.
  - Advanced dev-server/tunneling controls in the CLI (beyond notes and non-MVP commands).
  - Streaming/partial document streaming and complex mission doc operations.
  - Multi-agent orchestration beyond a single agent type (Claude Code is primary for now).

## Features overview (high level)

- Web: Trello-like Kanban, MissionView/MissionCreate modals, PR-mode badges/links, Review actions, Project/Org settings, public project views.
- CLI: Auth, workstation lifecycle, repo linking, agent detection/registration, configuration management, self-update/version.
- PR mode: Automatic branch + PR creation, GitHub status surface in Review/Done, reject-to-iterate loop.
- Public projects: Permission-aware views, visibility controls, basic discovery; granular role system (Public, Contributor, Collaborator, Maintainer, Owner).

## Architecture snapshot

- Workstation-centric execution; server orchestrates via Monster Realtime channels and presence.
- Communication hierarchy (least powerful first): internal oRPC; REST for external integrations; WebSocket for push; MCP tools for agent interactions as needed.
- GitHub numeric repository_id as canonical identifier; git worktrees enable parallel development; repository concurrency respected.
- Hybrid mission documentation (filesystem + DB tracking) with git history for solution/tasks content.

## Dependencies & assumptions

- Monster Auth and Monster Realtime (tokens, presence, channel routing).
- GitHub as VCS provider; GitHub CLI (gh) used for PR comment reading on iteration.
- Bun-compiled CLI; Postgres (NeonDB for alpha, AWS RDS for production).
- Cloudflare Tunnel optional for dev public URLs; not central to MVP workflows.
- Brand & domain: Solo Unicorn! — solounicorn.lol

## Success metrics

- Most important metric — PR mode average iteration times (average number of review rejections/iterations until approval).
- Time-to-first-mission (TTFM) for a new project (from signup to first mission in Doing).
- % of missions completed without human intervention (when not in PR mode).
- Workstation online ratio and average WebSocket latency.
- Mission throughput: created→done cycle time distribution.
- Public engagement (views) and contributor conversion (for public projects).

## Risks & mitigations

- Permission leakage in public mode → Strict app-layer checks; permission-aware responses; privacy controls for workstation visibility; rate limiting and CORS.
- Git/PR race conditions → Clear branch naming and cleanup, repository concurrency limits, PR status syncing.
- Agent availability/rate limits → Presence-driven scheduling, concurrency-aware assignment, retry/backoff strategies.
- Flow/template complexity → Versioned flow templates; static prompts in MVP; explicit review points at stages.

## Open questions

- None at this time.
