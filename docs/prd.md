# Solo Unicorn Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Accelerate software delivery by 3x compared to traditional development through AI-assisted missions
- Enable both fast iteration (YOLO/direct push) and controlled development (PR mode) to fit different project maturity levels
- Provide a dynamic AI workflow framework that orchestrates AI agents through Kanban flows
- Enable public project discovery, community contribution, and reusable templates to grow the ecosystem
- Help solo founders build "Unicorn startups" by leveraging AI agents while maintaining human oversight

### Background Context

Solo Unicorn is an AI-centric platform that orchestrates AI agents through Kanban flows. It addresses critical challenges in modern software development including developer productivity bottlenecks, AI orchestration complexity, and the balance between speed and quality. The platform enables flexible development modes with Direct Push for rapid prototyping and PR mode for production-quality code with GitHub integration.

The solution is workstation-first, meaning AI agents run locally on user machines for privacy and performance, with the server orchestrating via Monster Realtime presence and WebSocket communication. This approach addresses workstation integration gaps that existing cloud-based solutions suffer from. The platform also features a hybrid documentation system where mission documentation is stored in both filesystem and database for progress tracking and contextual prompting.

**Note**: This project integrates with external Monster services that are hosted in separate repositories:
- **Auth**: Monster Auth. Read more at [Monster Auth](/monster-wiki/shared-services/monster-auth.md).
- **Websocket**: Monster Realtime. Read more at [Monster Realtime](/monster-wiki/shared-services/monster-realtime.md).
- **User uploads**: Monster Upload. Read more at [Monster Upload](/monster-wiki/shared-services/monster-upload.md).

These services are isolated from Solo Unicorn and must be integrated according to their respective documentation.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-09-09 | 1.0 | Initial PRD creation | PM |
| 2025-09-09 | 1.1 | Updated authentication requirements to align with Monster Auth integration, enhanced workstation and agent management specifications, detailed repository and git worktree management, refined mission management and flow system, enhanced PR mode and change management features, expanded public project and community features, and updated technical assumptions | PM |

## Requirements

### Functional

FR1: Users can authenticate using Monster Auth (OAuth, PAT, org API keys) with email as canonical identity
FR2: Users can create and manage organizations with org-based multi-tenancy
FR3: Users can create projects with private/public visibility settings and granular permission controls
FR4: Users can create missions with Kanban board organization (Todo/Doing/Review/Done)
FR5: Users can define and use customizable flows with stages (Clarify/Plan/Code) for missions
FR6: Users can configure optional human review points at any stage of a mission flow
FR7: Users can set up mission dependencies and priority ordering
FR8: Users can create loop missions for continuous project improvement and maintenance
FR9: Users can register and manage workstations with presence tracking
FR10: Users can link GitHub repositories with numeric repo_id identification
FR11: System automatically manages git worktrees on first mission per repo/branch
FR12: Users can configure both Direct Push mode and PR mode for mission execution
FR13: System automatically creates GitHub PRs when missions move to Review in PR mode
FR14: Users can reject missions in Solo Unicorn which triggers agent iteration via GitHub CLI
FR15: Users can manage code agents (scan, list, add) through CLI
FR16: Users can configure project settings including default flows and actors
FR17: Users can create and manage custom flow templates with versioning
FR18: Users can create and manage actor personas with specific methodologies
FR19: Users can browse and contribute to public projects with granular permissions
FR20: Users can request access to public projects with different permission levels
FR21: Users can star and use public projects as templates
FR22: System provides public discovery endpoints for browsing projects and missions
FR23: Users can configure repository-level PR settings (branch prefixes, target branches)
FR24: System automatically cleans up merged PR branches based on configuration
FR25: Users can view mission progress with solution and task tracking

### Non Functional

NFR1: System must achieve 99.9% uptime for core orchestration services
NFR2: Mission assignment must complete within 2 seconds under normal load
NFR3: WebSocket latency must remain under 100ms for real-time updates
NFR4: System must support 1,000+ concurrent workstations during peak usage
NFR5: Time-to-first-mission for new projects must be under 5 minutes
NFR6: 90%+ of missions must complete without human intervention in Direct Push mode
NFR7: PR mode average iteration times must be under 2 review cycles until approval
NFR8: Workstation online ratio must remain above 95%
NFR9: System must handle 10,000+ missions per day across all users
NFR10: Database queries for mission assignment must execute within 100ms
NFR11: System must support GitHub API rate limits through intelligent retry/backoff
NFR12: All authentication tokens must be securely stored using OS keychain integration
NFR13: System must implement strict app-layer permission checks for public mode
NFR14: System must prevent permission leakage in public mode through CORS and rate limiting
NFR15: CLI must provide cross-platform support (macOS, Linux, Windows)
NFR16: System must handle git/PR race conditions through clear branch naming and cleanup
NFR17: System must implement presence-driven scheduling for agent availability
NFR18: System must respect repository concurrency limits during mission assignment
NFR19: System must use static prompt templates in MVP with versioned flow templates
NFR20: System must provide explicit review points at stages to prevent flow/template complexity

