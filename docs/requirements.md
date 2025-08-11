# Solo Unicorn — MVP Requirements

## Vision and Goal

Build a web-based, agent-tasked workflow app with a Trello-inspired Kanban GUI for creating and dispatching coding tasks to AI agents. The MVP focuses on a board-first experience with a right-side task drawer for detailed task management and agent collaboration.

- Optimize for single-user, local-first usage with mobile-friendly access
- MVP supports a single owner, multiple projects, each with repositories and AI agents
- Use Solo Unicorn to recursively and continuously improve itself

## Principles

- Think small: ignore performance, cost, and scalability at MVP
- Single-user only (you)
- Local-first: primary usage from your environment; mobile browser occasionally
- Day-1 Auth: every endpoint/operation must pass through Monster Auth guard
- Tech stack (aligned with this repo):
  - Web: React + TanStack Router (apps/web)
  - UI: TailwindCSS + shadcn/ui component library
  - Server: Hono + oRPC (apps/server)
  - Runtime: Bun
  - ORM: Drizzle
  - Database: PGlite for local development; Supabase PostgreSQL for production
  - Hosting: Vercel (app + server functions), Supabase (DB/Storage)
  - Validation: Valibot
- Agent runner on personal Windows PC

## Database Implementation (Day-0 pragmatism)

- Prefer jsonb for flexible fields (`metadata`, `payload`, `config`, etc.)
- Minimize up-front normalization; evolve schema later as patterns stabilize
- Local dev DB: PGlite (embedded Postgres/WASM) to avoid external setup
- Production DB: Supabase PostgreSQL; seamless migration when ready
- Index selectively and defer advanced indexing
- Keep migrations small and reversible; refactor-friendly

## UI/UX Design (MVP)

### Board-First Approach

- **Primary View**: Trello-inspired Kanban board with drag-and-drop columns
- **Task Details**: Right-side slide-over drawer for fast drill-in and edits
- **Mobile**: Columns scroll horizontally; task opens in full-screen sheet

### Columns and Status

- **Status Lanes**: `Todo`, `In Progress`, `QA`, `Done`
- **Optional Lane**: `Paused` (collapsed by default)
- **Blocked Flag**: Boolean flag with ⛔ badge (not a separate column)
- **QA Flow**: Dedicated QA column; tasks can skip QA if not required

### Task Cards

- Display: Title, priority badge, stage chip, assignee avatar/name
- Badges: blocked (⛔), attachments count (📎), comments (💬), questions (❓)
- Controls: Auto-Start toggle, Agent Paused indicator
- Claude Code integration: "Open in Claude Code" link to active sessions

### Task Drawer (Slide-over)

Comprehensive task management with tabs:

- **Overview**: Description (Markdown + voice input), metadata, quick toggles
- **Kickoff**: Challenge idea, options list & ranking, selected option, spec (with history)
- **Checklist**: Stage-specific checklist items
- **Comments**: Task-scoped conversation with voice input support
- **Attachments**: Image thumbnails with preview, file uploads
- **Events**: Assignment history, status/stage changes, artifacts
- **Questions**: Agent questions to human, blocking workflow until answered

### Agent Controls

- **Per-Task**: Auto-Start toggle, Start/Pause Agent, Ask Human
- **Project-Level**: "Pause All Agents" suspends all agent activity
- **Session Linking**: Direct links to Claude Code sessions for active tasks

## In-Scope (MVP)

- **Core Entities**: Projects, repositories, boards, and tasks
- **Task Management**:
  - Status: `todo`, `in_progress`, `qa`, `done`, `paused`
  - Stages: `kickoff`, `spec`, `design`, `dev`, `qa`, `done`
  - Blocking flag (independent of status)
  - QA Required toggle (controls flow through QA column)
- **Agent Integration**:
  - Assign tasks to agents or humans
  - Start/pause agent sessions with Claude Code integration
  - Agent auto-start on stage triggers (configurable per task)
  - Project-wide agent pause controls
- **Collaboration Features**:
  - Task-scoped comments with voice input (OpenAI Audio API)
  - Agent questions that block workflow until human answers
  - Assignment history tracking
  - Attachment support with image preview
- **Kickoff Workflow**:
  - Structured kickoff process (challenge → options → selection → spec)
  - Persistent history of all kickoff iterations
  - Stage-specific checklists
