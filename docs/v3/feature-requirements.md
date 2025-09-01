# Solo Unicorn v3 Feature Requirements

## Document Purpose

This document captures high-level feature requirements that cover all public interfaces including CLI, Web UI, and future public APIs. The role of this document is to serve as the central registry for feature requirements and dependencies.

**Usage Pattern**: When adding new features, AI agents should:

1. **First**: Add requirements to this document
2. **Then**: Choose appropriate design documents (cli-design.md, web-design.md, db-design.md) to implement the feature
3. **Finally**: Update implementation documents with detailed specifications

This ensures comprehensive feature coverage across all interfaces and maintains consistency between CLI, Web, and API implementations.

## Core Feature Requirements

This project use oRPC `/rpc` for all internal HTTP communications. Only use `/api` for public third-party HTTP communications.

### 1. Authentication & Authorization

**Requirements**:

- Monster Auth integration with OAuth (Google) and email/password
- Personal access token support for CLI authentication
- Refresh token handling with automatic renewal
- Server-initiated token refresh via Monster Realtime
- Organization-based multi-tenancy
- Role-based access control (owner, admin, member)

**Interfaces**:

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

**Interfaces**:

- **CLI**: `start`, `stop`, `status`, `doctor` commands
- **Web**: Workstation status dashboard and management

### 3. Agent Orchestration

**Requirements**:

- Multiple AI agent types (only Claude Code for now)
- Agent rate limit detection and handling
- Agent installation and health checks

**Interfaces**:

- **CLI**: `agent scan`, `agent config` commands
- **Web**: Agent status display and configuration UI

### 4. Repository & Git Worktree Management

**Requirements**:

- GitHub repository integration (optional) with stable identification
- Git worktree support for parallel development
- Automatic repository cloning and worktree creation by AI agents
- Branch management and cleanup
- Repository access control per project

**Interfaces**:

- **CLI**: automatically clone/worktree repo when task is assigned with Github URL.
- **Web**: Repository configuration and worktree visualization

### 5. Task Management & Workflow

**Requirements**:

- Kanban-style task organization (Todo, Doing, Done, Loop)
- Default task modes (clarify, plan, execute, review). Task mode mainly determines prompt template.
- Default workflows - clarify → plan → execute → review
- Task dependencies and priority management
- Loop tasks for continuous project improvement and maintenance. So that users can maximize their code agent monthly budget.
- Careful task assignment. Task is ready based on depedencies, repo concurrency, and workstation/agent availability. Ordered by priority, list, and list order.

**Interfaces**:

- **CLI**: Task updates via MCP integration
- **Web**: Kanban board with drag-and-drop, task creation/editing

### 6. Change Management System

**Requirements**:

- Dual change management support: YOLO mode (direct to default branch) and PRs
- Automatic GitHub PR creation with task context
- AI agent view PR comments and implement changes.

**Interfaces**:

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

**Interfaces**:

- **CLI**: Register workspace to project
- **Web**: Project creation, settings, and member management

### 9. Real-time Communication

**Requirements**:

- Monster Realtime WebSocket integration
- Workstation presence and status updates
- Task assignment notifications
- Real-time UI updates for task status changes
- Channel-based communication architecture

**Interfaces**:

- **CLI**: WebSocket client for presence and task assignment
- **Web**: Real-time status updates via WebSocket
- **API**: system schema endpoint with API key based authentication

### 10. Configuration Management

**Requirements**:

- CLI config should be stored in `~/.solo-unicorn/config.json`.
- Local configuration files with TypeScript typing.
- Secure credential storage in OS keychain

**Interfaces**:

- **CLI**: `config get/set/list/reset` commands
- **Web**: Configuration UI for project and user settings
