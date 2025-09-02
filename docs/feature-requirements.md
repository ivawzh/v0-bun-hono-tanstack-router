# Solo Unicorn Feature Requirements

## Document Purpose

This document captures high-level feature requirements that cover all public interfaces including CLI, Web UI, and future public APIs. The role of this document is to serve as the central registry for feature requirements and dependencies.

**Usage Pattern**: When adding new features, AI agents should:

1. **First**: Add requirements to this document
2. **Then**: Choose appropriate design documents (cli-design.md, web-design.md, db-design.md) to implement the feature
3. **Finally**: Update implementation documents with detailed specifications

This ensures comprehensive feature coverage across all interfaces and maintains consistency between CLI, Web, and API implementations.

## Core Feature Requirements

### Communication Protocol Hierarchy

**Principle: Use least powerful approach** - Power order: WebSocket > API > oRPC > MCP

**Requirements**:

- **oRPC**: Internal communication (web ↔ server) when breaking changes acceptable (components update together)
- **REST API**: External communication (CLI ↔ server, third-party integrations) when backward compatibility required
- **WebSocket**: Real-time push notifications only (task assignments, status updates)
- **MCP**: AI agent communication only (task updates, project memory access)

**Implementation**:
- Use oRPC for all internal HTTP communications via `/rpc` endpoints
- Use REST API for external integrations via `/api` endpoints
- WebSocket for real-time updates only
- MCP for AI agent tools only

### 1. Authentication & Authorization

**Requirements**:

- Monster Auth integration with OAuth (Google) and email/password
- Personal access token support for CLI authentication (pat_abc123...)
- Organization API keys for service accounts (org_key_abc123...)
- Refresh token handling with automatic renewal
- Server-initiated token refresh via Monster Realtime
- Organization-based multi-tenancy
- Role-based access control (owner, admin, member)

**Public Interfaces**:

- **CLI**: `login`, `logout`, `whoami` commands with secure token storage
- **Web**: Login/logout UI with Monster Auth redirect flow
- **API**: JWT token validation and refresh endpoints

### 2. Workstation Management

**Requirements**:

- Workstation is user's machine that hosts code agents and repository worktrees. That is, coding happens on client side.
- Workstation registration and status tracking
- Workstation receive task push from server via Monster Realtime WebSocket. Code agents update tasks via MCP server.
- Real-time presence via Monster Realtime WebSocket
- Cross-platform support (Windows, macOS, Linux)
- Background daemon mode with system service integration

- Health monitoring and diagnostics

**Public Interfaces**:

- **CLI**: `start`, `stop`, `status`, `doctor` commands
- **Web**: Workstation status dashboard and management

### 3. Code Agent Orchestration

**Requirements**:

- Multiple AI code agent types (only Claude Code for now)
- Code agent rate limit detection and handling
- Code agent installation and health checks

**Public Interfaces**:

- **CLI**: `code-agent scan`, `code-agent config` commands
- **Web**: Code agent status display and configuration UI

### 4. Repository & Git Worktree Management

**Requirements**:

- GitHub repository integration (optional) with stable identification
- Git worktree support for parallel development
- Automatic repository cloning and worktree creation by AI code agents
- Branch management and cleanup
- Repository access control per project

**Public Interfaces**:

- **CLI**: automatically clone/worktree repo when task is assigned with Github URL.
- **Web**: Repository configuration and worktree visualization

### 5. Task Management & Workflow

**Requirements**:

- Kanban-style task organization (Todo, Doing, Review, Done)
- Default task modes (clarify, plan, code, review). Task mode mainly determines prompt template.
- Default workflow - clarify → plan → code → review
- User may add their own modes and workflows.
- Review system - any mode can optionally require human review
- Task dependencies and priority management
- Loop tasks with `is_loop` boolean flag for continuous project improvement and maintenance. So that users can maximize their code agent monthly budget.
- Future loop scheduling (once per day max, twice per hour max, etc.)
- Careful task assignment. Task is ready based on dependencies, repo concurrency, and workstation/code agent availability. Ordered by priority, list, and list order.
- Plan document management in filesystem (./solo-unicorn-docs/tasks/{task-id}/)

**Public Interfaces**:

- **CLI**: Task updates via MCP integration
- **Web**: Kanban board with drag-and-drop, task creation/editing, review UI
- **MCP**: Tools for task updates - plan, mode, list, etc.

### 6. Change Management System

**Requirements**:

- Dual change management support: YOLO mode (direct to default branch) and PRs
- Automatic GitHub PR creation with task context
- AI code agent view PR comments and implement changes.

**Public Interfaces**:

- **CLI**: PR status reporting and branch management
- **Web**: Change Management status badges and GitHub integration

### 7. Development Server & Public Tunneling

**Requirements**:

- Local development server hosting
- Local development tunneling to public URL (dev.solounicorn.lol) via Cloudflared CLI

### 8. Project & Organization Management

**Requirements**:

- Multi-project organization structure
- Project memory for shared context across tasks
- Project-specific configuration and defaults
- User invitation and role management
- Project archiving and lifecycle management

**Public Interfaces**:

- **CLI**: Register workspace to project
- **Web**: Project creation, settings, and member management

### 9. Real-time Communication

**Requirements**:

- Monster Realtime WebSocket integration
- Workstation presence and status updates
- Task assignment notifications
- Real-time UI updates for task status changes
- Channel-based communication architecture

**Public Interfaces**:

- **CLI**: WebSocket client for presence and task assignment
- **Web**: Real-time status updates via WebSocket
- **API**: system schema endpoint with API key based authentication

### 10. Configuration Management

**Requirements**:

- CLI config should be stored in `~/.solo-unicorn/config.json`.
- Local configuration files with TypeScript typing.
- Secure credential storage in OS keychain

**Public Interfaces**:

- **CLI**: `config get/set/list/reset` commands, workflow management commands
- **Web**: Configuration UI for project and user settings, workflow template editor

### 11. Workflow Review System

**Requirements**:

- **Review Points**: Any workflow mode can require human review
- **Review List**: Special kanban column for tasks awaiting review
- **Approval Flow**: Human reviews and approves/rejects with feedback
- **Workflow Continuation**: Approved tasks proceed to next mode automatically
- **Rejection Handling**: Rejected tasks return to doing list and current mode to iterate with feedback. PR comments are also used to guide the iteration.
- **Review History**: Track who reviewed, when, and with what feedback

**Public Interfaces**:

- **Web**: Review UI in kanban board, approval/rejection buttons
- **MCP**: `request_review` tool for code agents to trigger review

### 12. Plan Document Management

**Requirements**:

- **Hybrid Storage**: Plan content in filesystem, progress tracking in database
- **Filesystem Storage**: Plans stored in `./solo-unicorn-docs/tasks/{task-id}/`
- **Plan Structure**:
  - `plan.md`: Main plan with solution, spec, steps list
  - `steps/{n}.md`: Detailed step-by-step implementation plans
- **Database Progress Tracking**: Store plan steps summary and current progress in database:
  - `plan_steps_summary`: Array of one-liner step descriptions for UI display
  - `plan_current_step`: Current step number being worked on (total steps = array length)
- **Context Preservation**: Each step includes previous/next context
- **Version Control**: Plans tracked in git for history
- **Cross-Session Context**: Plans persist between code agent sessions
- **Server Prompting**: Server uses database plan progress to determine next prompts

**Public Interfaces**:

- **CLI**: Plan viewing commands, progress status
- **Web**: Plan viewer with step navigation
- **MCP**: `task_update` tool