- **Authentication**: Monster Auth (Google OAuth) for single owner
- **Mobile Support**: Responsive design with horizontal scrolling columns

## Out of Scope (MVP)

- Multi-user, permissions, and organizations
- Performance optimization and horizontal scale
- Robust CI/CD integrations and test orchestration
- Full Git integration beyond optional commit links
- Multiple concurrent agents or multi-tenant support
- Multiple chat channels (single project chat only)

## Updated Data Model (UI-Aligned)

Key changes from UI/UX requirements:

### Task Model Updates

- **Status**: Include `qa`, remove `blocked` as status → `todo | in_progress | qa | done | paused`
- **New Fields**:
  - `is_blocked boolean default false` (blocked becomes a flag)
  - `qa_required boolean default false` (controls flow through QA column)
  - `agent_ready boolean default false` (card-level control for auto-start)

### Project Model Updates

- **New Field**: `agent_paused boolean default false` (project-level Pause All)

### Agent Pool and Rate Limits

- Multiple `agent` rows represent the pool
- Track budget in `agent.config.rate_limits` (jsonb): `{ hourly: {limit, used}, weekly: {limit, used} }`
- UI shows "Agents: 2 online • Running 1" summary

### Assignment History

- Extend `task_event.type` to include `assigned | unassigned | reassigned`
- Payload includes `from`, `to`, and `by` for full audit trail

### Attachments

- Use `task_artifact kind=file` labeled as "Attachment" in UI
- `meta.contentType` enables image preview and thumbnails
- Support drag-and-drop and mobile upload

### Kickoff History

- Store structured entries under `task.metadata.kickoff`:
  - Arrays of timestamped records for: `challenge_md`, `options_md` (with ranks), `selected_option`, `spec_md`
- Mirror significant updates as `task_event` for auditability

### Chat Integration

New tables for project-level chat:

- `chat_channel`: id, scope_type `project|board|task`, scope_id, name, topic, created_at
- `chat_message`: id, channel_id, parent_message_id (threading), author `human|agent|system`, content_md, mentions jsonb[], at
- Mentions store canonical references: `{type:"agent|user|role", id, label}`

## Requirements Storage (Updated Decision)

**Selected Approach**: Git-based project wiki as submodule

- Each project has a dedicated wiki repository for requirements/documentation
- Project wiki repo added as git submodule in each code repository
- Benefits:
  - Version-controlled and reviewable
  - Claude Code and other agents can access via git submodule
  - Decoupled from code but easily accessible
  - Familiar Git workflow for documentation updates

Implementation:

- Link requirements docs from tasks via `task.metadata.requirement_refs`
- Support section anchors for specific requirement linking
- Agents can pull read-only access to wiki submodule for context

## Notification Strategy (Updated Decision)

**Selected Approach**: Both in-app and webhook notifications

- **In-App**: Real-time notifications for questions, blockers, stage changes
- **Webhook**: Configurable endpoints for external integrations
- **Future**: Email notifications as optional enhancement

Implementation:

- `notification` table with `channel` field supporting `inapp|webhook`
- Webhook payload format standardized for easy integration
- In-app notifications with real-time updates via WebSocket

## Voice Input Integration (Updated Decision)

**Selected Approach**: Server-side transcription via OpenAI Audio API

- **Scope**: Available on description fields, comment inputs, and chat
- **Implementation**: Toggle button (🎤) on supported text areas
- **Processing**: Audio sent to OpenAI Audio API for transcription
- **UX**: Real-time feedback with transcription insertion

## Agent Assignment (Updated Decision)

**Selected Approach**: Allow non-code agent assignments in MVP

- **Supported Roles**: PM, Designer, Architect, Engineer, QA agents
- **Implementation**: `agent.role` field with predefined roles
- **UI**: Role-based assignment dropdown and filtering
- **Future**: Custom role definitions and capabilities

## Core Workflows

1. **Project Setup**: Create project → add repositories → create boards → add tasks
2. **Task Assignment**: Assign to agent/human or allow agent claiming
3. **Stage Pipeline**: `kickoff → spec → design → dev → qa → done`
4. **Kickoff Process**: Challenge idea → list options → rank → select → write spec
5. **Agent Sessions**: Start agent → execute actions → produce artifacts → complete
6. **Human-in-Loop**: Questions block workflow until human answers
7. **QA Flow**: Tasks with `qa_required=true` must pass through QA column

