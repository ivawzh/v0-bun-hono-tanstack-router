# Features Design

## Problems
- Hard to coordinate AI coding across repos and machines
- Need optional PR control without slowing iteration
- Real-time visibility into missions and agents is lacking
- Public collaboration needs granular permissions
- Cross-interface consistency between Web, CLI, MCP is hard

## Overview

### Vision
Build a modern, type-safe AI development system where humans define intent and flows, code agents execute work on user-controlled workstations, and teams collaborate via optional PR review and public projects.

### Product Goals
- Mission-centric workflow with flow-first creation and review gates
- Optional PR-based change control and fast YOLO mode
- Workstation-first execution with presence and push assignments
- Public projects with permission-aware UX and APIs
- One truth for operations via MCP tools + versioned /api

## Features

### FEAT-001 - Authentication & Authorization
- ID: FEAT-001
- Name: Authentication & Authorization
- Status: Shipped (MVP scope)

#### Intent
Securely authenticate users via Monster Auth and authorize actions by org/project roles without duplicating identity tables.

#### Goals
- Support Google OAuth and email/password via Monster Auth
- Support PATs (pat_...) and org keys (org_key_...) for CLI/MCP
- Org-based multi-tenancy and roles: owner, admin, member
- Canonical identity by email; no custom auth table
- Token refresh incl. server-initiated via realtime signal

#### Non-Goals
- Custom identity providers beyond Monster Auth (MVP)
- Fine-grained SQL permission logic as source of truth

#### Solution
Use Monster Auth for identity, app-layer TypeScript for authz, secure cookies for web (/rpc), and Authorization headers for /api and MCP.