## User Interface Design Goals

### Overall UX Vision

Solo Unicorn follows a Trello-like Kanban board interface with mission cards organized in Todo/Doing/Review/Done columns. The interface is mobile-first responsive design with a clean, modern aesthetic. Key interaction paradigms include drag-and-drop organization, modal-based mission creation and editing, and contextual badges for status indicators. The UI provides smart proactive design with pre-filled dropdowns when only one option exists.

### Key Interaction Paradigms

- Drag-and-drop Kanban board for mission organization
- Modal-based mission creation and editing with tabbed navigation
- Contextual badges for priority, stage, and process status
- Real-time updates through WebSocket connections
- Permission-aware views for public projects
- Mobile-friendly horizontal scrolling for Kanban boards

### Core Screens and Views

- Organization dashboard with project overview and workstation status
- Project Kanban board with mission cards and column organization
- Mission creation/editing modal with Base/Flow/Clarify/Plan/Review/Dependencies/Settings tabs
- Project settings modal with General/Members/Repositories/Actors/Flows tabs
- Workstation management view with agent and repository status
- Public project gallery with search and filtering capabilities
- Public project detail view with permission-aware mission browsing
- Access request flow for public project contribution

### Accessibility

WCAG AA

### Branding

Modern, clean aesthetic with pink/unicorn theme using the OKLCH color system. Brand elements include:
- Primary color: Pink (oklch(0.8988 0.0587 341.4299)) for key actions and highlights
- Secondary colors: Green (oklch(0.9672 0.0909 103.9278)) and blue (oklch(0.9519 0.0704 190.5613)) for accents
- Custom color palette with light and dark mode support using CSS variables
- Typography: Outfit for sans-serif, Fira Code for monospace
- Consistent rounded corners (0.725rem radius) and subtle shadows for depth
- Sidebar styling with distinct background (oklch(0.9260 0.1155 94.6447) in light mode, oklch(0.2755 0.0218 329.4324) in dark mode)

### Target Device and Platforms

Web Responsive

## Technical Assumptions

### Repository Structure

Monorepo

The project will use a monorepo structure with clear separation of concerns:
- `/web` - Web application frontend
- `/server` - Backend services and API
- `/cli` - Command-line interface
- `/shared` - Shared types and utilities
- `/docs` - Documentation

### Service Architecture

Web and Server on Lambda

The architecture consists of two main components:
- Web application - Frontend React application
- Server application - Backend services running on AWS Lambda
- Authentication is managed by shared service Monster Auth
- Real-time communication is managed by shared service Monster Realtime
- Server handles all other responsibilities including mission orchestration, project management, and public discovery endpoints
- Database - Shared PostgreSQL database with performance indexes

### Testing Requirements

Full Testing Pyramid

Testing strategy includes:
- Unit tests for all business logic with 80%+ coverage
- Integration tests for service interactions
- End-to-end tests for critical user flows
- Manual testing convenience methods for QA validation
- Automated CI/CD pipeline with testing at each stage

### Additional Technical Assumptions and Requests

1. Use TypeScript throughout the stack for type safety with strict typing and linting rules
2. Implement oRPC for internal service communication with breaking changes allowed for web-server interactions
3. Use REST API for external integrations with backward compatibility and proper versioning
4. WebSocket for real-time push notifications only with secure WSS connections and proper error handling
5. MCP for AI agent communication with versioned tool namespaces and proper error models
6. PostgreSQL database with NeonDB for alpha and AWS RDS for production with proper indexing and optimization
7. Cloudflare for frontend hosting and tunneling with proper security headers and CDN configuration
8. Bun-compiled CLI for cross-platform support with native secret manager integration for token storage
9. GitHub numeric repository ID as canonical identifier with multi-field storage for stability
10. Git worktrees for parallel development with smart pool management and automatic cleanup
11. Hybrid mission documentation (filesystem + DB tracking) with proper synchronization and version control
12. Server does not persist code agent configuration (client-side only) with availability reporting via presence
13. Agent availability, versions, and rate limits reported via workstation presence with periodic updates
14. Repository concurrency respected during mission assignment with database-level optimizations
15. Authentication implemented via Monster Auth tokens with JWT cookie storage for web and bearer tokens for CLI
16. Real-time communication integrated with Monster Realtime using dedicated channels and presence updates
17. Code agent configurations stored client-side in encrypted JSON files with backup and recovery options
18. Database locking mechanisms used for mission assignment to prevent race conditions
19. Performance-optimized queries for high-frequency operations with proper indexing strategies
20. Secure token storage using OS keychain integration with automatic refresh and rotation

## Epic List

