# Solo Unicorn Technical Specifications

## Overview

This document provides detailed technical specifications for implementing Solo Unicorn v3, covering system components, APIs, data models, and integration points. It serves as a reference for developers building the platform according to the architectural vision.

**Note**: This project integrates with external Monster services that are hosted in separate repositories:
- **Auth**: Monster Auth. Read more at [Monster Auth](/monster-wiki/shared-services/monster-auth.md).
- **Websocket**: Monster Realtime. Read more at [Monster Realtime](/monster-wiki/shared-services/monster-realtime.md).
- **User uploads**: Monster Upload. Read more at [Monster Upload](/monster-wiki/shared-services/monster-upload.md).

These services are isolated from Solo Unicorn and must be integrated according to their respective documentation.

## System Components

### 1. Server Application (apps/server)

#### Core Services

##### Authentication Service
- **Location**: `src/services/auth/`
- **Dependencies**: Monster Auth SDK (external service), Database
- **Responsibilities**:
  - JWT token validation and refresh via Monster Auth
  - User session management
  - Organization access control
  - Permission validation
- **Interfaces**:
  - `AuthService` - Core authentication logic
  - `SessionManager` - Session creation and validation
  - `TokenValidator` - JWT validation utilities using Monster Auth

##### Workstation Service
- **Location**: `src/services/workstation/`
- **Dependencies**: Monster Realtime SDK (external service), Database
- **Responsibilities**:
  - Workstation registration and lifecycle management
  - Presence tracking and status updates via Monster Realtime
  - Agent availability reporting
  - Workstation assignment for missions
- **Interfaces**:
  - `WorkstationRegistry` - Registration and validation
  - `PresenceTracker` - Real-time status management via Monster Realtime
  - `AgentReporter` - Agent capability broadcasting

##### Mission Service
- **Location**: `src/services/mission/`
- **Dependencies**: Database, MCP SDK
- **Responsibilities**:
  - Mission creation, update, and deletion
  - Flow execution and stage management
  - Dependency resolution and validation
  - Assignment orchestration
- **Interfaces**:
  - `MissionManager` - CRUD operations
  - `FlowExecutor` - Flow stage progression
  - `AssignmentOrchestrator` - Mission assignment logic

##### Repository Service
- **Location**: `src/services/repository/`
- **Dependencies**: GitHub API, Git CLI, Database
- **Responsibilities**:
  - Repository linking and management
  - Git worktree automation
  - PR mode operations
  - Repository concurrency controls
- **Interfaces**:
  - `RepoManager` - Repository operations
  - `WorktreeAutomator` - Worktree creation and cleanup
  - `PRCoordinator` - GitHub PR automation

##### Project Service
- **Location**: `src/services/project/`
- **Dependencies**: Database, Auth Service
- **Responsibilities**:
  - Project lifecycle management
  - Permission system implementation
  - Public project controls
- **Interfaces**:
  - `ProjectManager` - Project operations
  - `PermissionEngine` - Access control implementation
  - `VisibilityController` - Public/private controls

#### API Endpoints

##### oRPC Endpoints (Internal)
- **Path**: `/rpc`
- **Authentication**: Required for all endpoints via Monster Auth
- **Versioning**: Breaking changes allowed (bundle deployment)

**Auth Namespace**:
- `auth.authenticate()` - Validate current session via Monster Auth
- `auth.login()` - Initiate authentication flow with Monster Auth
- `auth.logout()` - Terminate current session

**Workstation Namespace**:
- `workstation.register()` - Register new workstation
- `workstation.list()` - List organization workstations
- `workstation.get()` - Get specific workstation
- `workstation.update()` - Update workstation settings
- `workstation.delete()` - Remove workstation

**Mission Namespace**:
- `mission.create()` - Create new mission
- `mission.get()` - Retrieve mission details
- `mission.update()` - Update mission properties
- `mission.delete()` - Delete mission
- `mission.list()` - List project missions
- `mission.assign()` - Assign mission to workstation
- `mission.reject()` - Reject mission with feedback

**Repository Namespace**:
- `repository.link()` - Link GitHub repository
- `repository.unlink()` - Unlink repository
- `repository.list()` - List project repositories
- `repository.get()` - Get repository details

**Project Namespace**:
- `project.create()` - Create new project
- `project.get()` - Retrieve project details
- `project.update()` - Update project settings
- `project.delete()` - Archive project
- `project.list()` - List organization projects
- `project.members.add()` - Add member to project
- `project.members.remove()` - Remove member from project

