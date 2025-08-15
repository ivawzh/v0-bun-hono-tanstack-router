# Solo Unicorn Project Overview

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
- **Reactive UXUI**: Upon user interaction, implement real-time UI updates either by invalidating all queries or via WebSocket connections for immediate feedback and responsive user experience.
- **Idempotency**: All operations safe to retry with proper deduplication.
- **Default Best Config**: Optimal defaults out-of-the-box, minimal configuration required.
- **Auth**: Every endpoint/operation must pass through Monster Auth guard
- Tech stack:
  - Web: React + TanStack Router (apps/web)
  - UI: TailwindCSS + shadcn/ui component library
  - Server: Hono + oRPC (apps/server)
  - Runtime: Bun
  - ORM: Drizzle
  - Database: Local PostgreSQL
  - Validation: Valibot
  - MCP: @modelcontextprotocol/sdk/server/mcp
  - WebSocket: Bun std `Bun.serve({ websocket })`

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
- **Think Small**: Ignore performance, cost, and scalability. Day-0 mindset with extreme simplicity.
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
Agents automatically pick up ready cards in priority order (5-1, then card order within column).

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
- **Priority System**: Unified 1-5 priority
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

## Simplified Data Model

### Projects
- `id`, `name`, `description`
- `memory` (jsonb) - project context for agents
- `created_at`, `updated_at`

### Repo Agents
- `id`, `project_id`, `name`
- `repo_path` (local file system path)
- `client_type` (enum: claude_code, opencode, etc.)
- `config` (jsonb) - client-specific settings
- `status` (enum: idle, active, rate_limited, error)

### Actors
- `id`, `project_id`, `name`
- `description` (agent personality/methodology)
- `is_default` (boolean)

### Tasks
- `id`, `project_id`, `repo_agent_id`, `actor_id`
- `raw_title`, `raw_description`
- `refined_title`, `refined_description`
- `plan` (jsonb) - kickoff results
- `status` (enum: todo, doing, done)
- `stage` (enum: refine, kickoff, execute) - only for doing status
- `priority` 1-5. With meaning of 1: Lowest, 2: Low, 3: Medium, 4: High, 5: Highest
- `ready` (boolean) - replaces auto-start
- `attachments` (jsonb array)
- `created_at`, `updated_at`

### Sessions
- `id`, `task_id`, `repo_agent_id`
- `status` (enum: starting, active, completed, failed)
- `started_at`, `completed_at`

## Code Agent Communication Architecture

### Claude Code UI WebSocket Server
- CCU originally uses WebSocket to communicate with both code agent shell, server and UI.
- Now we modify and add basic auth via env var `AGENT_AUTH_TOKEN` to its websocket server.
- Solo Unicorn server will connect to CCU websocket to get code agent information.

### Solo Unicorn MCP Server
- Solo Unicorn provides MCP server for code agents to push information to.
- Usage includes:
  - Update task status, stage, refined title, refined description, plan, code agent session id, etc.
  - Update code agent client type status (e.g. rate limit and rate limit reset time)

## API Endpoints

**Authentication**: All routes protected by Monster Auth

### Core Routes
- `GET/POST /api/projects` - Project CRUD
- `GET/POST /api/projects/:id/repo-agents` - Repo agent management
- `GET/POST /api/projects/:id/actors` - Actor management
- `GET/POST /api/projects/:id/tasks` - Task CRUD
- `PUT /api/tasks/:id/ready` - Toggle ready status
- `GET /api/tasks/:id/attachments` - File management

### MCP Integration
- `context.read` - Fetch project/task/memory
- `cards.update` - Update task fields during workflow
- `memory.update` - Modify project memory

## Development Setup

1. **Local PostgreSQL**: Create fresh database
2. **Solo Unicorn Server**: Start on port 8500 with WebSocket
3. **Solo Unicorn Web**: React app for task management
4. **Claude Code UI**: Adapt WebSocket client for communication

## Implementation Notes

- Delete existing migrations and start fresh
- Unify priority to P1-P5 everywhere
- Remove Claude project ID requirement
- Single coding session enforcement via WebSocket coordination
- Project memory replaces git submodule approach
