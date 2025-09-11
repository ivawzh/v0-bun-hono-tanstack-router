# Features Design

## Overview

### Vision

Solo Unicorn is a design-driven framework for AI‑assisted development that provides code agents context through design documents. It enables organizations to orchestrate AI coding missions across workstations while maintaining the right balance between speed and control through the "SOLO50" approach—concise intent and design, lightweight human initiation, quick implementation, and easy review structure.

### Product Goals

- Enable autonomous AI code agent orchestration across distributed workstations
- Provide flexible flow-based mission management with optional human review gates
- Support both fast iteration (YOLO mode) and controlled development (PR workflows)
- Integrate seamlessly with existing development tools and GitHub workflows
- Offer granular access control for both private organizations and public project collaboration
- Maintain comprehensive project memory and design documentation for continuous context

## Features

### F001 Authentication & Authorization

#### Meta
- **ID:** F001
- **Name:** Authentication & Authorization
- **Status:** Building

#### Intent
Provide secure, multi-tenant authentication using Monster Auth with support for personal access tokens, organization API keys, and email-based canonical identity across multiple OAuth providers.

#### Goals
- Monster Auth integration with OAuth (Google) and email/password
- Personal access token support for CLI authentication (pat_abc123...)
- Organization API keys for service accounts (org_key_abc123...)
- Refresh token handling with automatic renewal
- Server-initiated token refresh via Monster Realtime
- Organization-based multi-tenancy
- Role-based access control (owner, admin, member)
- Canonical identity by email (no separate authentication table)

#### Non-Goals
- Multiple separate authentication systems
- Complex user profile management
- Social login beyond OAuth providers

#### Solution
Integrate with Monster Auth as the identity provider where email is the canonical identifier. Support multiple OAuth providers that authenticate the same email address. Implement authn via Monster Auth tokens with authz in the application layer (TypeScript). Store minimal user data server-side while leveraging Monster Auth for identity management.