Epic 1: Foundation & Core Infrastructure: Establish project setup, authentication, and basic user management with organization support
Epic 2: Mission Management Core: Create and manage missions with Kanban organization and flow system
Epic 3: Workstation & Agent Integration: Enable workstation registration, presence tracking, and code agent orchestration
Epic 4: Repository & Git Integration: Implement GitHub linking, worktree management, and repository concurrency controls
Epic 5: PR Mode & Change Management: Enable both Direct Push and PR modes with GitHub integration
Epic 6: Public Projects & Community Features: Implement public project discovery, permissions, and contribution system
Epic 7: CLI & Configuration Management: Develop command-line interface for workstation and agent management

## Epic 1 Foundation & Core Infrastructure

### Epic Goal

Establish the foundational infrastructure for Solo Unicorn including project setup, authentication with Monster Auth integration, and basic user management with organization support. This epic will deliver a working authentication system, organization creation and management, and the basic project structure needed for subsequent epics.

### Story 1.1 User Authentication with Monster Auth

As a new user,
I want to authenticate using Monster Auth with OAuth and personal access tokens,
so that I can securely access the Solo Unicorn platform.

#### Acceptance Criteria

1. Users can authenticate using Google OAuth through Monster Auth with redirect-based flow
2. Users can authenticate using email+password through Monster Auth
3. Users can authenticate using personal access tokens (pat_xxx) for CLI
4. Users can authenticate using organization API keys (org_key_xxx) for service accounts
5. Authentication tokens are securely stored using OS keychain integration
6. System implements refresh token handling with automatic renewal using Monster Auth JWKS verification
7. Server-initiated token refresh is supported via Monster Realtime
8. Email is used as canonical identity with support for multiple OAuth providers (Google, email+password)
9. Authn is implemented via Monster Auth tokens with Authz in app layer
10. System uses JWT tokens stored in secure HTTP-only cookies for web applications
11. System exchanges OAuth authorization codes for access/refresh tokens via Monster Auth exchange endpoint
12. System creates/updates local user records based on JWT payload from Monster Auth
13. System handles OAuth callback URLs with proper validation and state parameter protection
14. System supports both web (cookie-based) and CLI (bearer token) authentication flows
15. System implements proper CSRF protection using state parameters in OAuth flow

### Story 1.2 Organization Creation and Management

As an authenticated user,
I want to create and manage organizations with multi-tenancy support,
so that I can separate projects for different contexts or clients.

#### Acceptance Criteria

1. Users can create organizations with name and slug
2. Organizations support custom domains
3. Users can set organization owner email
4. Organizations support API keys for service accounts
5. Users can manage organization settings
6. System implements organization-based multi-tenancy
7. Role-based access control is supported (owner, admin, member)
8. Users can invite members to organizations
9. Invited users can accept or reject invitations

### Story 1.3 Project Creation and Basic Management

As an organization member,
I want to create and manage projects with basic settings,
so that I can organize my work within the organization.

#### Acceptance Criteria

1. Users can create projects within organizations
2. Projects have name, description, and URL-safe slug
3. Projects support private visibility by default
4. Users can update project details
5. Users can archive projects
6. System implements project-level access control
7. Basic project settings management is available
8. Projects are linked to organizations with proper tenancy

## Epic 2 Mission Management Core

### Epic Goal

Create and manage missions with Kanban organization and flow system. This epic will deliver the core mission management functionality including the Kanban board interface, mission creation and editing, flow templates, and basic mission organization.

### Story 2.1 Kanban Board Implementation

As a project member,
I want to view and organize missions using a Trello-like Kanban board,
so that I can easily track work progress across Todo/Doing/Review/Done states.

#### Acceptance Criteria

1. Kanban board displays four columns: Todo, Doing, Review, Done with proper styling and responsive design
2. Mission cards show title, priority, stage, description, and PR status badges when applicable
3. Users can drag and drop missions between columns with visual feedback and validation
4. Todo column has special split sections for Normal/Loop missions with collapsible UI
5. Cards display priority with emoji+number format (P Highest to P Lowest) and color coding
6. Cards show stage badges (Clarify, Plan, Code) and process badges with click-to-flow functionality
7. Mobile-friendly horizontal scroll implementation with snap points and touch gestures
8. Real-time updates through WebSocket connections with proper error handling and reconnection
9. Column height is fixed and scrollable with smooth scrolling behavior
10. Cards include GitHub PR links and status indicators for PR mode missions
11. Board supports real-time presence indicators for team members currently viewing
12. Column headers show mission counts and filtering options
13. Cards support attachment previews and quick action menus
14. Kanban board follows responsive design with proper mobile adaptation

### Story 2.2 Mission Creation and Editing

As a project member,
I want to create and edit missions with detailed information,
so that I can properly define work items for AI agents.

#### Acceptance Criteria

