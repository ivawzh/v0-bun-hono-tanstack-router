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

**Principle: Use least powerful approach** - Power order: WebSocket > API & MCP > oRPC

**Requirements**:

- **oRPC**: Internal communication (web ↔ server) when breaking changes acceptable (components update together)
- **REST API**: External communication (CLI ↔ server, third-party integrations) when backward compatibility required
- **WebSocket**: Real-time push notifications only (mission assignments, status updates)
- **MCP**: AI agent communication only (mission updates, project memory access)

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
- Canonical identity by email (no separate authentication table); multiple OAuth providers are supported if they authenticate the same email address
- Authn via Monster Auth tokens; Authz in app layer (TypeScript)

**Public Interfaces**:

- **CLI**: `login`, `logout`, `whoami` commands with secure token storage
- **Web**: Login/logout UI with Monster Auth redirect flow
- **API**: JWT token validation and refresh endpoints

### 2. Workstation Management

**Requirements**:

- Workstation is user's machine that hosts code agents and repository worktrees. That is, coding happens on client side.
- Workstation registration and status tracking
- Workstation receive mission push from server via Monster Realtime WebSocket. Code agents update missions via MCP server.
- Real-time presence via Monster Realtime WebSocket
- Cross-platform support (Windows, macOS, Linux)
- Background daemon mode with system service integration
- Health monitoring and diagnostics

MVP decision: The server does not persist code agent configuration. Agent availability, versions, rate limits, and concurrency are reported by the workstation via presence/MCP and used at assignment time.

**Public Interfaces**:

- **CLI**: `workstation` commands
- **Web**: Workstation status dashboard and management

### 3. Code Agent Orchestration

**Requirements**:

- Multiple AI code agent types (only Claude Code for now)
- Code agent rate limit detection and handling
- Code agent installation and health checks

**Public Interfaces**:

- **CLI**: `agent scan`, `agent add` commands
- **Web**: Code agent status display and configuration UI

### 4. Repository & Git Worktree Management

**Requirements**:

- GitHub repository integration (optional) with stable identification
- Git worktree support for parallel development
- Automatic repository cloning and worktree creation by AI code agents
- Branch management and cleanup
- Repository access control per project
- Standardized repository identifier: repository_id = GitHub numeric repository ID (BIGINT)
- Code agents accept one main repository_id and optional additionalRepositoryIds[]

MVP decision: CLI auto-manages cloning and worktree creation on first mission for a new repo; no user-facing worktree commands.

**Public Interfaces**:

- **CLI**: automatically clone/worktree repo when mission is assigned for the repo the first time with Github URL.
- **Web**: Repository configuration and worktree visualization

### 5. Mission Management & Flow

**Requirements**:

- Kanban-style mission organization (Todo, Doing, Review, Done)
- Default mission stages (clarify, plan, code). Mission stage mainly determines prompt template.
- Default flow - clarify → plan → code
- User may add their own stages and flows.
- **Flow-First Mission Creation**: When creating a new mission, users first select a flow (e.g., "Standard Development", "Quick Fix", "Research & Analysis")
- **Optional Stage Selection**: After selecting a flow, users can optionally select a specific stage to start from, allowing them to skip earlier stages in the flow sequence
- Review system - any stage can optionally require human review
- Mission dependencies and priority management
- Loop missions with `is_loop` boolean flag for continuous project improvement and maintenance. So that users can maximize their code agent monthly budget.
- Future loop scheduling (once per day max, twice per hour max, etc.)
- Careful mission assignment. Mission is ready based on dependencies, repo concurrency, and workstation/code agent availability. Ordered by priority, list, and list order.
- Solution & Tasks document management in filesystem (./solo-unicorn-docs/missions/{mission-id}/)

MVP field model:
- title (human), description (human), spec (AI-refined)
- solution (chosen approach), tasks (array of tasks replacing steps), currentTask index

**Public Interfaces**:

- **CLI**: Mission updates via MCP integration
- **Web**: Kanban board with drag-and-drop, mission creation/editing, review UI
- **MCP**: Tools for mission updates - plan, stage, list, etc.

### 6. Change Management System

MVP PR Review Flow:
- Human reviewers approve/request changes in GitHub directly
- Solo Unicorn shows PR links/status; comments UI is Not in MVP
- To iterate, the human clicks Reject in Solo Unicorn with feedback; the server will push the mission back to the code agent with instructions to read PR comments using the GitHub CLI (`gh`)

**Requirements**:

- Dual change management support: YOLO mode (direct to default branch) and PRs
- Automatic GitHub PR creation with mission context
- AI code agent view PR comments and implement changes.

**Public Interfaces**:

- **CLI**: PR status reporting and branch management
- **Web**: Change Management status badges and GitHub integration

### 7. Development Server & Public Tunneling

**Requirements**:

- Local development server hosting
- Local development tunneling to public URL (dev.solounicorn.lol) via Cloudflared CLI

MVP tunneling choice: Use Cloudflare Tunnel (cloudflared) for cost-effectiveness and ease of setup. Support multi-tenancy and dynamic subdomains per project/workstation via Cloudflare configuration.

### 8. Project & Organization Management

**Requirements**:

- Multi-project organization structure
- Project memory for shared context across missions
- Project-specific configuration and defaults
- User invitation and role management
- Project archiving and lifecycle management

**Public Interfaces**:

- **CLI**: Register workspace to project
- **Web**: Project creation, settings, and member management

### 9. Real-time Communication

Note: oRPC endpoints are not pre-designed. Internal RPCs can be introduced ad hoc by AI agents as needed; MCP and REST are the primary stable interfaces.

**Requirements**:

- Monster Realtime WebSocket integration
- Workstation presence and status updates
- Mission assignment notifications
- Real-time UI updates for mission status changes
- Channel-based communication architecture

**Public Interfaces**:

- **CLI**: WebSocket client for presence and mission assignment
- **Web**: Real-time status updates via WebSocket
- **API**: system schema endpoint with API key based authentication

### 10. Configuration Management

**Requirements**:

- CLI config should be stored in `~/.solo-unicorn/config.json`.
- Local configuration files with TypeScript typing.
- Secure credential storage in OS keychain

MVP performance: Caching/optimizations are deferred to post-MVP.

**Public Interfaces**:

- **CLI**: `config get/set/list/reset` commands, flow management commands
- **Web**: Configuration UI for project and user settings, flow template editor

### 11. Flow Review System

**Requirements**:

- **Review Points**: Any flow stage can require human review
- **Review List**: Special kanban column for missions awaiting review
- **Approval Flow**: Human reviews and approves/rejects with feedback
- **Flow Continuation**: Approved missions proceed to next stage automatically
- **Rejection Handling**: Rejected missions return to doing list and current stage to iterate with feedback. PR comments are also used to guide the iteration.
- **Review History**: Track who reviewed, when, and with what feedback

**Public Interfaces**:

- **Web**: Review UI in kanban board, approval/rejection buttons
- **MCP**: `request_review` tool for code agents to trigger review

### 12. Solution & Tasks Document Management

**Requirements**:

- **Hybrid Storage**: Solution and tasks content in filesystem, progress tracking in database
- **Filesystem Storage**: Stored in `./solo-unicorn-docs/missions/{mission-id}/`
- **Structure**:
  - `solution.md`: Main solution write-up (supersedes plan.md)
  - `tasks/{n}.md`: Detailed task-by-task implementation notes (supersedes steps). Main purpose is to fit each task implementation into one AI code agent session context window thus avoid context compact and performance degradation.
- **Database Tracking**:
  - `solution` (TEXT)
  - `tasks` (JSON array of task descriptors)
  - `tasks_current` (current task index)
- **Context Preservation**: Each task includes previous/next context
- **Version Control**: Documents tracked in git for history
- **Cross-Session Context**: Persists between code agent sessions
- **Server Prompting**: Server uses database task progress to determine next prompts

**Public Interfaces**:

- **CLI**: Plan viewing commands, progress status
- **Web**: Plan viewer with step navigation
- **MCP**: `mission_update` tool

### 13. Public Projects & Access Control

**Requirements**:

- **Project Visibility**: Support private (organization-only) and public projects
  - **Default**: All projects are private by default
  - **Opt-in Public**: Project owners must explicitly enable public visibility
  - **Granular Controls**: Even public projects can restrict specific features

- **Granular Permissions**: Fine-grained access control for different project resources
  - **Mission Access**: Separate read/write permissions for missions
  - **Workstation Visibility**: Three levels - hidden, status only, full details
  - **Repository Access**: Control visibility of repository information
  - **Execution Permissions**: Control who can execute missions on workstations
  - **Memory Access**: Control access to project memory/documentation

- **Permission Levels**: Hierarchical role system with inheritance
  - **Public (Anonymous)**: Basic read-only access to public projects
  - **Contributor**: Community members who can create/edit missions
  - **Collaborator**: Trusted members with enhanced visibility
  - **Maintainer**: Project maintainers who can execute missions
  - **Owner**: Full project control including permission management