**Organization Namespace**:
- `organization.create()` - Create new organization
- `organization.get()` - Retrieve organization details
- `organization.update()` - Update organization settings
- `organization.delete()` - Delete organization
- `organization.members.invite()` - Invite member to organization
- `organization.members.remove()` - Remove member from organization

##### REST API Endpoints (External)
- **Path**: `/api/v1/`
- **Authentication**: Required for protected endpoints via Monster Auth
- **Versioning**: Backward compatibility required

**Public Discovery Endpoints**:
- `GET /api/v1/public/projects` - Browse public projects
- `GET /api/v1/public/projects/search` - Search public projects
- `GET /api/v1/public/projects/{slug}` - Get public project details
- `GET /api/v1/public/projects/{slug}/missions` - Get public missions
- `GET /api/v1/public/categories` - List project categories
- `GET /api/v1/public/featured` - Get featured projects

**Authenticated Endpoints**:
- `GET /api/v1/projects` - List user projects
- `POST /api/v1/projects` - Create new project
- `GET /api/v1/projects/{id}` - Get project details
- `PATCH /api/v1/projects/{id}` - Update project
- `DELETE /api/v1/projects/{id}` - Archive project
- `GET /api/v1/projects/{id}/missions` - List project missions
- `POST /api/v1/projects/{id}/missions` - Create mission
- `GET /api/v1/missions/{id}` - Get mission details
- `PATCH /api/v1/missions/{id}` - Update mission
- `DELETE /api/v1/missions/{id}` - Delete mission
- `POST /api/v1/missions/{id}/reject` - Reject mission with feedback

#### WebSocket Gateway
- **Path**: `/ws`
- **Protocol**: WSS (WebSocket Secure) via Monster Realtime
- **Authentication**: JWT token in connection parameters via Monster Auth
- **Channels** (via Monster Realtime):
  - `workstation:{id}` - Direct workstation communication
  - `project:{id}:workstations` - Project-wide workstation updates
  - `mission:{id}` - Mission-specific coordination

**Messages**:
- `presence.update` - Workstation status updates via Monster Realtime
- `mission.assign` - Mission assignment notifications via Monster Realtime
- `mission.update` - Real-time mission status updates via Monster Realtime
- `agent.status` - Agent availability changes via Monster Realtime

### 2. Web Application (apps/web)

#### Core Modules

##### Authentication Module
- **Location**: `src/modules/auth/`
- **Dependencies**: TanStack Query, oRPC Client, Monster Auth integration
- **Components**:
  - `LoginForm` - User authentication interface with Monster Auth
  - `AuthCallback` - OAuth callback handler from Monster Auth
  - `SessionProvider` - Authentication state management
- **Hooks**:
  - `useAuth()` - Authentication state and operations via Monster Auth
  - `useSession()` - Current user session

##### Kanban Module
- **Location**: `src/modules/kanban/`
- **Dependencies**: TanStack Query, DnD Kit
- **Components**:
  - `KanbanBoard` - Main board interface
  - `MissionCard` - Individual mission display
  - `ColumnHeader` - Column titles and controls
  - `DropZone` - Drag-and-drop target areas
- **Hooks**:
  - `useBoardData()` - Board state management
  - `useDragAndDrop()` - Drag-and-drop functionality

##### Mission Module
- **Location**: `src/modules/mission/`
- **Dependencies**: TanStack Query, oRPC Client
- **Components**:
  - `MissionModal` - Mission creation and editing
  - `MissionDetails` - Detailed mission view
  - `FlowEditor` - Flow configuration interface
  - `ReviewPanel` - Review workflow controls
- **Hooks**:
  - `useMission()` - Mission data retrieval
  - `useMissionMutations()` - Mission update operations

##### Project Module
- **Location**: `src/modules/project/`
- **Dependencies**: TanStack Query, oRPC Client
- **Components**:
  - `ProjectDashboard` - Main project overview
  - `ProjectSettings` - Configuration interface
  - `MemberManager` - Team collaboration tools
  - `RepoManager` - Repository linking controls
- **Hooks**:
  - `useProject()` - Project data retrieval
  - `useProjectMutations()` - Project update operations

#### State Management