1. Users can create missions with title, description, spec, and attachments through modal interface
2. Missions support priority levels (1-5 with 5 being highest) with visual indicators
3. Missions can be assigned to different lists (Todo, Doing, Review, Done, Loop) with default Todo
4. Missions support repository assignment with smart defaults based on project configuration
5. Users can edit mission details after creation with proper version tracking
6. Missions support file attachments with drag-and-drop upload and preview capabilities
7. System validates required fields during creation with clear error messaging
8. Users can delete missions they have permission to modify with confirmation dialogs
9. Mission metadata is properly tracked (ID, created/updated timestamps, author information)
10. Creation form includes smart defaults and pre-filled dropdowns when only one choice exists
11. Missions support rich text descriptions with GitHub-style markdown and file references
12. System provides attachment management with size limits and file type validation
13. Editing interface supports tabbed navigation for different mission aspects (Base, Flow, Dependencies, etc.)
14. Real-time collaboration indicators show when others are editing the same mission

### Story 2.3 Flow System Implementation

As a project member,
I want to use customizable flow templates with stages for missions,
so that I can guide AI agents through structured development workflows.

#### Acceptance Criteria

1. System provides default flow templates (Standard Development, Quick Fix, Research & Analysis) with pre-configured stages
2. Users can create custom flow templates with named stages and customizable sequences
3. Flows support per-stage review requirements with granular control over approval processes
4. Users can enable/disable specific stages in flows with visual toggles and dependency validation
5. Users can skip to later stages in flow sequences with proper validation and warnings
6. Flow templates support versioning with change tracking and rollback capabilities
7. Missions are associated with specific flows with clear visual indicators and navigation
8. System implements default flow (Clarify → Plan → Code) with sensible defaults for new projects
9. Users can modify flow configuration per mission through the Flow tab in mission view
10. Flow usage statistics are tracked with mission counts and completion rates per flow
11. Flow editor supports drag-and-drop reordering of stages with real-time preview
12. System provides flow validation to prevent circular dependencies and invalid configurations
13. Users can duplicate and modify existing flows to create new templates
14. Flow templates support custom prompt templates for each stage with versioning

### Story 2.4 Mission Dependencies and Priority Management

As a project member,
I want to set up mission dependencies and manage priorities,
so that work is properly sequenced and important items are addressed first.

#### Acceptance Criteria

1. Users can create dependencies between missions (blocks, relates_to) through dependency picker UI
2. System prevents circular dependencies with real-time validation and clear error messages
3. Missions with unresolved dependencies are blocked from execution with visual indicators
4. Users can set mission priorities (1-5 with 5 being highest) with color-coded priority badges
5. System respects priority ordering during mission assignment with proper sorting algorithms
6. Users can reorder missions within lists using drag-and-drop with visual feedback
7. Dependency status is visually indicated on mission cards with clear progress indicators
8. Users can resolve dependencies when completed through dependency management interface
9. System automatically updates dependency status when missions complete with real-time notifications
10. Dependency visualization shows relationship graphs for complex dependency chains
11. Users can filter missions based on dependency status (blocked, ready, completed)
12. System provides dependency conflict resolution tools for complex scenarios
13. Priority management includes bulk priority updates and priority-based sorting options

## Epic 3 Workstation & Agent Integration

### Epic Goal

Enable workstation registration, presence tracking, and code agent orchestration. This epic will deliver the workstation management functionality including registration, presence updates, and the ability to orchestrate AI agents for mission execution.

### Story 3.1 Workstation Registration and Management

As a user,
I want to register and manage workstations through the CLI,
so that I can connect my local development environment to Solo Unicorn.

#### Acceptance Criteria

1. Users can register workstations using `solo-unicorn workstation register` with optional name and force flags
2. System collects workstation system info (OS, arch, hostname, platform version, CLI version)
3. Workstations are associated with authenticated users/organizations
4. Users can view workstation status and details including network info and connection status
5. Workstations support friendly naming with auto-generated names if not provided
6. Users can unregister workstations
7. System generates unique workstation IDs (ULID format)
8. Workstation registration integrates with Monster Realtime and stores registration tokens
9. Users can force re-registration of existing workstations
10. System stores workstation configuration in `~/.solo-unicorn/config.json`
11. Registration process automatically performs authentication if not already logged in
12. System validates workstation compatibility and CLI version during registration

### Story 3.2 Workstation Presence and Real-time Communication

As a workstation operator,
I want my workstation to report presence and receive real-time updates,
so that the system knows when I'm available for mission assignment.

#### Acceptance Criteria

1. Workstations connect to Monster Realtime WebSocket gateway using secure WSS connections
2. Workstations send periodic presence updates every 30 seconds with exponential backoff on failures
3. Presence includes status (online, busy, offline) with detailed sub-status information
4. Presence includes available code agents with type, name, availability, and rate limit status
5. Presence includes active projects and current mission count
6. Workstations receive mission assignment notifications through dedicated channels
7. System tracks workstation last seen times and last heartbeat timestamps
8. Presence updates include dev server port when active and public tunnel URL
9. Workstations handle connection retries with exponential backoff and error recovery
10. Presence data includes workstation metadata (OS, arch, CLI version) for compatibility checking
11. System supports multiple channels per workstation (workstation-specific, project-wide, mission-specific)
12. Realtime member keys are properly formatted for Monster Realtime integration