- **Workstation Privacy Controls**:
  - **Hidden**: Workstations completely invisible to non-owners (default)
  - **Status Only**: Show only online/offline status
  - **Full Details**: Show detailed workstation information and capabilities

- **Security Boundaries**: Public access must not expose sensitive data
  - **Workstation Security**: Local paths, environment variables, and sensitive config never exposed
  - **Organization Privacy**: Organization details remain private unless explicitly shared
  - **Rate Limiting**: Prevent abuse of public project features
  - **Audit Logging**: Track all access attempts and permission changes

- **Access Request System**: Allow users to request elevated permissions
  - **Self-Service Requests**: Users can request contributor/collaborator access
  - **Approval Workflow**: Project owners can approve/deny access requests
  - **Request History**: Track all permission requests and decisions
  - **Auto-Approval**: Optional automatic approval for contributor-level access

- **Permission Inheritance**: Smart permission resolution
  - **Default Permissions**: Role-based defaults with per-user overrides
  - **Organization Override**: Organization owners have full access to all projects
  - **Explicit Permissions**: Per-user permissions can override role defaults

**Detailed Permission Matrix**:

| Permission | Public | Contributor | Collaborator | Maintainer | Owner |
|------------|--------|-------------|--------------|------------|-------|
| Read Missions | ✓* | ✓ | ✓ | ✓ | ✓ |
| Write Missions | ❌ | ✓* | ✓ | ✓ | ✓ |
| Read Project Memory | ✓* | ✓ | ✓ | ✓ | ✓ |
| Read Repository Info | ✓* | ✓ | ✓ | ✓ | ✓ |
| View Workstations | Setting-based | Setting-based | ✓* | ✓ | ✓ |
| Execute Missions | ❌ | ❌ | ❌ | ✓* | ✓ |
| Manage Repositories | ❌ | ❌ | ❌ | ✓ | ✓ |
| Manage Permissions | ❌ | ❌ | ❌ | ❌ | ✓ |
| Project Settings | ❌ | ❌ | ❌ | ❌ | ✓ |

*Conditional on project settings

**Public Interfaces**:

- **CLI**: Public project browsing, permission-aware mission operations, access requests
- **Web**: Public project gallery, permission management UI, role-based feature access, request system
- **API**: Public project endpoints with permission validation, rate limiting, CORS support

### 14. Public Project Discovery & Community

Permission checks are performed in the application layer (TypeScript). SQL permission helper functions, if any, are reference-only and not used in MVP.

**Requirements**:

- **Project Gallery**: Comprehensive public project browsing
  - **Search & Filter**: By category, technology, activity level, completion rate
  - **Sorting Options**: Popularity, recent activity, stars, creation date
  - **Pagination**: Handle large numbers of public projects efficiently
  - **Preview Mode**: Quick project overview without full access

- **Project Templates**: Reusable project structures
  - **Template Creation**: Convert existing projects into reusable templates
  - **Template Library**: Curated collection of project templates
  - **One-Click Creation**: Create new projects from templates instantly
  - **Template Customization**: Modify templates during project creation

- **Featured Projects**: Curated showcase
  - **Editorial Control**: Admin-controlled featured project selection
  - **Quality Criteria**: High completion rates, good documentation, active maintenance
  - **Rotation System**: Regularly update featured projects
  - **Spotlight Stories**: Featured project case studies and success stories

- **Category & Tag System**: Organized project discovery
  - **Predefined Categories**: Web Development, Mobile App, AI/ML, DevOps, etc.
  - **Tag System**: Flexible tagging with technology stacks (React, TypeScript, Python)
  - **Category Stats**: Show project count and activity per category
  - **Tag Autocomplete**: Help users discover relevant tags

- **Project Metrics & Analytics**: Engagement tracking
  - **Activity Metrics**: Mission creation/completion rates, recent activity
  - **Community Metrics**: Contributor count, stars, forks (template usage)
  - **Progress Visualization**: Visual progress bars for mission completion
  - **Performance Indicators**: Success rates, average completion times

- **Community Engagement**: User interaction features
  - **Star System**: Users can star projects for bookmarking and popularity ranking
  - **Project Following**: Get notifications for project updates
  - **Contribution Tracking**: Track user contributions across public projects
  - **Community Profiles**: Show user's public project involvement

- **Project Sharing & Embedding**: External integration
  - **Public URLs**: Clean, memorable URLs for public projects
  - **Social Sharing**: Share project links with rich preview metadata
  - **README Integration**: Display project README prominently
  - **Project Badges**: Status badges for embedding in external sites