##### TanStack Query Configuration
- **Caching**: Default cache policies with manual invalidation
- **Retries**: Exponential backoff for failed requests
- **Polling**: Real-time updates via WebSocket where available (Monster Realtime)
- **Error Handling**: Centralized error boundary with user-friendly messages

##### Context Providers
- **AuthProvider**: Global authentication state via Monster Auth
- **ProjectProvider**: Current project context
- **WorkstationProvider**: Workstation status information via Monster Realtime
- **NotificationProvider**: Application-wide notifications

### 3. CLI Application (bun-compiled binary)

#### Core Commands

##### Authentication Commands
- **`auth login`**: Interactive web authentication with Monster Auth or PAT/API key login
- **`auth logout`**: Clear local authentication tokens (stored in OS keychain)
- **`auth whoami`**: Display current user and organization information via Monster Auth

##### Workstation Commands
- **`workstation register`**: Register current workstation with Monster Realtime
- **`workstation start`**: Connect to Monster Realtime and listen for missions
- **`workstation stop`**: Disconnect from Monster Realtime
- **`workstation status`**: Show current workstation status and connection info via Monster Realtime
- **`workstation restart`**: Restart workstation connection to Monster Realtime

##### Repository Commands
- **`repo add`**: Link GitHub repository to project
- **`repo list`**: List linked repositories
- **`repo remove`**: Unlink repository

##### Agent Commands
- **`agent scan`**: Detect installed code agents
- **`agent list`**: Show registered agents
- **`agent add`**: Register new agent

##### Configuration Commands
- **`config get`**: Retrieve configuration value
- **`config set`**: Set configuration value
- **`config list`**: List all configuration values
- **`config reset`**: Reset configuration to defaults

#### Key Components

##### Monster Realtime Client
- **Protocol**: WebSocket Secure (WSS) via Monster Realtime service
- **Connection Management**: Automatic reconnection with exponential backoff to Monster Realtime
- **Message Handling**: Event-based message processing from Monster Realtime
- **Presence Updates**: Periodic status broadcasts to Monster Realtime

##### Git Worktree Manager
- **Worktree Creation**: Automatic creation on first mission for repo/branch
- **Worktree Pool**: Maintain vacant worktrees for efficient resource usage
- **Cleanup Policy**: Remove unused worktrees after 7+ days
- **Resource Limits**: Respect repository concurrency limits

##### Code Agent Runner
- **Agent Detection**: Scan system for installed agents
- **Session Management**: Start/stop agent sessions
- **Status Reporting**: Report agent availability via Monster Realtime presence updates
- **Mission Execution**: Route missions to appropriate agents

##### Configuration Store
- **File Location**: `~/.solo-unicorn/config.json`
- **Secure Storage**: OS keychain for sensitive information (Monster Auth tokens)
- **Validation**: Schema validation for configuration integrity
- **Migration**: Automatic migration for configuration version upgrades

## Data Models

### Core Entities