### Story 3.3 Code Agent Detection and Management

As a workstation operator,
I want to scan for and manage code agents on my workstation,
so that I can use different AI agents for mission execution.

#### Acceptance Criteria

1. Users can scan for available agents using `solo-unicorn agent scan` with automatic detection of installed agents
2. System detects Claude Code, Cursor, and OpenCode agents with version information
3. Users can list registered agents with `solo-unicorn agent list` showing health status and configuration
4. Users can add agents with `solo-unicorn agent add TYPE` with optional version specification
5. Agent configurations are stored client-side in `~/.solo-unicorn/code-agents.json` with encryption for sensitive data
6. Agents report availability, versions, rate limits, and concurrency via presence updates
7. System tracks agent health status, mission completion statistics, and average mission duration
8. Users can enable/disable agents with configuration persistence
9. Agent configurations include environment variables, executable paths, and custom settings per agent type
10. System performs periodic health checks on registered agents with configurable intervals
11. Agent configurations support custom settings for each supported agent type (Claude Code, Cursor, OpenCode)
12. System provides detailed logging and error reporting for agent operations
13. Agent scanning supports multiple platforms (macOS, Linux, Windows) with platform-specific detection logic

### Story 3.4 Mission Assignment and Orchestration

As a system,
I want to assign missions to available workstations and code agents,
so that AI agents can execute development tasks.

#### Acceptance Criteria

1. System identifies ready missions that are not currently assigned using optimized database queries
2. System matches missions to workstations based on project access and workstation availability
3. System considers agent availability, rate limits, and concurrency reported via workstation presence
4. System respects repository concurrency limits with per-repository active mission tracking
5. System prioritizes missions based on priority, list ordering, and creation time
6. Missions are assigned through Monster Realtime WebSocket channels with proper error handling
7. System tracks mission assignment status (INACTIVE, PUSHING, ACTIVE) with timestamp tracking
8. Timeout detection resets stuck missions based on configurable time thresholds
9. Mission assignment considers dependencies, review requirements, and agent capabilities
10. System uses database locking mechanisms to prevent race conditions during assignment
11. Assignment logic considers code agent type compatibility and language support
12. System maintains detailed statistics on mission assignment success/failure rates
13. Assignment process includes validation of workstation repository access and worktree availability
14. System supports complex assignment queries with embedded subqueries for performance optimization

## Epic 4 Repository & Git Integration

### Epic Goal

Implement GitHub linking, worktree management, and repository concurrency controls. This epic will deliver the repository integration functionality including linking GitHub repositories, managing git worktrees, and respecting concurrency limits during mission execution.

### Story 4.1 GitHub Repository Linking

As a project member,
I want to link GitHub repositories to my projects,
so that AI agents can work with my codebase.

#### Acceptance Criteria

1. Users can add GitHub repositories using `solo-unicorn repo add GITHUB_URL` with optional path specification
2. System validates repository access and permissions using authenticated user's GitHub credentials
3. Repositories are identified by GitHub numeric repo ID (BIGINT) as the canonical identifier
4. Repository information includes owner, name, full_name, clone URL, and webhook integration details
5. Users can list linked repositories with status and last accessed information
6. Users can remove repository links with proper cleanup of associated data
7. System tracks repository status (active, inactive, error) with detailed error messaging
8. Repository information is stored with multiple identifiers for stability and redundancy
9. Repositories support default branch configuration with validation against remote branches
10. System supports GitHub webhook integration for PR synchronization and event handling
11. Repository linking includes permission validation and access token management
12. System caches repository permissions and updates them periodically
13. Repository configuration supports PR mode settings and branch management policies

### Story 4.2 Git Worktree Management

As a workstation operator,
I want the system to automatically manage git worktrees,
so that I can work on multiple missions for the same repository simultaneously.

#### Acceptance Criteria

1. System automatically creates worktrees on first mission for a repo/branch with proper initialization
2. Worktrees follow naming scheme (repo-branch) with configurable workspace paths
3. System reuses existing worktrees for same branches when possible to optimize disk usage
4. System cleans up unused worktrees after 7+ days with proper validation and user notifications
5. Worktree pool maintains 3 vacant worktrees per repo for efficient resource allocation
6. Maximum worktrees per repo = maxConcurrencyLimit + 3 with dynamic pool sizing
7. Missions are routed to appropriate worktrees based on target branch with fallback logic
8. Worktree status is tracked (creating, ready, busy, error) with detailed error reporting
9. Users can view worktree information through workstation status including path and branch details
10. System tracks worktree usage statistics and active mission counts per worktree
11. Worktree management includes proper cleanup procedures for failed or corrupted worktrees
12. System supports worktree synchronization with remote branches and conflict resolution
13. Worktree operations are atomic with proper rollback mechanisms on failures

### Story 4.3 Repository Concurrency Controls

As a system,
I want to respect repository concurrency limits during mission assignment,
so that I don't overwhelm repositories with simultaneous operations.