**Public Interfaces**:

- **CLI**:
  - Browse public projects: `solo-unicorn projects browse [--category] [--featured]`
  - Search projects: `solo-unicorn projects search "query"`
  - Star projects: `solo-unicorn projects star PROJECT_SLUG`
  - Create from template: `solo-unicorn projects create-from-template TEMPLATE_SLUG`

- **Web**:
  - Project gallery with advanced filtering and search
  - Template marketplace with preview and customization
  - Community dashboard showing user contributions
  - Social features for project engagement

- **API**:
  - Public project discovery endpoints (no auth required)
  - Template API for programmatic project creation
  - Analytics API for project statistics
  - Social API for stars, follows, and community features

### 15. Public API Design & Security

See also: docs/api-and-mcp-design.md (MCP-first design; REST as adapters).

**Requirements**:

- **Public Discovery Endpoints**: Authentication-optional API access
  - `GET /api/public/projects` - Browse public projects with filtering
  - `GET /api/public/projects/search` - Full-text search across public projects
  - `GET /api/public/projects/{slug}` - Get public project details
  - `GET /api/public/projects/{slug}/missions` - Get public missions (permission-aware)
  - `GET /api/public/categories` - List project categories and counts
  - `GET /api/public/featured` - Get featured projects list

- **Permission-Aware Responses**: API responses adapt to user authentication
  - **Anonymous**: Basic project info, completed missions, public documentation
  - **Authenticated**: Additional permissions based on role (contributor, collaborator, etc.)
  - **Graceful Degradation**: No authentication errors, just filtered responses
  - **Permission Headers**: Include user role in response headers when authenticated

- **Rate Limiting**: Prevent abuse while enabling legitimate usage
  - **Anonymous Users**: 100 requests/hour per IP
  - **Authenticated Users**: 1000 requests/hour per user
  - **Contributor+**: 5000 requests/hour for project contributors
  - **Burst Limits**: Allow short bursts for legitimate usage patterns
  - **Rate Limit Headers**: Include remaining quota in response headers

- **CORS Configuration**: Enable web embedding and third-party integrations
  - **Permissive CORS**: Allow requests from any origin for public endpoints
  - **Credential Support**: Support authenticated requests with credentials
  - **Preflight Handling**: Proper OPTIONS request handling for complex requests
  - **Security Headers**: CSRF protection for authenticated operations

- **Caching Strategy**: Optimize performance for high-traffic public content
  - **CDN Integration**: Cache public project data at edge locations
  - **Conditional Requests**: Support ETag and If-Modified-Since headers
  - **Cache Invalidation**: Smart cache busting when projects are updated
  - **Vary Headers**: Proper caching for permission-aware responses

- **API Versioning**: Maintain backward compatibility
  - **URL Versioning**: `/api/v1/public/projects` for stable public APIs
  - **Deprecation Strategy**: Clear timeline for API version lifecycle
  - **Migration Guide**: Help users upgrade between API versions

- **Documentation**: Comprehensive API documentation
  - **OpenAPI Spec**: Machine-readable API specification
  - **Interactive Docs**: Swagger UI for API exploration
  - **Code Examples**: Sample requests in multiple languages
  - **Authentication Guide**: Clear instructions for API key usage

**Security Considerations**:

- **Input Validation**: Strict validation of all API parameters
- **SQL Injection Prevention**: Parameterized queries for all database access
- **XSS Protection**: Sanitize all user-generated content in API responses
- **Information Disclosure**: Never expose sensitive data in public APIs
- **Audit Logging**: Log all API access for security monitoring
- **DDoS Protection**: Rate limiting and request throttling

**Public Interfaces**:

- **CLI**: Public API consumption for project discovery commands
- **Web**: Frontend uses same public APIs for consistency
- **Third-party**: Enable community tools and integrations

### 16. Flow Template System and Prompt Strategy

- Flow Templates with versioning; stages are versioned; prompts treated as code
- Store flow/stage versions with semantic versioning
- (Not in MVP) Dynamic Prompt Generation: Server can call client-hosted endpoint to fetch prompts dynamically given mission context
  - POST https://client-company.com/custom-prompt
  - Body: { mission: { id, title, description, tasks, solution }, stage, flow, workstation, repositoryId, additionalRepositoryIds, codeAgent }
  - Returns: { prompt: string }

MVP: Static prompt templates; dynamic prompt generation is deferred.