#### User Flow Links
- [UF-AUTH-001](./02-ui/web.md#uf-auth-001)

#### Transport Flow Links
- HTTP: POST /api/oauth/callback
- WebSocket: Monster Realtime auth validation

#### Design Notes
- Email is canonical identity; multiple providers can authenticate same user
- No separate authentication table reduces complexity and sync issues
- Personal access tokens for CLI; org keys for service accounts
- Refresh token rotation for enhanced security

#### Risks & Mitigations
- Email change at IdP → account migration process required (post-MVP)
- Token compromise → automatic refresh and revocation capabilities

### F002 Workstation Management

#### Meta
- **ID:** F002
- **Name:** Workstation Management
- **Status:** Building

#### Intent
Enable users to register and manage workstations (physical/virtual machines) that host code agents and receive mission assignments via real-time communication.

#### Goals
- Workstation registration and status tracking
- Real-time presence via Monster Realtime WebSocket
- Cross-platform support (Windows, macOS, Linux)
- Background daemon mode with system service integration
- Health monitoring and diagnostics
- Code agent availability reporting via presence updates

#### Non-Goals
- Server-side storage of detailed agent configurations
- Remote workstation control or administration
- Complex workstation performance monitoring

#### Solution
Workstations register via CLI and maintain persistent WebSocket connections to Monster Realtime. Report available code agent types, capacity, and status via presence metadata. Server uses real-time presence data for mission assignment decisions without storing detailed agent configurations locally.

#### User Flow Links
- [UF-WORKSTATION-001](./02-ui/web.md#uf-workstation-001)

#### Transport Flow Links
- WebSocket: workstation:{workstation_id} channel
- HTTP: POST /api/v1/workstations/register

#### Design Notes
- Server does not persist code agent configuration details
- Agent availability, versions, rate limits reported via presence/MCP
- Real-time presence enables dynamic mission assignment
- Workstation-centric architecture for distributed development

### F003 Code Agent Orchestration

#### Meta
- **ID:** F003
- **Name:** Code Agent Orchestration
- **Status:** Building

#### Intent
Orchestrate multiple AI code agent types (starting with Claude Code) across workstations with rate limit detection, health checks, and mission assignment optimization.

#### Goals
- Multiple AI code agent types support (Claude Code primary)
- Code agent rate limit detection and handling
- Code agent installation and health checks
- Real-time availability reporting
- Mission assignment based on agent capacity and repository concurrency

#### Non-Goals
- Complex agent configuration management server-side
- Agent performance optimization
- Multi-agent collaboration on single missions (MVP)

#### Solution
Use hybrid approach where detailed agent configurations stay on workstations (client-side JSON files) while server tracks basic availability via WebSocket presence. Mission assignment uses real-time agent status, repository concurrency limits, and priority queuing.

#### User Flow Links
- [UF-AGENT-001](./02-ui/web.md#uf-agent-001)

#### Transport Flow Links
- MCP: mission.v1.update for agent progress reporting
- WebSocket: presence updates for agent availability

#### Design Notes
- Client-side agent config storage reduces database complexity
- Server gets real-time availability via presence updates
- Mission assignment respects agent concurrency and rate limits

### F004 Repository & Git Worktree Management

#### Meta
- **ID:** F004
- **Name:** Repository & Git Worktree Management
- **Status:** Building

#### Intent
Manage GitHub repository integration with git worktree support for parallel development across multiple branches and missions.

#### Goals
- GitHub repository integration with stable identification
- Git worktree support for parallel development
- Automatic repository cloning and worktree creation by AI code agents
- Branch management and cleanup
- Repository access control per project
- Standardized repository identifier using GitHub numeric repository ID

#### Non-Goals
- Support for non-GitHub git providers (MVP)
- Complex branch protection rules
- Advanced git workflow automation

#### Solution
Use GitHub numeric repository ID (BIGINT) as canonical identifier for stability. CLI auto-manages cloning and worktree creation on first mission for new repo/branch. Workstations maintain worktree pools for efficient resource usage with automatic cleanup policies.

#### User Flow Links
- [UF-REPO-001](./02-ui/web.md#uf-repo-001)

#### Transport Flow Links
- HTTP: repository.linkGithub MCP tool
- HTTP: GET /api/v1/projects/{projectId}/repositories

#### Design Notes
- GitHub numeric repo ID never changes (most stable identifier)
- Worktree pools reduce setup time and disk usage
- CLI manages worktrees automatically; no user-facing commands in MVP

### F005 Mission Management & Flow

#### Meta
- **ID:** F005
- **Name:** Mission Management & Flow
- **Status:** Building

#### Intent
Provide Kanban-style mission organization with flexible, flow-based stage management and optional human review gates.

#### Goals
- Kanban-style mission organization (Todo, Doing, Review, Done)
- Default mission stages (clarify, plan, code)
- Flow-first mission creation with stage selection
- Review system with human approval/rejection
- Mission dependencies and priority management
- Loop missions for continuous improvement
- Solution & Tasks document management in filesystem

#### Non-Goals
- Complex workflow automation
- Advanced project management features
- Time tracking or detailed analytics (MVP)

#### Solution
Implement flow-first mission creation where users select flows then optionally start from specific stages. Store solution/tasks hybrid: filesystem for content (./solo-unicorn-docs/missions/{mission-id}/), database for progress tracking. Support loop missions with scheduling for automated maintenance.

#### User Flow Links
- [UF-MISSION-001](./02-ui/web.md#uf-mission-001)
- [UF-REVIEW-001](./02-ui/web.md#uf-review-001)

#### Transport Flow Links
- MCP: mission.v1.create, mission.v1.update, mission.v1.reject
- WebSocket: mission:{mission_id} for real-time updates

#### Design Notes
- Flow-first creation ensures proper stage configuration
- Hybrid storage: filesystem for large content, DB for tracking
- Loop missions maximize code agent monthly budget usage
- Review system integrates with PR feedback via GitHub CLI

### F006 Change Management System

#### Meta
- **ID:** F006
- **Name:** Change Management System
- **Status:** Building

#### Intent
Support dual change management approaches: YOLO mode for fast iteration and PR mode for controlled development with GitHub integration.

#### Goals
- Dual change management: YOLO (direct to default branch) and PRs
- Automatic GitHub PR creation with mission context
- AI code agent PR comment reading and iteration
- Human review integration with GitHub
- Branch management and cleanup

#### Non-Goals
- Complex merge strategies
- Advanced GitHub workflow automation
- Built-in code review tools (use GitHub)

#### Solution
Provide per-project and per-mission PR mode configuration. When enabled, auto-create PRs with mission context and enable AI agents to read GitHub PR comments via `gh` CLI for iteration. Human reviews happen in GitHub with status reflected in Solo Unicorn.

#### User Flow Links
- [UF-PR-001](./02-ui/web.md#uf-pr-001)

#### Transport Flow Links
- HTTP: GitHub API for PR creation and status
- Event: PR status updates via polling (no webhooks MVP)

#### Design Notes
- GitHub-native review process
- AI agents read PR comments for iteration
- No GitHub webhooks required; status polling sufficient

#### Risks & Mitigations
- GitHub API rate limits → smart caching and batched requests
- PR conflicts → surface status in UI with clear guidance

### F007 Development Server & Public Tunneling

#### Meta
- **ID:** F007
- **Name:** Development Server & Public Tunneling
- **Status:** Draft

#### Intent
Enable local development server hosting with public URL access for sharing and collaboration via Cloudflare Tunnel.

#### Goals
- Local development server hosting
- Public tunneling via Cloudflared CLI
- Multi-tenant dynamic subdomains per project/workstation
- Security controls for public access

#### Non-Goals
- Production hosting capabilities
- Complex load balancing
- Advanced CDN features

#### Solution
Use Cloudflare Tunnel (cloudflared) for cost-effectiveness and multi-tenancy support. Dynamic subdomains via channel.solounicorn.lol/workstation/{workstation_id}/project/{project_id} with security controls and rate limiting.

#### Transport Flow Links
- WebSocket: Tunnel proxy via Monster Realtime
- HTTP: Public access via Cloudflare Tunnel

#### Design Notes
- Cloudflare Tunnel chosen for MVP (cost and ease)
- WebSocket-based tunneling protocol
- Public access with configurable security controls

### F008 Project & Organization Management

#### Meta
- **ID:** F008
- **Name:** Project & Organization Management
- **Status:** Building

#### Intent
Provide multi-project organization structure with project memory, configuration management, and team collaboration features.

#### Goals
- Multi-project organization structure
- Project memory for shared context across missions
- Project-specific configuration and defaults
- User invitation and role management
- Project archiving and lifecycle management

#### Non-Goals
- Complex project templates (MVP)
- Advanced analytics or reporting
- Cross-project dependencies

#### Solution
Organization-based multi-tenancy with project-level access control. Store project memory as markdown content for AI context. Support granular permissions and role-based access control with public project capabilities.

#### User Flow Links
- [UF-PROJECT-001](./02-ui/web.md#uf-project-001)

#### Transport Flow Links
- HTTP: project.* MCP tools
- WebSocket: project:{project_id}:workstations channel

#### Design Notes
- Project memory stored as markdown for AI consumption
- Organization-level user management with project-level permissions
- Public projects support community collaboration

### F009 Real-time Communication

#### Meta
- **ID:** F009
- **Name:** Real-time Communication
- **Status:** Building

#### Intent
Provide real-time communication for workstation presence, mission assignments, and status updates via Monster Realtime WebSocket integration.

#### Goals
- Monster Realtime WebSocket integration
- Workstation presence and status updates
- Mission assignment notifications
- Real-time UI updates for mission status changes
- Channel-based communication architecture

#### Non-Goals
- Complex messaging features
- File sharing capabilities
- Video/audio communication

#### Solution
Use Monster Realtime for push-only WebSocket communication. Structured channels for different contexts (workstation, project, mission) with presence metadata for real-time availability tracking.

#### Transport Flow Links
- WebSocket: workstation:{workstation_id}, project:{project_id}:workstations, mission:{mission_id}

#### Design Notes
- WebSocket for push notifications only, not request/response
- Channel structure matches entity relationships
- Presence metadata includes agent availability

### F010 Configuration Management

#### Meta
- **ID:** F010
- **Name:** Configuration Management
- **Status:** Building

#### Intent
Manage CLI and workstation configuration with secure credential storage and TypeScript typing for consistency.

#### Goals
- CLI config storage in ~/.solo-unicorn/config.json
- Local configuration files with TypeScript typing
- Secure credential storage in OS keychain
- Flow management and template configuration

#### Non-Goals
- Complex configuration validation
- Remote configuration management
- Configuration versioning (MVP)

#### Solution
Use structured JSON configuration files with TypeScript interfaces for type safety. Integrate with OS keychain for secure credential storage. Support flow templates and agent configuration at workstation level.

#### User Flow Links
- [UF-CONFIG-001](./02-ui/web.md#uf-config-001)

#### Transport Flow Links
- HTTP: config get/set/list/reset commands

#### Design Notes
- TypeScript typing ensures configuration consistency
- OS keychain integration for security
- Local storage reduces server complexity

### F011 Flow Review System

#### Meta
- **ID:** F011
- **Name:** Flow Review System
- **Status:** Building

#### Intent
Enable human review gates at any flow stage with approval/rejection workflow and feedback integration.

#### Goals
- Review points at any flow stage
- Special kanban column for missions awaiting review
- Approval flow with human review and feedback
- Automatic flow continuation on approval
- Rejection handling with feedback iteration
- Review history tracking

#### Non-Goals
- Complex approval workflows
- Multi-reviewer consensus
- Advanced review analytics

#### Solution
Configure review requirements per flow stage. Create dedicated Review kanban column. Integrate rejection feedback with AI agent iteration using GitHub PR comments when applicable.

#### User Flow Links
- [UF-REVIEW-001](./02-ui/web.md#uf-review-001)

#### Transport Flow Links
- MCP: request_review tool for code agents
- HTTP: mission approval/rejection endpoints

#### Design Notes
- Review configuration per flow stage
- Integration with GitHub PR feedback
- Review history for audit trail

### F012 Solution & Tasks Document Management

#### Meta
- **ID:** F012
- **Name:** Solution & Tasks Document Management
- **Status:** Building

#### Intent
Manage mission solutions and tasks using hybrid filesystem and database storage for efficient AI context and progress tracking.

#### Goals
- Hybrid storage: solution and tasks content in filesystem, progress in database
- Filesystem storage in ./solo-unicorn-docs/missions/{mission-id}/
- Structure: solution.md and tasks/{n}.md files
- Database tracking of progress and current task index
- Context preservation between AI sessions
- Version control integration

#### Non-Goals
- Complex document versioning
- Real-time collaborative editing
- Advanced document templates

#### Solution
Store solution.md and tasks/{n}.md in filesystem for AI context while tracking progress in database. Each task fits within AI session context window. Git tracks document history for audit trail.

#### Design Notes
- Filesystem storage optimizes AI context loading
- Database tracking enables server-side progress decisions
- Task granularity fits AI session context limits
- Git provides automatic version control

### F013 Public Projects & Access Control

#### Meta
- **ID:** F013
- **Name:** Public Projects & Access Control
- **Status:** Building

#### Intent
Support public project visibility with granular access control and permission levels for community collaboration.

#### Goals
- Project visibility: private (default) and public
- Granular permissions for different project resources
- Permission levels: Public, Contributor, Collaborator, Maintainer, Owner
- Workstation privacy controls (hidden, status only, full details)
- Security boundaries for public access
- Access request system with approval workflow

#### Non-Goals
- Complex permission inheritance
- Advanced audit logging (MVP)
- Automated permission management

#### Solution
Implement hierarchical role system with explicit permission overrides. Projects private by default with opt-in public visibility. Granular controls for missions, workstations, execution permissions, and memory access.

#### User Flow Links
- [UF-PUBLIC-001](./02-ui/web.md#uf-public-001)

#### Transport Flow Links
- HTTP: GET /api/v1/public/projects
- HTTP: Access request and approval endpoints

#### Design Notes
- Private by default maintains security
- Granular permissions enable fine-tuned collaboration
- Workstation visibility remains controllable
- Permission checks in application layer, not SQL

### F014 Public Project Discovery & Community

#### Meta
- **ID:** F014
- **Name:** Public Project Discovery & Community
- **Status:** Draft

#### Intent
Enable comprehensive public project browsing, discovery, and community engagement features.

#### Goals
- Project gallery with search and filtering
- Project templates and reusable structures
- Featured projects showcase
- Category and tag system
- Project metrics and analytics
- Community engagement (stars, follows, contributions)
- Project sharing and embedding capabilities

#### Non-Goals
- Social networking features
- Complex recommendation algorithms
- Advanced analytics dashboard

#### Solution
Create public project gallery with filtering by category, technology, and activity. Implement template system for project reuse. Featured projects with editorial control and community metrics for engagement tracking.

#### User Flow Links
- [UF-DISCOVERY-001](./02-ui/web.md#uf-discovery-001)

#### Transport Flow Links
- HTTP: GET /api/v1/public/projects/search
- HTTP: Template and community engagement APIs

#### Design Notes
- Public endpoints require no authentication
- Template system enables project reuse
- Community metrics drive engagement

### F015 Public API Design & Security

#### Meta
- **ID:** F015
- **Name:** Public API Design & Security
- **Status:** Building

#### Intent
Provide secure, performant public API access with permission-aware responses and comprehensive rate limiting.

#### Goals
- Public discovery endpoints with optional authentication
- Permission-aware API responses
- Comprehensive rate limiting strategy
- CORS configuration for web embedding
- Caching strategy for performance
- API versioning and backward compatibility

#### Non-Goals
- GraphQL endpoints (MVP)
- Advanced API analytics
- Complex authentication schemes

#### Solution
Implement public discovery endpoints with graceful degradation based on authentication. Use comprehensive rate limiting (anonymous, authenticated, contributor levels) with proper CORS and caching strategies.

#### Transport Flow Links
- HTTP: GET /api/v1/public/* endpoints
- CDN: Cached public content delivery

#### Design Notes
- Permission-aware responses without errors
- Rate limiting prevents abuse while enabling legitimate use
- CDN integration for performance
- OpenAPI specification for documentation

### F016 Flow Template System and Prompt Strategy

#### Meta
- **ID:** F016
- **Name:** Flow Template System and Prompt Strategy
- **Status:** Draft

#### Intent
Provide versioned flow templates with static prompt templates and future dynamic prompt generation capabilities.

#### Goals
- Flow templates with versioning
- Stage versioning and semantic versioning
- Static prompt templates for MVP
- Future dynamic prompt generation endpoint support

#### Non-Goals
- Complex prompt optimization
- Real-time prompt adaptation
- Advanced template inheritance

#### Solution
Store flow and stage versions with semantic versioning. Use static prompt templates for MVP with architecture for future dynamic prompt generation via client-hosted endpoints.

#### Design Notes
- Static prompts for MVP simplicity
- Versioned templates enable evolution
- Dynamic prompt architecture planned for future