#### Acceptance Criteria

1. Repositories support max_concurrent_missions configuration (default 1) with per-repository customization
2. System tracks active missions per repository using optimized database queries and indexes
3. Mission assignment considers repository concurrency limits with real-time validation
4. Workstation presence reports repository access and available worktrees for concurrency planning
5. System prevents assignment of missions that would exceed concurrency limits with proper queuing
6. Repository concurrency is respected across all workstations with centralized tracking
7. Users can configure repository-specific concurrency limits through project settings UI
8. System tracks last mission push times per repository for intelligent scheduling
9. Concurrency limits are enforced during mission assignment queries with database-level optimizations
10. System provides detailed monitoring and alerting for repository concurrency issues
11. Concurrency tracking includes both active and pushing mission states for accurate counting
12. Repository concurrency logic supports complex assignment scenarios with multiple dependencies

## Epic 5 PR Mode & Change Management

### Epic Goal

Enable both Direct Push and PR modes with GitHub integration. This epic will deliver the change management functionality including dual workflow support, automatic PR creation, and integration with GitHub review processes.

### Story 5.1 Dual Workflow Support (Direct Push vs PR Mode)

As a project member,
I want to choose between Direct Push and PR modes for mission execution,
so that I can balance speed and control based on project maturity.

#### Acceptance Criteria

1. Projects support default PR mode configuration (disabled, enabled) with project-level settings UI
2. Users can override PR mode per mission through mission creation and editing interfaces
3. Direct Push mode commits directly to target branch with immediate code deployment
4. PR mode creates feature branches and GitHub PRs with proper naming conventions
5. System supports both modes simultaneously with clear visual indicators for each mission
6. Users can configure PR mode at project level with repository-specific overrides
7. Mission cards visually indicate current mode with distinct badges (⚡ Direct, 🔄 PR)
8. Mode selection is available during mission creation with smart defaults
9. System handles mode switching appropriately with proper validation and warnings
10. PR mode supports configurable branch prefixes and target branch selection
11. System provides mode comparison documentation and recommendations for different use cases
12. Project settings include detailed PR configuration options (auto-merge, branch cleanup, etc.)
13. Mode indicators show PR status (pending, approved, merged, rejected) with links to GitHub

### Story 5.2 GitHub PR Creation and Management

As a system,
I want to automatically create GitHub PRs for missions in PR mode,
so that human reviewers can examine and approve code changes.

#### Acceptance Criteria

1. System creates feature branches with `solo-unicorn/mission-{id}-{slug}` naming convention
2. System creates GitHub PRs when missions move to Review column with proper automation
3. PRs include mission context, description, and links back to Solo Unicorn for traceability
4. System tracks PR status (open, closed, merged, draft) with real-time synchronization
5. PR information is stored in github_pull_requests table with comprehensive metadata
6. Branch cleanup occurs after successful merge based on configuration settings
7. System supports merge, squash, and rebase strategies with user-configurable defaults
8. PR creation respects target branch configuration with validation against repository settings
9. Users can view PR links from mission cards with one-click navigation to GitHub
10. System handles PR creation failures with proper error reporting and retry mechanisms
11. PR templates support custom content with mission-specific information and context
12. System monitors PR activity and updates mission status accordingly
13. PR creation includes proper labeling and assignment based on project configuration
14. System supports draft PR creation for work-in-progress missions

### Story 5.3 GitHub PR Review Integration

As a human reviewer,
I want to review and provide feedback on GitHub PRs,
so that I can ensure code quality and guide AI agent improvements.

#### Acceptance Criteria

1. Human reviewers approve/request changes directly in GitHub with standard GitHub review process
2. Solo Unicorn shows PR links and status on Review/Done cards with real-time updates
3. Users can reject missions in Solo Unicorn with feedback through dedicated rejection interface
4. Rejected missions trigger agent iteration via GitHub CLI with proper comment parsing
5. System reads PR comments using `gh` command with authentication and error handling
6. Agents implement specific requested changes with targeted code modifications
7. System supports multiple review cycles with iteration tracking and history
8. Review history is tracked with who reviewed, when, and what feedback was provided
9. Users can view review status and feedback in UI with detailed comment threads
10. System provides intelligent feedback processing to extract actionable items from comments
11. Review integration supports both individual and team review workflows
12. System handles merge conflicts and provides resolution assistance when possible
13. Review notifications are sent to relevant stakeholders with configurable preferences
14. System supports review deadline tracking and escalation for time-sensitive missions

### Story 5.4 PR Configuration and Settings

As a project member,
I want to configure PR settings at project and repository level,
so that I can customize the PR workflow for my team's needs.

#### Acceptance Criteria

