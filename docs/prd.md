# Solo Unicorn! Product Requirements Document (PRD)

## Goals and Background Context

### Goals
- Deliver mission-based orchestration with default Clarify → Plan → Code stages and optional human review
- Provide Monster Auth authentication (OAuth + email/password), PATs and org API keys with role-based access
- Enable workstation registration/presence and reliable mission assignment via Monster Realtime
- Orchestrate code agents (starting with Claude Code) with rate-limit detection and health checks
- Manage repositories using stable GitHub numeric repository IDs and auto-managed git worktrees via CLI
- Support dual change modes: YOLO (direct push) and PR flow with auto PR creation and iteration via GitHub comments
- Persist hybrid context (solution.md and tasks/{n}.md) with DB-backed progress tracking
- Offer Public Projects with granular, permission-aware UI/API and access request workflows
- MCP-first domain operations with REST adapters; WebSocket for realtime events; oRPC for internal web↔server
- Spectrum Coding modes — “Vibe-coding” (fast, fluid, minimal spec) vs “Spec-coding” (structured, spec-driven); users can choose per project/mission and customize flow templates and prompt strictness
- Founder-first outcomes — “Solo Unicorn!” explicitly targets solo founders aspiring to build unicorns by easing daily operational/coding tasks through agent-driven missions and streamlined review/merge flows

### Background Context
Solo Unicorn! is designed for solo founders and small teams who need to ship fast while maintaining control when stakes rise. It centralizes AI-assisted development around “missions” with clear stage flows and optional human reviews. Workstations run agents locally; the server orchestrates via Monster Realtime. The platform explicitly supports Spectrum Coding: founders can toggle between vibe-coding (move fast with minimal spec) and spec-coding (structured, review-heavy), and customize flows and prompt strictness accordingly. Combined with optional PR mode and permission-aware Public Projects, Solo Unicorn! reduces daily friction and amplifies founder leverage.

### Change Log
| Date       | Version | Description                                                                 | Author   |
|------------|---------|-----------------------------------------------------------------------------|----------|
| 2025-09-10 | v0.1    | Initial PRD scaffolding from docs/foundation and project brief              | PM Agent |
| 2025-09-10 | v0.2    | Added Spectrum Coding (vibe vs spec) + founder-first framing                 | PM Agent |

## Requirements

### Functional
- FR1: Authentication & authorization via Monster Auth, personal access tokens, and organization API keys with role-based access and token refresh/rotation.
- FR2: Organization multi-tenancy with member invitations/roles and project-level defaults.
- FR3: Workstation registration and realtime presence via CLI and Monster Realtime.
- FR4: Code agent orchestration (start with Claude Code) with health checks and rate-limit handling.
- FR5: Repository/worktree management using GitHub numeric repo ID; CLI auto-clone and auto-manage worktrees with repo-level concurrency.
- FR6: Mission lifecycle with flow-first creation, default stages (Clarify → Plan → Code), optional stage reviews, lists (Todo/Doing/Review/Done/Loop), priority, dependencies, and loop missions.
- FR7: Spectrum Coding modes (vibe-coding vs spec-coding) selectable per project/mission with customizable flows and prompt strictness.
- FR8: Change management supporting YOLO (direct push) and PR mode; auto-create PR on Review; iterate via GitHub comments.
- FR9: Hybrid Solution & Tasks docs (solution.md, tasks/{n}.md) stored in filesystem with DB-tracked progress and current task index.
- FR10: Real-time communication via WebSocket for presence, assignment, and status; mission updates via MCP.
- FR11: Configuration and secure secrets management; CLI config get/set/list/reset with OS keychain storage.
- FR12: Public Projects with granular, permission-aware UI/API and access request workflows.
- FR13: Public project discovery (browse/search/filter), templates, and basic community metrics (permission-aware).
- FR14: Public API discovery endpoints with permission-aware responses, rate limits, CORS, caching, and versioning under /api/v1/public.
- FR15: MCP-first domain tools with REST adapters; include project/org context on calls.
- FR16: Flow template system with versioned stages and static prompts for MVP; stage-level review flags.
- FR17: GitHub PR integration with PR linking/status and optional auto-merge/delete-branch per project settings.
- FR18: CLI operations: auth, workstation lifecycle, repo link/list/remove, agent scan/list/add, config, self update/version, status.
- FR19: Dev server & tunneling strategy (Cloudflare Tunnel for MVP) with CLI UX possibly post-MVP while capability is supported.
- FR20: Founder-first ergonomics (defaults, mission templates, quick toggles between vibe/spec modes).

### Non Functional
- NFR1: Security with TLS-only, strict input validation, parameterized queries, XSS sanitization, CSRF and CORS for authenticated ops.
- NFR2: Secrets/tokens in OS keychain; automatic refresh and server-initiated refresh; rotation and revoke on logout.
- NFR3: Performance & caching deferral for MVP; conditional requests (ETag/If-Modified-Since) for public endpoints.
- NFR4: Availability & graceful degradation for anonymous users and realtime disconnects.
- NFR5: Rate limiting tiers (anonymous/authenticated/contributor+) with burst allowances and headers.
- NFR6: Versioning with REST /api/v1 and MCP tool namespace versioning; deprecation strategy and migration guidance.
- NFR7: Observability & audit logging for access/permission changes, mission activity, PR sync; basic public analytics.
- NFR8: Privacy for public projects enforcing workstation visibility settings; never expose sensitive workstation data.
- NFR9: Cross-platform CLI (macOS/Windows/Linux) with native service integration where feasible.
- NFR10: Data integrity & stability using numeric GitHub repo IDs, referential integrity, and git history for documents.
- NFR11: Concurrency & locking using DB helper and tuned indexes for frequent monitoring/assignment queries.
- NFR12: Scalability via repo/agent concurrency constraints and efficient indexed queries; presence-based assignment model.

<!--
Next steps (interactive):
- UI Design Goals (if applicable)
- Technical Assumptions
- Epic List → Epic Details & Stories
These will be populated via elicitation in subsequent steps.
-->