#### Organization
```typescript
interface Organization {
  id: string; // ULID
  name: string;
  slug: string;
  domain?: string;
  ownerEmail: string;
  apiKey?: string;
  apiKeyCreatedAt?: Date;
  apiKeyExpiresAt?: Date;
  defaultFlowId?: string;
  autoInviteToProjects: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

#### User
```typescript
interface User {
  id: string; // ULID
  email: string;
  name?: string;
  avatar?: string;
  timezone: string;
  emailVerified: boolean;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt: Date;
  monsterAuth: {
    provider: 'google' | 'email';
    monsterAuthEntity: any; // External Monster Auth entity
  };
}
```

#### Workstation
```typescript
interface Workstation {
  id: string; // ULID
  organizationId: string;
  name: string;
  hostname?: string;
  os?: string;
  arch?: string;
  platformVersion?: string;
  cliVersion?: string;
  registrationToken?: string;
  lastIpAddress?: string;
  lastUserAgent?: string;
  status: 'online' | 'offline' | 'suspended';
  lastSeenAt?: Date;
  lastHeartbeatAt?: Date;
  availableCodeAgents?: Array<{
    type: string;
    name: string;
    available: boolean;
    rateLimited?: boolean;
    rateLimitResetAt?: Date;
  }>;
  realtimeMemberKey?: {
    workstationId: string;
    userId: string;
  };
  realtimePresenceMeta?: any; // Metadata from Monster Realtime
  devServerEnabled: boolean;
  devServerPort?: number;
  devServerPublicUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
```

#### Project
```typescript
interface Project {
  id: string; // ULID
  organizationId: string;
  name: string;
  description?: string;
  slug: string;
  visibility: 'private' | 'public';
  publicSlug?: string;
  category?: string;
  tags?: string[];
  featured: boolean;
  starCount: number;
  publicMissionRead: boolean;
  publicMemoryRead: boolean;
  publicRepositoryRead: boolean;
  contributorMissionWrite: boolean;
  collaboratorWorkstationRead: boolean;
  maintainerMissionExecute: boolean;
  workstationVisibility: 'hidden' | 'status_only' | 'full_details';
  defaultFlowId?: string;
  defaultActorId?: string;
  memory?: string;
  prModeDefault: 'disabled' | 'enabled';
  prRequireReview: boolean;
  prAutoMerge: boolean;
  prDeleteBranchAfterMerge: boolean;
  prTemplate?: string;
  status: 'active' | 'archived' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
}
```

#### Mission
```typescript
interface Mission {
  id: string; // ULID
  projectId: string;
  title: string;
  description?: string;
  spec?: string;
  priority: number; // 1-5 (5=highest)
  list: 'todo' | 'doing' | 'review' | 'done' | 'loop';
  listOrder: number;
  stage: string;
  flowId?: string;
  flowConfig?: any;
  currentFlowTask: number;
  requiresReview: boolean;
  repositoryId?: number; // GitHub numeric repo ID
  projectRepositoryId?: string;
  targetBranch: string;
  actorId?: string;
  prMode: 'disabled' | 'enabled' | 'auto';
  prCreated: boolean;
  githubPrNumber?: number;
  githubPrUrl?: string;
  prBranchName?: string;
  prMergeStrategy: 'merge' | 'squash' | 'rebase';
  isLoop: boolean;
  loopSchedule?: {
    maxPerDay?: number;
    maxPerHour?: number;
  };
  ready: boolean;
  agentSessionStatus: 'INACTIVE' | 'PUSHING' | 'ACTIVE';
  agentSessionStatusChangedAt: Date;
  codeAgentType?: string;
  codeAgentName?: string;
  lastCodeAgentSessionId?: string;
  solution?: string;
  tasks?: Array<{
    title: string;
  }>;
  tasksCurrent: number;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  reviewFeedback?: string;
  reviewRequestedAt?: Date;
  reviewCompletedAt?: Date;
  reviewedByUserId?: string;
  dependencyCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Repository
```typescript
interface ProjectRepository {
  id: string; // ULID
  projectId: string;
  name: string;
  githubRepoId?: number; // GitHub numeric repo ID
  githubOwner: string;
  githubName: string;
  githubFullName: string;
  githubUrl: string;
  defaultBranch: string;
  prModeEnabled: boolean;
  prBranchPrefix: string;
  prTargetBranch?: string;
  autoDeletePrBranches: boolean;
  maxConcurrentMissions: number;
  status: 'active' | 'inactive' | 'error';
  lastAccessedAt?: Date;
  lastMissionPushedAt?: Date;
  lastPrSyncAt?: Date;
  githubWebhookId?: string;
  githubPermissions?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Flow
```typescript
interface Flow {
  id: string; // ULID
  projectId: string;
  name: string;
  description?: string;
  stageSequence: Array<{
    stage: string;
    requireReview: boolean;
  }>;
  isDefault: boolean;
  isSystem: boolean;
  missionsUsingCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

## Integration Points

### 1. Monster Auth Integration (External Service)

#### Authentication Flow
1. **Web Authentication**:
   - Redirect user to Monster Auth OAuth endpoint
   - Receive authorization code via callback
   - Exchange code for access/refresh tokens via Monster Auth
   - Store tokens in secure HTTP-only cookies

2. **CLI Authentication**:
   - Start local HTTP server on ephemeral port
   - Open browser to Monster Auth authorization URL
   - Receive authorization code via callback
   - Exchange code for access/refresh tokens via Monster Auth
   - Store tokens in OS keychain

#### Token Management
- **JWT Validation**: Verify token signatures and claims via Monster Auth
- **Refresh Logic**: Automatic token refresh before expiration via Monster Auth
- **Revocation**: Clean token cleanup on logout
- **Scope Validation**: Ensure minimum required permissions via Monster Auth

### 2. Monster Realtime Integration (External Service)

#### WebSocket Connection
- **Protocol**: WSS with automatic reconnection via Monster Realtime
- **Authentication**: JWT token in connection parameters via Monster Auth
- **Channel Structure** (managed by Monster Realtime):
  - `workstation:{id}` - Direct workstation communication
  - `project:{id}:workstations` - Project-wide workstation updates
  - `mission:{id}` - Mission-specific coordination

#### Presence System
- **Status Updates**: Periodic presence broadcasts to Monster Realtime
- **Metadata**: Workstation status, agent availability, active projects via Monster Realtime
- **Member Keys**: Unique identifiers for presence tracking via Monster Realtime
- **Channel Routing**: Efficient message delivery to relevant parties via Monster Realtime

### 3. GitHub Integration

#### Repository Linking
- **Identifier**: GitHub numeric repository ID (BIGINT) as canonical identifier
- **Access Validation**: Verify user permissions to repository via GitHub API
- **Webhook Setup**: Configure PR event notifications via GitHub API
- **Metadata Storage**: Store multiple identifiers for stability

#### PR Automation
- **Branch Management**: Auto-create/delete feature branches via Git CLI
- **PR Creation**: Create GitHub PRs with proper naming conventions via GitHub API
- **Comment Reading**: Use GitHub CLI (`gh`) to read PR comments
- **Merge Handling**: Support merge, squash, and rebase strategies via GitHub API

### 4. Git Worktree Management

#### Worktree Creation
- **Naming Scheme**: `{repo}-{branch}` for predictable paths
- **Pool Management**: Maintain vacant worktrees for efficient resource usage
- **Concurrency Control**: Respect repository concurrency limits
- **Automatic Cleanup**: Remove unused worktrees after 7+ days

#### Worktree Allocation
- **Reuse Strategy**: Try to reuse existing worktree for same branch
- **Vacant Worktrees**: Use vacant worktrees for different branches
- **Creation Logic**: Create new worktrees when under concurrency limit
- **Resource Limits**: Maximum worktrees per repo = `maxConcurrencyLimit + 3`

### 5. Monster Upload Integration (External Service)

#### File Management
- **Upload Flow**:
  - Request upload URL from Solo Unicorn API
  - API requests signed upload URL from Monster Upload service
  - Client uploads directly to Monster Upload via signed URL
  - Monster Upload notifies Solo Unicorn of successful upload
  - Solo Unicorn stores file metadata in database

#### Security
- **Signed URLs**: Temporary signed URLs for direct uploads to Monster Upload
- **Access Control**: File access controlled by Solo Unicorn permissions
- **Content Validation**: MIME type and size validation
- **Malware Scanning**: Integration with Monster Upload malware scanning (if enabled)

## Communication Protocol Architecture

### Protocol Hierarchy (use least powerful approach)
1. **oRPC**: Internal communication (web ↔ server) when breaking changes acceptable
2. **REST API**: External communication (CLI ↔ server, third-party integrations) when backward compatibility required
3. **WebSocket**: Real-time push notifications only (mission assignments, status updates) via Monster Realtime
4. **MCP**: AI agent communication only (mission updates, project memory access)

### Implementation Details

#### oRPC (Internal Communication)
- **Purpose**: Used for web app internal communication where breaking changes are acceptable
- **Endpoints**: `/rpc` with namespaced procedures (auth., workstation., mission., etc.)
- **Breaking Changes**: Allowed since web and server are deployed together
- **Type Safety**: Full TypeScript typing with automatic client generation

#### REST API (External Communication)
- **Purpose**: Used for CLI and third-party integrations where backward compatibility is required
- **Endpoints**: `/api/v1` with versioned URLs
- **Breaking Changes**: Not allowed without proper versioning
- **Documentation**: OpenAPI/Swagger documentation automatically generated

#### WebSocket (Real-Time Communication)
- **Purpose**: Used exclusively for real-time push notifications via Monster Realtime
- **Endpoints**: `/ws/v1` via Monster Realtime service
- **Channels**: 
  - `workstation:{id}` - Direct workstation communication
  - `project:{id}:workstations` - Project-wide workstation updates
  - `mission:{id}` - Mission-specific coordination
- **Messages**: JSON envelopes with type and payload fields

#### MCP (AI Agent Communication)
- **Purpose**: Used exclusively for AI agent communication (mission updates, project memory access)
- **Protocol**: Model Context Protocol over WebSocket
- **Endpoints**: Integrated with Monster Realtime channels
- **Tools**: Defined in `src/services/mcp/` with automatic tool discovery

## Performance Considerations

### Database Optimization

#### Indexing Strategy
- **High-Frequency Queries**: Specialized indexes for monitoring queries
- **Mission Assignment**: Composite indexes for assignment logic
- **Concurrency Tracking**: Indexes for repository/agent concurrency
- **Dependency Resolution**: Indexes for mission dependencies

#### Query Optimization
- **Materialized Views**: Pre-computed aggregations for monitoring
- **Embedded Subqueries**: Optimized subqueries for complex conditions
- **Connection Pooling**: Efficient database connection management
- **Caching**: HTTP-level caching for static content

### Caching Strategy

#### Client-Side Caching
- **TanStack Query**: Automatic caching with manual invalidation
- **HTTP Caching**: Proper cache headers for static assets
- **LocalStorage**: Persistent storage for user preferences
- **Service Worker**: Offline support for critical assets

#### Server-Side Caching
- **Redis**: Distributed caching for frequently accessed data
- **CDN**: Cloudflare CDN for static assets
- **Database Caching**: Query result caching for expensive operations
- **WebSocket Broadcasting**: Efficient real-time updates via Monster Realtime

### Real-Time Performance

#### WebSocket Optimization
- **Message Compression**: Reduce bandwidth usage via Monster Realtime
- **Batching**: Combine multiple updates into single messages via Monster Realtime
- **Selective Updates**: Send only changed data via Monster Realtime
- **Connection Pooling**: Efficient WebSocket connection management via Monster Realtime

#### Presence Updates
- **Throttling**: Limit presence update frequency via Monster Realtime
- **Delta Updates**: Send only changed metadata via Monster Realtime
- **Compression**: Compress presence data payloads via Monster Realtime
- **Efficient Encoding**: Use efficient serialization formats via Monster Realtime

## Security Measures

### Authentication Security

#### Token Protection
- **Secure Storage**: HTTP-only cookies for web, OS keychain for CLI (Monster Auth)
- **Expiration**: Short-lived access tokens with refresh mechanism via Monster Auth
- **Rotation**: Refresh token rotation on use via Monster Auth
- **Revocation**: Immediate cleanup on logout

#### Session Security
- **CSRF Protection**: Anti-CSRF tokens for state-changing operations
- **Session Binding**: Bind sessions to IP addresses and user agents
- **Timeouts**: Automatic session expiration after inactivity
- **Concurrent Limit**: Limit simultaneous sessions per user

### API Security

#### Rate Limiting
- **Per-Endpoint Limits**: Different limits for different operations
- **Per-User Limits**: User-based rate limiting
- **IP-Based Limits**: IP-level rate limiting for anonymous access
- **Burst Handling**: Allow short bursts within limits

#### Input Validation
- **Schema Validation**: Strict validation of all API inputs
- **Sanitization**: Clean user-generated content
- **SQL Injection**: Parameterized queries via Drizzle ORM
- **XSS Prevention**: Proper escaping of output content

### Data Security

#### Encryption
- **In Transit**: TLS for all communications
- **At Rest**: Encryption for sensitive database fields
- **Key Management**: Proper key rotation and management
- **Certificate Pinning**: Validate Monster Realtime certificates

#### Access Control
- **RBAC**: Role-based access control implementation
- **Row-Level Security**: Database-level access restrictions
- **Audit Logging**: Comprehensive logging of security-relevant events
- **Permission Validation**: Application-layer permission checks

## Monitoring and Observability

### Metrics Collection

#### System Metrics
- **Response Times**: API endpoint response time tracking
- **Throughput**: Requests per second measurements
- **Error Rates**: Error rate tracking by endpoint and type
- **Resource Usage**: CPU, memory, and disk usage monitoring

#### Business Metrics
- **Mission Completion**: Mission completion rates and times
- **User Engagement**: Active user and project metrics
- **Agent Performance**: Code agent effectiveness tracking
- **Repository Activity**: Repository usage and concurrency metrics

### Logging Strategy

#### Structured Logging
- **Correlation IDs**: Unique identifiers for request tracing
- **Context Enrichment**: Add contextual information to log entries
- **Standard Format**: Consistent log format for parsing
- **Level-Based Filtering**: Different log levels for different environments

#### Log Aggregation
- **Centralized Storage**: Aggregate logs in central system
- **Search and Analysis**: Efficient log search and analysis capabilities
- **Alerting**: Automated alerts for critical events
- **Retention**: Appropriate log retention policies

### Error Handling

#### Graceful Degradation
- **Fallback Mechanisms**: Alternative paths for failed operations
- **User Messaging**: Clear error messages with recovery guidance
- **Retry Logic**: Automatic retry with exponential backoff
- **Circuit Breakers**: Prevent cascading failures

#### Error Reporting
- **User Feedback**: Collect user feedback on errors
- **Crash Reporting**: Automatic crash report generation
- **Error Analysis**: Root cause analysis for recurring issues
- **Prevention**: Implement preventive measures based on error patterns

## Deployment Considerations

### Infrastructure Requirements

#### Development Environment
- **Local Database**: PostgreSQL for local development
- **Mock Services**: Simulated external service dependencies
- **Hot Reloading**: Fast development iteration with hot reloading
- **Debugging Tools**: Integrated debugging and profiling tools

#### Staging Environment (Alpha)
- **Cloud Infrastructure**: AWS staging account
- **Database**: NeonDB for serverless PostgreSQL
- **Frontend**: Cloudflare Pages preview deployments
- **Monitoring**: Basic monitoring and alerting

#### Production Environment
- **High Availability**: Multi-zone deployment for resilience
- **Scaling**: Auto-scaling based on demand
- **Database**: Amazon RDS PostgreSQL
- **CDN**: Cloudflare CDN for global content distribution
- **External Services**: Integration with Monster Auth and Monster Realtime services

### CI/CD Pipeline

#### Build Process
- **Code Compilation**: TypeScript compilation with strict checking
- **Bundle Optimization**: Efficient bundling for web application
- **Asset Optimization**: Image compression and optimization
- **Security Scanning**: Automated security vulnerability scanning

#### Testing Strategy
- **Unit Tests**: Comprehensive unit test coverage
- **Integration Tests**: Service integration testing
- **End-to-End Tests**: Full user flow testing
- **Performance Tests**: Load and stress testing

#### Deployment Process
- **Blue-Green Deployment**: Zero-downtime deployments
- **Rollback Capability**: Fast rollback for failed deployments
- **Gradual Rollout**: Gradual rollout to production users
- **Health Checks**: Automated health checks post-deployment

## Future Scalability

### Horizontal Scaling

#### Serverless Scaling
- **Lambda Functions**: AWS Lambda for automatic scaling
- **Database Scaling**: Connection pooling and read replicas
- **WebSocket Scaling**: Monster Realtime for connection management
- **Caching Layers**: Redis for distributed caching

#### Database Partitioning
- **Sharding Strategy**: Organization-based data sharding
- **Read Replicas**: Database read replica distribution
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Optimized queries for scaled environment

### Performance Optimization

#### Caching Strategy
- **Multi-Level Caching**: Multiple caching layers for optimal performance
- **Cache Invalidation**: Intelligent cache invalidation strategies
- **CDN Integration**: Cloudflare CDN for static asset distribution
- **Edge Computing**: Edge computing for reduced latency

#### Database Optimization
- **Index Tuning**: Continuous index tuning for query performance
- **Query Analysis**: Regular query performance analysis
- **Partitioning**: Table partitioning for large datasets
- **Archiving**: Data archiving for older records

### Technology Evolution

#### Framework Updates
- **Continuous Updates**: Regular framework and library updates
- **Breaking Changes**: Managed breaking change adoption
- **Performance Improvements**: Adoption of performance enhancements
- **Security Patches**: Timely security patch application

#### Emerging Technologies
- **AI Advancements**: Integration of new AI capabilities
- **Web Standards**: Adoption of emerging web standards
- **Cloud Services**: Leveraging new cloud service capabilities
- **Development Tools**: Adoption of improved development tools

## Conclusion

This technical specification provides a comprehensive blueprint for implementing Solo Unicorn v3 with attention to system architecture, component design, data modeling, security, performance, and scalability. The document serves as a reference for development teams to build a robust, scalable, and secure platform that delivers on the product vision while maintaining flexibility for future enhancements.

The architecture leverages external Monster services (Auth, Realtime, Upload) for critical infrastructure components, allowing Solo Unicorn to focus on its core mission orchestration capabilities while benefiting from enterprise-grade authentication, real-time communication, and file storage services.