1. Projects support default PR mode configuration with granular control options
2. Repositories support PR mode enabled/disabled settings with inheritance from project
3. Users can configure branch prefixes (default: solo-unicorn/) with validation and preview
4. Users can set target branches for PRs with smart defaults and branch protection awareness
5. System supports auto-merge configuration with status check requirements
6. Branch deletion after merge can be configured with retention policies
7. PR templates can be customized with mission context and team-specific information
8. Review requirements can be configured per stage with mandatory review settings
9. PR settings are available in project/repository settings UI with clear organization
10. System provides PR configuration validation and conflict detection
11. Configuration includes merge strategy preferences (merge, squash, rebase) with defaults
12. Settings support webhook integration for extended PR workflow automation
13. Configuration changes are tracked with audit logs and change history
14. System provides PR workflow recommendations based on project maturity and team size

## Epic 6 Public Projects & Community Features

### Epic Goal

Implement public project discovery, permissions, and contribution system. This epic will deliver the community functionality including public project browsing, granular permissions, and contribution workflows.

### Story 6.1 Public Project Visibility and Discovery

As a user,
I want to browse and discover public projects,
so that I can find interesting projects and contribute to the community.

#### Acceptance Criteria

1. Projects support private (default) and public visibility with clear toggle controls
2. Public projects have unique URL slugs with validation and conflict resolution
3. Users can browse public projects with search and filtering by category, tags, and activity
4. Project gallery supports category and tag browsing with visual categorization
5. Users can star public projects with starring tracking and notifications
6. Featured projects are highlighted in gallery with editorial curation controls
7. Public projects support basic discovery endpoints with proper rate limiting and CORS
8. Users can view project details without authentication with permission-aware content
9. System tracks project views and engagement metrics with analytics dashboard
10. Public project gallery includes sorting options (popularity, recent activity, stars)
11. Search functionality supports full-text search across project metadata and descriptions
12. Gallery supports pagination and infinite scroll for large project collections
13. Users can follow projects for updates with notification preferences
14. System provides project preview cards with key metrics and progress indicators

### Story 6.2 Granular Permission System

As a project owner,
I want to control access to my projects with granular permissions,
so that I can enable community contribution while protecting sensitive information.

#### Acceptance Criteria

1. Projects support permission levels (Public, Contributor, Collaborator, Maintainer, Owner) with detailed role descriptions
2. Users can configure granular permissions for different resources with fine-grained control
3. Permission matrix controls access to missions, repositories, workstations with clear boundaries
4. Workstation visibility can be controlled (hidden, status_only, full_details) with privacy settings
5. Users can invite contributors with different permission levels through email or username
6. Self-service access requests are supported with approval workflow and notifications
7. Auto-approval can be configured for contributor access with customizable criteria
8. Permission inheritance follows organizational hierarchy with proper override mechanisms
9. System enforces permission checks in application layer with strict validation
10. Permission management includes audit logging and change history tracking
11. Users can set expiration dates for temporary access permissions
12. System provides permission conflict detection and resolution tools
13. Role-based access control supports custom roles with definable permissions
14. Permission settings include rate limiting and abuse prevention controls

### Story 6.3 Public Project Contribution Workflow

As a community member,
I want to contribute to public projects with appropriate permissions,
so that I can help improve projects I'm interested in.

#### Acceptance Criteria

1. Users can request access to public projects at different permission levels through self-service requests
2. Project owners can approve/deny access requests with feedback and reasoning
3. Auto-approval is supported for contributor level with configurable criteria
4. Contributors can create and edit missions with proper validation and permissions
5. Collaborators can review missions and see workstation status based on visibility settings
6. Maintainers can execute missions on workstations with proper authorization
7. Users can view permission-aware mission lists with filtered content based on access level
8. Contribution activity is tracked and displayed with contribution statistics and history
9. Users can follow projects for updates with notification preferences and frequency controls
10. System provides contribution guidelines and onboarding materials for new contributors
11. Contribution workflow includes code of conduct enforcement and moderation tools
12. Users can report issues and suggest improvements through integrated feedback systems
13. System tracks contributor reputation and provides recognition for valuable contributions
14. Contribution activity feeds show recent community activity and project progress

### Story 6.4 Project Templates and Reuse

As a user,
I want to use public projects as templates for my own projects,
so that I can get started quickly with proven project structures.

#### Acceptance Criteria

1. Public projects can be marked as templates with template-specific metadata and documentation
2. Users can create new projects from templates with one-click creation and customization wizard
3. Template creation converts existing projects with proper template validation and quality checks
4. Users can customize templates during project creation with parameterized configuration options
5. Template library showcases popular templates with search, filtering, and categorization
6. Template usage is tracked and displayed with adoption statistics and success metrics
7. Users can star and share templates with community engagement features
8. Template metadata includes categories, tags, compatibility information, and usage instructions
9. One-click creation from templates is supported with smart defaults and parameter prompting
10. Template versioning supports updates and backward compatibility with migration paths
11. System provides template preview and demonstration capabilities before adoption
12. Template rating and review system helps users select high-quality templates
13. Template dependencies and requirements are clearly documented and validated
14. Users can contribute template improvements and submit template updates for review

## Epic 7 CLI & Configuration Management

### Epic Goal