## Stage Flow and Automation

- **Default Pipeline**: `kickoff → spec → design → dev → qa → done`
- **Stage Change Triggers**:
  - Notify assigned actor
  - Start/stop agent session based on `agent_ready` flag
  - Create next-stage checklist
  - Handle QA skip logic (if `qa_required=false`)
- **Agent Controls**:
  - Per-task auto-start toggle
  - Project-level pause all agents
  - Manual start/pause always available

## API Surface (MVP)

**Authentication**: All routes protected by `requireOwnerAuth()` or `requireAgentAuth()`

### Core Endpoints

- **Projects**: CRUD, list repositories
- **Boards**: CRUD, task management
- **Tasks**:
  - CRUD operations
  - Status/stage transitions with validation
  - Assignment management with history
  - Pause/resume with agent session control
  - Attachment upload and management
  - Comment threading
  - Question raising/resolution
- **Agent Sessions**: Start/stop, action streaming, Claude Code integration
- **Chat**: Channel management, message posting, threading, mentions
- **Notifications**: List, mark read, webhook configuration

### MCP Server Integration

Standardized interface for agent context and manipulation:

- `context.read` - Project/board/task/doc fetch
- `cards.*` - Task CRUD, status/stage management
- `cards.question.*` - Question raising/resolution
- `events.subscribe` - Real-time event streaming

## Authentication Implementation (Monster Auth)

Unchanged from previous requirements - using Monster Auth service with Google OAuth, secure HTTP-only cookies, and automatic JWT verification.

## Deployment

- **Development**: PGlite (no external DB required)
- **Production**: Supabase PostgreSQL + Storage
- **Hosting**: Vercel (app + server functions)
- **Agent Runner**: Windows service with gateway connection
- **Environment**: Supabase credentials, Monster Auth config, webhook secrets

## Acceptance Criteria (MVP)

### Board Experience

- ✅ Trello-inspired board with drag-and-drop between status columns
- ✅ Task cards show priority, stage, assignee, and badges (blocked, attachments, comments)
- ✅ Right-side drawer opens for task details with tabbed interface
- ✅ Mobile-friendly with horizontal column scrolling and full-screen task sheets

### Task Management

- ✅ Create/edit tasks with Markdown description and voice input
- ✅ Structured kickoff workflow with history preservation
- ✅ Stage-specific checklists with completion tracking
- ✅ Attachment support with image preview and file management
- ✅ Assignment history visible in Events tab

### Agent Integration

- ✅ Start/pause agent sessions from task drawer
- ✅ "Open in Claude Code" links to active sessions
- ✅ Agent questions block workflow until human responds
- ✅ Project-level "Pause All Agents" emergency stop
- ✅ Per-task auto-start toggle for agent automation

### Chat and Collaboration

- ✅ Project-level chat with titled threads (ChatGPT-style)
- ✅ Task-scoped comments in Kickoff tab
- ✅ @mention support for agents and roles
- ✅ Voice input on comment/chat fields

### Technical Requirements

- ✅ All routes protected by Monster Auth
- ✅ MCP servers for agent context and card manipulation
- ✅ Local development with PGlite
- ✅ Production deployment to Vercel + Supabase
- ✅ Windows agent runner integration

## Implementation Priority

### Phase 1 (Core Board)

1. Basic board with drag-and-drop columns
2. Task drawer with Overview and Events tabs
3. Agent assignment and session management
4. Authentication integration

### Phase 2 (Kickoff Workflow)

1. Structured kickoff process in drawer
2. Checklist management by stage
3. Question/answer workflow with blocking
4. Attachment support

### Phase 3 (Chat Integration)

1. Project-level chat with threading
2. Task-scoped comments
3. Voice input integration
4. @mention system

### Phase 4 (Polish)

1. Mobile responsiveness optimization
2. Claude Code session linking
3. Notification system (in-app + webhook)
4. Performance and UX refinements

This updated requirements document aligns with the detailed UI/UX wireframes and incorporates all the decisions from your open questions. The focus is now on delivering a polished, Trello-inspired experience with deep agent integration and comprehensive task management capabilities.
