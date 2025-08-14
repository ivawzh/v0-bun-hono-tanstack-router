# Solo Unicorn — Simplified MVP Requirements

## Vision and Goal

Build a minimal, local-first task management system for dispatching coding tasks to AI agents. Extreme simplification: one user, one machine, one coding session at a time. Projects manage tasks through a simple 3-column board where agents automatically pick up and complete work.

- Single-user, single-machine, local-everything approach
- AI agents autonomously refine, plan, and execute tasks
- Zero setup complexity - just create project, configure repo agents, and start tasking

## Principles

- **Least Powerful Principle**: Only one user, one machine, one coding session at one time. Local everything. PostgreSQL database and repositories are on the same machine.
- **Think Small**: Ignore performance, cost, and scalability. Day-0 mindset with extreme simplicity.
- **Single-User Only**: No multi-user, permissions, or organizations.
- **Local-First**: Everything runs locally. No cloud dependencies beyond auth.
- **Reactive UXUI**: Upon user interaction, implement real-time UI updates either by
invalidating all queries or via WebSocket connections for immediate feedback and
responsive user experience.
- **Idempotency**: All operations safe to retry with proper deduplication.
- **Default Best Config**: Optimal defaults out-of-the-box, minimal configuration required.
- **Auth**: every endpoint/operation must pass through Monster Auth guard even though it's not yet perfect or implemented
- **Access control**: every S3 bucket or similar cloud storage must have at least a basic access control policy
- Tech stack:
  - Web: React + TanStack Router (apps/web)
  - UI: TailwindCSS + shadcn/ui component library
  - Server: Hono + oRPC (apps/server)
  - Runtime: Bun
  - ORM: Drizzle
  - Database: Local PostgreSQL
  - Validation: Valibot

## Database Implementation

- Local PostgreSQL only (no cloud production deployment)
- Prefer jsonb for flexible fields (`metadata`, `plan`, `config`)
- Minimal normalization - evolve as needed
- Fresh migrations - can delete and recreate database

## Core Entities

### Project
- Single board per project (no separate board entity)
- Project memory stored in database (viewable/editable by human)
- Contains configured repo agents and actors

### Repo Agent
- Combination of repository path + coding client (e.g., Claude Code, OpenCode)
- Examples: `/home/repos/todo` + Claude Code, `/home/repos/calendar` + Claude Code
- Only one active session per coding client type (rate limit enforcement)

### Actor
- Describes agent mindset, principles, focus, methodology, values
- Not bound to repo agent - assigned per card
- Default Actor for unspecified tasks

### Task (Card)
- Simple lifecycle: Todo → Doing → Done
- Doing has 3 stages: Refine → Kickoff → Execute
- Must have repo agent assigned
- Optional actor assignment
- "Ready" checkbox replaces auto-start/start agent buttons

## Default Actor

**Role**: Full-Stack Engineering Agent
**Mindset**: Pragmatic problem-solver focused on working solutions over perfect code
**Principles**:
- Understand before building - always refine requirements first
- List multiple solutions before committing to one approach
- Write clean, maintainable code following existing patterns
- Make small, frequent commits with clear messages
- Test as you go - don't leave broken states
**Focus**: Deliver functional features that solve real user problems
**Methodology**: Refine → Plan → Execute with clear documentation of decisions
**Values**: Simplicity, reliability, user experience, maintainable code

## Project Setup UX

1. **Create Project**: Simple name and description
2. **Configure Repo Agents**:
   - Add repository path + coding client combinations
   - Each repo agent represents one coding environment
   - Examples: "Main Repo (Claude Code)", "Frontend (OpenCode)"
3. **Configure Actors** (Optional):
   - Define agent personalities/methodologies
   - Assign to specific cards or use default
4. **Project Memory**:
   - Stored in database (not git submodule)
   - Viewable and editable by human
   - Included in every session prompt like CLAUDE.md
   - Agents can read/modify via MCP

## Task Workflow

### Human Creates Card
- Write raw title and optional raw description
- Add optional attachments
- Select repo agent (mandatory - limit 1 per card)
- Optionally select actor (or use default)
- Tick "Ready" checkbox when ready for AI pickup

### Agent Picks Up Card
Agents automatically pick up ready cards in priority order (P1-P5, then card order within column).

**Stage 1: Refine**
- Agent understands and refines the raw title/description
- Updates card with refined title and refined description
- Raw versions remain for reference
- Uses MCP to update card

**Stage 2: Kickoff**
- List solution options and rank them
- Select final solution approach
- Write spec if needed
- Store all kickoff work in card for reference
- Final solution and spec stored in card's `plan` field
- Interaction via MCP

**Stage 3: Execute**
- Real implementation using refined title, description, attachments, plan, actor, and project memory
- Make commits and push as needed
- Move to Done when complete

### Removed Features
- "Ask Human" button
- "Start Agent" button
- Separate boards (1 project = 1 board)
- Card Checklist, Comments, Questions sections
- QA requirement/column
- Pause Agent on single card
- Chat entirely
- CLAUDE_PROJECT_ID from Claude Code UI

## In-Scope (Simplified)