Develop command-line interface for workstation and agent management. This epic will deliver the CLI functionality including authentication, workstation lifecycle management, and configuration controls.

### Story 7.1 CLI Authentication and User Management

As a CLI user,
I want to authenticate and manage my user context,
so that I can securely use Solo Unicorn from the command line.

#### Acceptance Criteria

1. Users can authenticate with `solo-unicorn auth login` using web flow
2. Users can authenticate with personal access tokens
3. Users can authenticate with organization API keys
4. System stores tokens securely in OS keychain
5. Users can view authentication status with `solo-unicorn auth whoami`
6. Users can logout with `solo-unicorn auth logout`
7. Authentication supports organization selection
8. System handles token expiration and refresh
9. Error messages are clear and helpful for auth issues

### Story 7.2 Workstation Lifecycle Management

As a CLI user,
I want to manage my workstation lifecycle,
so that I can control when my workstation receives mission assignments.

#### Acceptance Criteria

1. Users can start workstation with `solo-unicorn workstation start`
2. Users can stop workstation with `solo-unicorn workstation stop`
3. Users can restart workstation with `solo-unicorn workstation restart`
4. Workstation can run in background mode
5. Users can check workstation status with `solo-unicorn workstation status`
6. Status command supports JSON output for scripting
7. System provides aliases for common commands (start, stop, status, restart)
8. Workstation lifecycle integrates with Monster Realtime
9. Error handling includes clear recovery instructions

### Story 7.3 Repository and Configuration Management

As a CLI user,
I want to manage repositories and configuration,
so that I can set up my development environment for Solo Unicorn.

#### Acceptance Criteria

1. Users can add repositories with `solo-unicorn repo add GITHUB_URL`
2. Users can list repositories with `solo-unicorn repo list`
3. Users can remove repositories with `solo-unicorn repo remove REPO_ID`
4. Users can get configuration values with `solo-unicorn config get KEY`
5. Users can set configuration values with `solo-unicorn config set KEY VALUE`
6. Users can list all configuration with `solo-unicorn config list`
7. Users can reset configuration with `solo-unicorn config reset [KEY]`
8. Configuration is stored in `~/.solo-unicorn/config.json`
9. System supports workspace directory configuration

### Story 7.4 CLI Self-Management and Help

As a CLI user,
I want to manage the CLI tool itself and access help,
so that I can keep the tool up-to-date and learn how to use it.

#### Acceptance Criteria

1. Users can update CLI with `solo-unicorn self update` with progress indicators and version verification
2. Users can check CLI version with `solo-unicorn self version` showing detailed version information
3. Users can access help with `solo-unicorn help [COMMAND]` with comprehensive documentation
4. Help system provides detailed command documentation with examples and usage patterns
5. CLI supports tab completion for commands with intelligent suggestions
6. Error messages include help suggestions and troubleshooting guidance
7. CLI provides progress indicators for long operations with estimated completion times
8. CLI supports common flags (--json, --background, etc.) with consistent behavior
9. CLI installation methods are documented and functional with multiple distribution channels
10. System provides diagnostic tools with `solo-unicorn doctor` for troubleshooting
11. CLI supports configuration backup and restore operations
12. Help system includes interactive tutorials and getting started guides
13. CLI provides system compatibility checks and requirement validation
14. Update process includes rollback capabilities and integrity verification

## Checklist Results Report

The Solo Unicorn PRD has been updated to align with the latest foundation documents including feature requirements, web design, CLI design, DB design, API/MCP design, and RPC design. Key updates include:

1. Enhanced authentication requirements aligned with Monster Auth integration including OAuth flows, JWT handling, and multi-provider support
2. Detailed workstation and agent management specifications based on CLI design documentation
3. Comprehensive repository and git worktree management aligned with DB schema design
4. Refined mission management and flow system requirements based on web design specifications
5. Enhanced PR mode and change management features with detailed GitHub integration
6. Expanded public project and community features with granular permissions and template support
7. Updated technical assumptions reflecting all foundation documents
8. Detailed acceptance criteria for all stories with specific implementation requirements

The document now provides a comprehensive blueprint for Solo Unicorn v3 implementation with clear alignment across all components and services.

## Next Steps

The PRD has been updated and is now ready for implementation. The next steps include:

1. Review and approval of the updated PRD by stakeholders
2. Detailed technical design and architecture planning based on the updated requirements
3. Implementation of core infrastructure components (authentication, organization management)
4. Development of workstation and agent integration features
5. Implementation of mission management and flow system
6. Development of repository and git worktree management
7. Implementation of PR mode and change management features
8. Development of public project and community features

### UX Expert Prompt

Create front-end architecture for Solo Unicorn based on the detailed UI/UX requirements in this PRD, with focus on the Trello-like Kanban board, mission modals, and public project discovery features.

### Architect Prompt

Create full-stack architecture for Solo Unicorn based on the technical requirements in this PRD, with emphasis on the workstation-centric execution model, Monster Realtime integration, and microservices design.