#### User Flow Links
- [UF-AUTH-001](./20-gui/web.md#uf-auth-001---authentication-flow)

#### Transport Flow Links
- HTTP: GET /api/oauth/callback (OAuth)
- HTTP: /api/v1/... with PAT/org key for CLI/MCP

#### Design Notes
- Email is canonical identity; multiple providers allowed if same email
- CORS allowlist and CSRF for cookie APIs
- Rate limiting on public endpoints

#### Risks & Mitigations
- Token leaks → OS keychain storage + short-lived tokens
- Email change at IdP → out-of-band migration process

---

### FEAT-002 - Workstation Management
- ID: FEAT-002
- Name: Workstation Management
- Status: Shipped (MVP scope)

#### Intent
User-owned machines register as workstations that host agents, receive missions via push, and report presence/health.

#### Goals
- Register/start/stop/status via CLI
- Presence via Monster Realtime; channel per workstation
- Cross-platform (Windows/macOS/Linux)
- Background/daemon mode support
- Health and diagnostics visibility

#### Non-Goals
- Server-persisted agent configs (kept client-side)

#### Solution
CLI registers workstation, connects to realtime, reports available agents and dev server info; server stores minimal state for orchestration.

#### User Flow Links
- [UF-WS-001](./20-gui/web.md#uf-ws-001---workstation-view)

#### Transport Flow Links
- WS: workstation:{id} (presence, mission:assign)
- HTTP: POST /api/v1/workstations/register

#### Design Notes
- Availability, concurrency, versions reported by presence; not stored as config on server

---

### FEAT-003 - Code Agent Orchestration
- ID: FEAT-003
- Name: Code Agent Orchestration
- Status: Shipped (MVP scope)

#### Intent
Discover and track code agents on workstations, respecting rate limits and concurrency for mission assignment.

#### Goals
- agent scan/list/add via CLI
- Track availability and capacity via presence
- Health checks and rate-limit hints

#### Non-Goals
- Persist detailed agent configs server-side

#### Solution
Client stores ~/.solo-unicorn/code-agents.json; server maintains static type definitions; orchestration uses presence + minimal DB fields.

#### Transport Flow Links
- WS presence meta fields for available agents

#### Design Notes
- Server-side “type definitions” for agent capabilities

---

### FEAT-004 - Repository & Git Worktree Management
- ID: FEAT-004
- Name: Repositories & Worktrees
- Status: Shipped (MVP scope)

#### Intent
Enable parallel development through git worktrees managed by the CLI, with stable repo identification.

#### Goals
- Repository add/list/remove via CLI
- Auto-create worktrees per mission/branch on first use
- Stable identifier: GitHub numeric repository ID (BIGINT)
- Optional additionalRepositoryIds

#### Non-Goals
- User-facing worktree commands in MVP

#### Solution
CLI manages cloning and worktree pools in the workspace; server references repos by GitHub repo ID and links to projects.

#### Design Notes
- Worktree pool policy: reuse, keep vacant, cleanup after inactivity

---

### FEAT-005 - Mission Management & Flow
- ID: FEAT-005
- Name: Missions & Flows
- Status: Shipped (MVP scope)

#### Intent
Mission-centric workflow with flow-first creation; stages drive prompting; optional human review and dependencies.

#### Goals
- Columns: Todo, Doing, Review, Done; special Loop list
- Default stages: clarify → plan → code; custom stages allowed
- Flow-first creation with stage toggles and review flags
- Dependencies, priority, list order (DnD)
- Solution & tasks persisted hybrid (FS+DB)

#### Non-Goals
- Complex task append/reorder via MCP in MVP

#### Solution
Kanban UI + MissionModal tabs; DB fields for stage/flow/review; FS docs for solution and per-task notes in mission folder.

#### User Flow Links
- [UF-MISSION-001](./20-gui/web.md#uf-mission-001---mission-creation-flow)
- [UF-MISSION-002](./20-gui/web.md#uf-mission-002---mission-execution-flow)

#### Design Notes
- Review column shows PR status when PR mode
- Ready flag gates assignment

---

### FEAT-006 - Change Management: PR Mode and YOLO
- ID: FEAT-006
- Name: Change Management (PR/YOLO)
- Status: Shipped (MVP scope)

#### Intent
Let projects choose between direct commits for speed or PR-based flows for control, with AI reading PR comments.

#### Goals
- Optional PR mode per-project and per-mission override
- Auto-branch naming and PR creation in Review stage
- Read PR comments via gh CLI; iterate on changes
- YOLO mode for early-stage projects

#### Non-Goals
- Full in-app PR comment UI in MVP

#### Solution
If PR mode, create PR and surface status in UI; if rejection in app, prompt agent to read PR comments and iterate.

#### User Flow Links
- [UF-PR-001](./20-gui/web.md#uf-pr-001---pr-mode-workflow)

#### Transport Flow Links
- HTTP: GitHub REST via agent tools; no incoming webhooks required

#### Design Notes
- Merge strategies supported (merge/squash/rebase)
- Auto-delete branches post-merge (configurable)

---

### FEAT-007 - Real-time Communication
- ID: FEAT-007
- Name: Realtime Presence & Push
- Status: Shipped (MVP scope)

#### Intent
Use Monster Realtime for push-only presence and events; never for request/response RPC.

#### Goals
- Presence updates with available agents and activity
- Mission assignment push to workstations
- Project-wide workstation channels

#### Transport Flow Links
- WS channels: workstation:{id}, project:{id}:workstations, mission:{id}

#### Design Notes
- Web consumes push for status; all operations remain HTTP

---

### FEAT-008 - Project & Organization Management
- ID: FEAT-008
- Name: Projects & Orgs
- Status: Shipped (MVP scope)

#### Intent
Support multiple projects per org with member roles, project memory, and configuration defaults.

#### Goals
- Project creation/settings; org membership and roles
- Project memory; default flows/actors
- Workstation association to projects

#### User Flow Links
- [SR-PROJECTS](./20-gui/web.md#information-architecture)

---

### FEAT-009 - Configuration Management
- ID: FEAT-009
- Name: Configuration Management
- Status: Shipped (MVP scope)

#### Intent
Provide secure, typed configuration for CLI and per-project settings.

#### Goals
- CLI config in ~/.solo-unicorn/config.json
- Secure token storage via OS keychain
- Typed env via apps/*/env.ts (no process.env direct)

#### Transport Flow Links
- CLI commands: config get/set/list/reset

---

### FEAT-010 - Flow Review System
- ID: FEAT-010
- Name: Flow Reviews
- Status: Shipped (MVP scope)

#### Intent
Allow stages to require human review and provide a Review list with approve/reject and feedback.

#### Goals
- Per-stage review flags
- Review column, approve/reject with feedback
- Review history metadata (who/when/feedback)

#### Transport Flow Links
- MCP tool: request_review (agent-triggered)

---

### FEAT-011 - Solution & Tasks Document Management
- ID: FEAT-011
- Name: Solution & Tasks Docs
- Status: Shipped (MVP scope)

#### Intent
Persist rich solution write-ups and per-task notes on filesystem with DB progress tracking.

#### Goals
- FS: solo-unicorn-docs/missions/{id}/solution.md and tasks/{n}.md
- DB: solution TEXT, tasks JSON, tasks_current INT
- Cross-session context and version history via git

#### Design Notes
- Tasks fit a single agent session to avoid context bloat

---

### FEAT-012 - Public Projects & Access Control
- ID: FEAT-012
- Name: Public Projects & ACL
- Status: Shipped (MVP scope)

#### Intent
Enable public viewing and contribution with granular, role-based controls and workstation privacy settings.

#### Goals
- Visibility: private by default; opt-in public
- Roles: Public, Contributor, Collaborator, Maintainer, Owner
- Controls: mission read/write, workstation visibility, execution permissions, memory access
- Access requests with approval workflow

#### Transport Flow Links
- HTTP: /api/v1/public/* endpoints

#### Design Notes
- Permission checks in app layer; responses permission-aware and cacheable
 - Permission matrix (summary):
   - Read Missions: Public (conditional), Contributor+, Maintainer, Owner
   - Write Missions: Contributor*+, Collaborator+, Maintainer, Owner
   - Read Project Memory/Repository: Public (conditional) and above
   - View Workstations: Hidden | Status Only | Full Details (setting-based)
   - Execute Missions: Maintainer*, Owner
   - Manage Repositories/Permissions/Settings: Maintainer/Owner or Owner-only
 - Inheritance and overrides:
   - Role defaults with per-user overrides; org owners override within org; explicit user permissions can override role

---

### FEAT-013 - Public Project Discovery & Community
- ID: FEAT-013
- Name: Discovery & Community
- Status: Shipped (MVP scope)

#### Intent
Provide gallery, categories/tags, featured projects, metrics, and social actions (stars, follows) for public projects.

#### Goals
- Search/filter/sort gallery with pagination
- Templates library and one-click create-from-template
- Metrics and activity feeds; stars and follows

#### Transport Flow Links
- HTTP: GET /api/v1/public/projects, .../search, .../{slug}

---

### FEAT-014 - Public API Design & Security
- ID: FEAT-014
- Name: Public API & Security
- Status: Shipped (MVP scope)

#### Intent
Offer stable, versioned public endpoints with CORS, rate limits, and caching for high-traffic content.

#### Goals
- URL versioning (/api/v1)
- Rate limits with headers and burst (anon 100/hr/IP; auth 1000/hr; contributor+ 5000/hr)
- CORS and CSRF handling (public endpoints permissive origin; credentials supported)
- CDN caching and conditional requests (ETag/If-Modified-Since; smart invalidation; Vary headers)
- OpenAPI + interactive docs

#### Design Notes
- Permission-aware responses with Vary headers as needed
 - Response headers may include effective role when authenticated
 - Graceful degradation: anonymous gets reduced, non-error responses

---

### FEAT-015 - Development Server & Public Tunneling
- ID: FEAT-015
- Name: Dev Server & Tunneling
- Status: Shipped (MVP scope)

#### Intent
Expose local dev servers for preview via secure proxy/tunnel.

#### Goals
- CLI dev-server start/stop/status
- Public tunnel via Cloudflare Tunnel (MVP)
- Channel-based proxy path per workstation/project

#### Design Notes
- Cost-effective choice for MVP; no performance objectives

---

### FEAT-016 - Flow Templates & Prompt Strategy
- ID: FEAT-016
- Name: Flow Templates & Prompts
- Status: Shipped (MVP scope)

#### Intent
Treat flows/stages/prompts as versioned artifacts; allow static templates in MVP.

#### Goals
- Versioned flow/stage templates with semantic versions
- Static prompt templates in MVP; dynamic prompt fetch post-MVP

#### Design Notes
- Future: dynamic POST to client-hosted prompt endpoint. Example (post-MVP):
  - POST https://client-company.com/custom-prompt
  - Body: { mission: { id, title, description, tasks, solution }, stage, flow, workstation, repositoryId, additionalRepositoryIds, codeAgent }
  - Returns: { prompt: string }