- **Core Entities**: Projects, repo agents, actors, tasks
- **3-Column Board**: Todo, Doing (with stages), Done
- **Agent Automation**: Autonomous pickup and execution
- **Project Memory**: Database-stored context for agents
- **Task Attachments**: File/image support
- **Priority System**: Unified P1-P5 priority
- **WebSocket Communication**: Real-time agent coordination
- **Single Active Session**: One coding session per client type
- **Authentication**: Monster Auth for single owner

## Out of Scope

- Multi-user support
- Multiple boards per project
- Chat/messaging system
- QA workflows
- Manual agent controls
- Cloud deployment
- Multiple active sessions
- Performance optimization

## Updated Data Model (UI-Aligned)

Key changes from UI/UX requirements:

### Task Model Updates

- **Status**: Include `qa`, remove `blocked` as status → `todo | in_progress | qa | done | paused`
- **New Fields**:
  - `is_blocked boolean default false` (blocked becomes a flag)
  - `qa_required boolean default false` (controls flow through QA column)
  - `agent_ready boolean default false` (card-level control for auto-start)

### Project Model Updates

- **New Fields**:
  - `agent_paused boolean default false` (project-level Pause All)
  - `local_repo_path text` (path to local git repository)
  - `claude_project_id text` (Claude Code project ID for linking)

### Agent Pool and Rate Limits

- Multiple `agent` rows represent the pool (single-user MVP may use one Claude Code agent)
- Agent-centric Rate-Limit Controller (Claude Code):
  - Enforce single active session (concurrency=1)
  - Persist agent state: `idle|starting|running|paused|rate_limited|error`
  - Record incidents in `agent_incidents` with fields: `agent_id`, `type=rate_limit|error`, `occurred_at`, `message`, `provider_hint`, `inferred_reset_at`, `next_retry_at`, `resolved_at`, `resolution`
  - On rate limit, compute ETA if possible; otherwise backoff with jitter (e.g., 5/10/20/40m; cap 60m)
  - Auto-resume by scheduled retries; log outcomes
  - UI: header chip with countdown, card “Needs attention” badge, drawer/banner with auto-resume ETA
  - Prevent auto-move to Done on ambiguous/failed runs; allow human confirm/reopen

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
  - Add: `agents.logIncident` (server records rate-limit/error)
  - Add: WebSocket `agent_incident` message from Claude Code → server persists, sets `agents.state=rate_limited`, `next_retry_at`
  - Add: UI surfaces agent down state and auto-resume ETA in project header and board banner
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

- **Development**: Local PostgreSQL (managed via pg-god)
- **Production**: Supabase PostgreSQL + Storage
- **Hosting**: Vercel (app + server functions)
- **Agent Runner**: Local Claude Code via Claude Code UI
- **Claude Code UI**: Integrated as git submodule at `/apps/claudecode-ui`
- **Environment**:
  - Database credentials
  - Monster Auth config
  - Solo Unicorn WebSocket URL for Claude Code UI
  - Agent authentication tokens

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
- ✅ Local development with PostgreSQL
- ✅ Production deployment to Vercel + Supabase
- ✅ Claude Code UI integration with WebSocket communication
- ✅ Project-level configuration for local repositories
- ✅ Claude Code hooks for automated task workflow

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

## Claude Code Integration Setup

### Prerequisites

1. Local PostgreSQL database (installed via pg-god)
2. Claude Code CLI installed globally
3. Node.js/Bun runtime for servers

### Setup Instructions

1. **Initialize Database**:
   ```bash
   npm run db:create:dev
   npm run db:push:dev
   ```

2. **Configure Claude Code UI**:
   ```bash
   cd apps/claudecode-ui
   cp .env.example .env
   # Edit .env to set SOLO_UNICORN_URL=ws://localhost:8500/ws/agent
   npm install
   npm run dev
   ```

3. **Start Solo Unicorn Server**:
   ```bash
   cd apps/server
   npm run dev
   ```

4. **Configure Project Integration**:
   - Navigate to Projects page in Solo Unicorn
   - Click settings icon on a project
   - Enter local repository path (e.g., `/home/user/my-repo`)
   - Enter Claude project ID (from Claude Code)
   - Save settings

5. **Task Workflow**:
   - Create task and assign to "Local Claude Code" agent
   - Click "Start Task" to dispatch to Claude Code
   - Claude Code UI automatically picks up the task
   - Task status updates in real-time via WebSocket

### Claude Settings

Custom settings and hooks are provided in `/apps/claude-settings/`:
- `task-pickup.sh`: Creates feature branch and task context
- `task-complete.sh`: Cleans up and notifies completion
- `claude-hooks.json`: Configuration for Claude Code hooks
- Configure by setting `CLAUDE_HOOKS_DIR` environment variable pointing to `/apps/claude-settings/`

### Development Workflow

1. Solo Unicorn creates and manages tasks
2. Tasks with configured projects auto-dispatch to Claude Code
3. Claude Code works in local repository
4. Progress updates stream back to Solo Unicorn
5. Completed tasks automatically update status

This integration enables seamless task management with local development using Claude Code as the AI agent executor.
