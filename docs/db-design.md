# Solo Unicorn Database Schema Design

## Overview

This document defines the complete database schema for Solo Unicorn v3, supporting the workstation-based architecture, flexible flow system, git worktree management, and Monster services integration.

### Database Infrastructure

**Alpha Environment (staging)**:
- **Provider**: NeonDB (Serverless PostgreSQL)
- **Connection**: Serverless pooling with automatic scaling
- **Benefits**: Zero cold starts, automatic backups, branching for testing
- **Configuration**:
  ```
  DATABASE_URL=postgresql://user:pass@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
  ```

**Production Environment**:
- **Provider**: AWS RDS PostgreSQL
- **Instance**: db.t4g.micro (burstable performance)
- **Storage**: 100 GB SSD with auto-scaling
- **Backups**: Automated daily snapshots with 7-day retention
- **Configuration**:
  ```
  DATABASE_URL=postgresql://user:pass@solo-unicorn-prod.xxxx.us-east-1.rds.amazonaws.com/dbname?sslmode=require
  ```

## Architecture Principles

- **Workstation-Centric**: Organizations own workstations, workstations contain agents
- **Flexible Flows**: Template-based flow system with customizable stages
Worktree Support**: Multiple working directories from same repository
- **Monster Integration**: Compatible with Monster Auth and Monster Realtime
- **Multi-tenancy**: Organization-based isolation with project-level access control
- **Audit Trail**: Complete history tracking for all operations
- **PR Support**: Optional pull request flow for controlled development

## V3 Design Decisions & Rationale

### Authentication Strategy

**Decision**: Separate authentication table (n:1 relationship)

**Rationale**:
- Users can have multiple authentication methods (Google OAuth, password, future providers)
- Stable user identity even if email address changes
- Ready for Monster Auth service accounts when available
- Industry standard approach for OAuth integrations
- Better audit trail for authentication events

### Agent Storage Strategy

**Decision**: Simplified agent table + client-side configuration JSON

**Rationale**:
- Existing mission assignment code requires complex agent queries (impossible with JSONB)
- Server needs agent status, concurrency limits, and type for mission assignment
- Client-specific config (paths, environment vars) should stay on workstation
- Cleaner separation of concerns: server for orchestration, client for execution

### GitHub Repository Storage

**Decision**: Multi-field approach for maximum stability

**Rationale**:
- GitHub URLs can change with repository renames
- GitHub numeric repo ID never changes (most stable identifier)
- Store multiple identifiers for different use cases
- Support git clone while maintaining stable references

### Pull Request Support

**Decision**: Optional per-project and per-mission PR flow

**Rationale**:
- Early stage projects need fast iteration (direct push to main)
- Production projects need code review and controlled changes
- Seamless GitHub integration with PR creation and comment parsing
- AI agents can respond to GitHub PR feedback

### Public Project Support

**Decision**: Granular permission system with optional public visibility

**Rationale**:
- Projects are private by default, maintaining current security model
- Public projects support community collaboration and open-source development
- Granular permissions allow fine-tuned access control (missions, workstations, execution)
- Permission levels follow established open-source collaboration patterns
- Workstation visibility remains optional even for public projects (security/privacy)
- Enables project discovery and template sharing within the community

## Entity Relationship Overview

```
Organizations 1---* Users *---* UserAuthentications
     |               |
     1               |
     |               |
     *               |
 Workstations 1---* Agents
     |                    |
     1                    |
     |                    |
     *                    |
 Projects 1---* ProjectWorkstations
     |                    |
     1                    |
     |                    |
     *                    |
  Missions *---* MissionAgents *---1 Agents
     |               |
     |               |
     1               *
     |               |
     *               1
Flows   GitHubPRs
```

## Core Entities

### Organizations

Organizations are the top-level entity that owns workstations and can have multiple projects.

```sql
CREATE TABLE organizations (
  id VARCHAR(26) PRIMARY KEY, -- ulid: org_01H123...
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL, -- URL-safe identifier
  domain VARCHAR(255), -- custom domain (optional)

  -- Organization Owner
  owner_email VARCHAR(255) NOT NULL, -- organization owner email

  -- Service Account Support
  api_key VARCHAR(100) UNIQUE, -- org_key_abc123... for CLI service accounts
  api_key_created_at TIMESTAMP,
  api_key_expires_at TIMESTAMP,

  -- Settings
  default_flow_id VARCHAR(26),
  auto_invite_to_projects BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL,

  -- Indexes
  INDEX idx_organizations_slug (slug),
  INDEX idx_organizations_created_at (created_at)
);
```

### Users

Users have stable identity within Solo Unicorn with email as primary authentication identifier.

```sql
CREATE TABLE users (
  id VARCHAR(26) PRIMARY KEY, -- ulid: user_01H123...

  -- Primary Identity
  email VARCHAR(255) UNIQUE NOT NULL, -- primary auth identifier
  name VARCHAR(255),
  avatar TEXT, -- avatar URL

  -- Monster Auth Integration
  monster_auth JSONB, -- {"provider": "google"|"email", "monsterAuthEntity": {...oauth payload}}

  -- Profile
  timezone VARCHAR(50) DEFAULT 'UTC',
  email_verified BOOLEAN DEFAULT false,

  -- Status
  status ENUM('active', 'suspended', 'deleted') DEFAULT 'active',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_users_email (email),
  INDEX idx_users_last_active_at (last_active_at),
  INDEX idx_users_status (status)
);
```

```

### Organization Memberships

Manages user access to organizations with role-based permissions.

```sql
CREATE TABLE organization_memberships (
  id VARCHAR(26) PRIMARY KEY, -- ulid: orgmem_01H123...
  organization_id VARCHAR(26) NOT NULL,
  user_id VARCHAR(26) NOT NULL,

  -- Permissions
  role ENUM('owner', 'admin', 'member') DEFAULT 'member',

  -- Status
  status ENUM('active', 'invited', 'suspended') DEFAULT 'active',
  invited_by VARCHAR(26), -- user_id of inviter
  invited_at TIMESTAMP,
  joined_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE KEY unique_org_user (organization_id, user_id),
  INDEX idx_org_memberships_organization_id (organization_id),
  INDEX idx_org_memberships_user_id (user_id),
  INDEX idx_org_memberships_role (role)
);
```

### Workstations

Workstations are physical/virtual machines registered via CLI that host agents.

```sql
CREATE TABLE workstations (
  id VARCHAR(26) PRIMARY KEY, -- ulid: ws_01H123...
  organization_id VARCHAR(26) NOT NULL,

  -- Identity
  name VARCHAR(255) NOT NULL, -- user-defined name
  hostname VARCHAR(255), -- system hostname

  -- System Information
  os VARCHAR(50), -- darwin, linux, win32
  arch VARCHAR(50), -- x64, arm64
  platform_version VARCHAR(100), -- OS version details

  -- CLI Registration
  cli_version VARCHAR(20), -- solo-unicorn CLI version
  registration_token VARCHAR(100), -- secure registration token

  -- Network & Connection
  last_ip_address INET,
  last_user_agent TEXT,

  -- Status & Monitoring
  status ENUM('online', 'offline', 'suspended') DEFAULT 'offline',
  last_seen_at TIMESTAMP,
  last_heartbeat_at TIMESTAMP,

  -- Code Agent Information (minimal for server mission assignment)
  available_code_agents JSON, -- [{"type": "claude-code", "name": "Claude Primary", "available": true}]

  -- Monster Realtime Integration
  realtime_member_key JSON, -- {"workstationId": "ws_123", "userId": "user_456"}
  realtime_presence_meta JSON, -- latest presence data

  -- Development Server (Channel Tunneling)
  dev_server_enabled BOOLEAN DEFAULT false,
  dev_server_port INTEGER,
  dev_server_public_url TEXT, -- channel.solounicorn.lol/workstation/...

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP NULL,

  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

  INDEX idx_workstations_organization_id (organization_id),
  INDEX idx_workstations_status (status),
  INDEX idx_workstations_last_seen_at (last_seen_at)
);
```

### Code Agent Management

**Client-Side Storage**: All code agent configurations stored in `~/.solo-unicorn/code-agents.json` on workstations.

**Server-Side Knowledge**: Only basic availability tracking via workstation presence updates.

```typescript
// Workstation reports available agents via WebSocket presence
interface WorkstationPresence {
  availableCodeAgents: Array<{
    type: 'claude-code' | 'cursor' | 'opencode';
    name: string;
    available: boolean;
    rateLimited?: boolean;
    rateLimitResetAt?: string;
  }>;
  activeMissionCount: number;
  maxConcurrency: number;
}
```

**Benefits**:
- No database sync issues with client configurations
- Workstation-specific settings (paths, API keys) stay local
- Server gets real-time availability via presence updates
- Simpler architecture with fewer failure points
```

### Code Agent Type Definitions (Server-Side Static Configuration)

Server maintains static configuration for code agent capabilities:

```typescript
// Server-side code agent type definitions
interface CodeAgentTypeDefinition {
  type: 'claude-code' | 'cursor' | 'opencode' | 'custom';
  displayName: string;
  supportedModels: string[]; // ['claude-3.5-sonnet', 'gpt-4', etc.]
  supportedLanguages: string[]; // ['typescript', 'python', 'rust', etc.]
  capabilities: {
    canCreatePRs: boolean;
    canReadPRComments: boolean;
    canHandleMultiFile: boolean;
    supportsGitWorktrees: boolean;
  };
  defaultConcurrencyLimit: number;
  rateLimitInfo?: {
    requestsPerHour: number;
    tokensPerMinute: number;
  };
}

// Static configuration
const CODE_AGENT_TYPE_DEFINITIONS: Record<string, CodeAgentTypeDefinition> = {
  'claude-code': {
    type: 'claude-code',
    displayName: 'Claude Code',
    supportedModels: ['claude-3.5-sonnet', 'claude-3-haiku'],
    supportedLanguages: ['typescript', 'javascript', 'python', 'rust', 'go', 'java'],
    capabilities: {
      canCreatePRs: true,
      canReadPRComments: true,
      canHandleMultiFile: true,
      supportsGitWorktrees: true,
    },
    defaultConcurrencyLimit: 2,
    rateLimitInfo: {
      requestsPerHour: 500,
      tokensPerMinute: 50000,
    },
  },
  'cursor': {
    type: 'cursor',
    displayName: 'Cursor',
    supportedModels: ['gpt-4', 'claude-3.5-sonnet'],
    supportedLanguages: ['typescript', 'javascript', 'python', 'rust', 'go'],
    capabilities: {
      canCreatePRs: false,
      canReadPRComments: false,
      canHandleMultiFile: true,
      supportsGitWorktrees: false,
    },
    defaultConcurrencyLimit: 1,
  },
};
```

### Client-Side Code Agent Configuration

Workstation stores code agent-specific configuration in local JSON file:

```typescript
// ~/.solo-unicorn/code-agents.json
interface WorkstationCodeAgentConfig {
  version: string;
  workstationId: string;
  codeAgents: {
    [codeAgentId: string]: {
      // Code Agent Identity
      id: string;
      type: 'claude-code' | 'cursor' | 'opencode' | 'custom';
      name: string;

      // Local Configuration (not stored in database)
      configPath: string;              // ~/.claude, /Applications/Cursor.app
      executablePath?: string;         // /usr/local/bin/cursor
      environmentVars: Record<string, string>; // PATH, CLAUDE_CONFIG_DIR, etc.

      // Code Agent-Specific Settings
      customSettings: {
        claudeCode?: {
          configDir: string;           // CLAUDE_CONFIG_DIR
          defaultModel?: string;       // claude-3.5-sonnet
        };
        cursor?: {
          apiKey?: string;             // encrypted API key
          model?: string;              // gpt-4
          workspaceSettings?: Record<string, any>;
        };
        opencode?: {
          providerId?: string;         // anthropic, openai
          modelId?: string;            // claude-3.5-sonnet
          configDir?: string;
        };
      };

      // Status
      enabled: boolean;
      lastHealthCheck?: string;        // ISO timestamp
      healthStatus: 'healthy' | 'warning' | 'error' | 'unknown';

      // Statistics
      missionsCompleted: number;
      lastUsed?: string;               // ISO timestamp
      averageMissionDuration?: number;    // seconds
    };
  };

  // Global Settings
  settings: {
    autoUpdateCodeAgentStatus: boolean;
    healthCheckInterval: number;       // seconds
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    backupConfig: boolean;
  };
}
```
```

### Projects

Projects contain missions and define which workstations can work on them. Projects can be private (organization-only) or public with granular access control.

```sql
CREATE TABLE projects (
  id VARCHAR(26) PRIMARY KEY, -- ulid: proj_01H123...
  organization_id VARCHAR(26) NOT NULL,

  -- Project Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(100), -- URL-safe identifier within org

  -- Public Project Support
  visibility ENUM('private', 'public') DEFAULT 'private',
  public_slug VARCHAR(100) UNIQUE, -- Global unique slug for public projects

  -- Public Project Metadata
  category VARCHAR(50), -- 'web-development', 'mobile-app', 'ai-ml', etc.
  tags JSON, -- ["react", "typescript", "api"]
  featured BOOLEAN DEFAULT false, -- Featured in project gallery
  star_count INTEGER DEFAULT 0, -- Community engagement metric

  -- Public Access Configuration
  public_mission_read BOOLEAN DEFAULT true, -- Allow public users to read missions
  public_memory_read BOOLEAN DEFAULT true, -- Allow public users to read project memory
  public_repository_read BOOLEAN DEFAULT true, -- Allow public users to see repository information
  contributor_mission_write BOOLEAN DEFAULT true, -- Allow contributors to create/edit missions
  collaborator_workstation_read BOOLEAN DEFAULT false, -- Allow collaborators to see workstation status
  maintainer_mission_execute BOOLEAN DEFAULT false, -- Allow maintainers to execute missions

  -- Workstation Visibility Control
  workstation_visibility ENUM('hidden', 'status_only', 'full_details') DEFAULT 'hidden',
  -- hidden: Workstations completely invisible to non-owners
  -- status_only: Show online/offline status only
  -- full_details: Show detailed workstation information

  -- Configuration
  default_flow_id VARCHAR(26),
  default_actor_id VARCHAR(26),

  -- Project Memory (shared context for all missions)
  memory TEXT, -- markdown content

  -- Pull Request Configuration
  pr_mode_default ENUM('disabled', 'enabled') DEFAULT 'disabled', -- default PR stage for new missions
  pr_require_review BOOLEAN DEFAULT true, -- require human review before merging
  pr_auto_merge BOOLEAN DEFAULT false, -- auto-merge approved PRs
  pr_delete_branch_after_merge BOOLEAN DEFAULT true, -- cleanup branches
  pr_template TEXT, -- default PR description template

  -- Status
  status ENUM('active', 'archived', 'suspended') DEFAULT 'active',

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  archived_at TIMESTAMP NULL,

  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

  UNIQUE KEY unique_org_project_slug (organization_id, slug),
  UNIQUE KEY unique_public_slug (public_slug), -- Global uniqueness for public projects
  INDEX idx_projects_organization_id (organization_id),
  INDEX idx_projects_status (status),
  INDEX idx_projects_visibility (visibility),
  INDEX idx_projects_public_slug (public_slug),
  INDEX idx_projects_category (category),
  INDEX idx_projects_featured (featured),
  INDEX idx_projects_star_count (star_count DESC),
  INDEX idx_projects_workstation_visibility (workstation_visibility),
  INDEX idx_projects_public_access (visibility, public_mission_read, public_memory_read)
);
```

### Project Repositories

Links GitHub repositories to projects with stable identification and PR support.

```sql
CREATE TABLE project_repositories (
  id VARCHAR(26) PRIMARY KEY, -- ulid: repo_01H123...
  project_id VARCHAR(26) NOT NULL,

  -- Repository Identity (multiple identifiers for stability)
  name VARCHAR(255) NOT NULL, -- display name
  github_repo_id BIGINT, -- GitHub numeric ID (most stable, never changes)
  github_owner VARCHAR(100) NOT NULL, -- current owner name
  github_name VARCHAR(100) NOT NULL, -- current repo name
  github_full_name VARCHAR(255) NOT NULL, -- owner/repo format
  github_url TEXT NOT NULL, -- current clone URL (https://github.com/owner/repo)

  -- Git Configuration
  default_branch VARCHAR(100) DEFAULT 'main',

  -- PR Support Configuration
  pr_mode_enabled BOOLEAN DEFAULT false, -- enable PR flow for this repo
  pr_branch_prefix VARCHAR(50) DEFAULT 'solo-unicorn/', -- branch naming prefix
  pr_target_branch VARCHAR(100), -- target branch for PRs (defaults to default_branch)
  auto_delete_pr_branches BOOLEAN DEFAULT true, -- cleanup merged branches

  -- Concurrency Control
  max_concurrent_missions INTEGER DEFAULT 1, -- 0 = unlimited

  -- Status
  status ENUM('active', 'inactive', 'error') DEFAULT 'active',
  last_accessed_at TIMESTAMP,
  last_mission_pushed_at TIMESTAMP, -- critical for mission assignment logic
  last_pr_sync_at TIMESTAMP, -- last GitHub PR sync

  -- GitHub API Integration
  github_webhook_id VARCHAR(100), -- GitHub webhook for PR events
  github_permissions JSON, -- cached repository permissions

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,

  -- Ensure unique repository per project (using stable repo ID when available)
  UNIQUE KEY unique_project_github_repo (project_id, github_repo_id),
  UNIQUE KEY unique_project_github_url (project_id, github_url),
  INDEX idx_repositories_project_id (project_id),
  INDEX idx_repositories_github_repo_id (github_repo_id),
  INDEX idx_repositories_github_full_name (github_full_name),
  INDEX idx_repositories_pr_mode (pr_mode_enabled)
);
```

### Workstation Repositories (Git Worktrees)

Tracks git worktrees on workstations for each repository.

```sql
CREATE TABLE workstation_repositories (
  id VARCHAR(26) PRIMARY KEY, -- ulid: wsrepo_01H123...
  workstation_id VARCHAR(26) NOT NULL,
  project_repository_id VARCHAR(26) NOT NULL,

  -- Main Repository Clone
  main_path TEXT NOT NULL, -- /Users/john/workspace/repo-name
  main_branch VARCHAR(100) DEFAULT 'main',

  -- Status
  clone_status ENUM('cloning', 'ready', 'error') DEFAULT 'cloning',
  clone_error TEXT,
  last_synced_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE CASCADE,
  FOREIGN KEY (project_repository_id) REFERENCES project_repositories(id) ON DELETE CASCADE,

  UNIQUE KEY unique_workstation_repo (workstation_id, project_repository_id),
  INDEX idx_ws_repositories_workstation_id (workstation_id),
  INDEX idx_ws_repositories_project_repo_id (project_repository_id)
);
```

### Git Worktrees

Manages multiple working directories from the same repository.

```sql
CREATE TABLE git_worktrees (
  id VARCHAR(26) PRIMARY KEY, -- ulid: worktree_01H123...
  workstation_repository_id VARCHAR(26) NOT NULL,

  -- Worktree Details
  branch VARCHAR(100) NOT NULL,
  worktree_path TEXT NOT NULL, -- /Users/john/workspace/repo-feature-branch

  -- Status
  status ENUM('creating', 'ready', 'busy', 'error') DEFAULT 'creating',
  error_message TEXT,

  -- Usage
  last_used_at TIMESTAMP,
  active_mission_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (workstation_repository_id) REFERENCES workstation_repositories(id) ON DELETE CASCADE,

  UNIQUE KEY unique_ws_repo_branch (workstation_repository_id, branch),
  INDEX idx_worktrees_ws_repo_id (workstation_repository_id),
  INDEX idx_worktrees_status (status)
);
```

### Project Permissions

Manages granular permissions for users on projects, supporting both private and public access control.

```sql
CREATE TABLE project_permissions (
  id VARCHAR(26) PRIMARY KEY, -- ulid: projperm_01H123...
  project_id VARCHAR(26) NOT NULL,
  user_id VARCHAR(26), -- NULL for anonymous/public permissions

  -- Permission Role
  role ENUM('public', 'contributor', 'collaborator', 'maintainer', 'owner') NOT NULL,

  -- Granular Permission Overrides (NULL = inherit from role default)
  can_read_missions BOOLEAN DEFAULT NULL,
  can_write_missions BOOLEAN DEFAULT NULL,
  can_read_workstations BOOLEAN DEFAULT NULL,
  can_execute_missions BOOLEAN DEFAULT NULL,
  can_admin_project BOOLEAN DEFAULT NULL,

  -- Additional Permissions
  can_invite_users BOOLEAN DEFAULT NULL,
  can_manage_repositories BOOLEAN DEFAULT NULL,
  can_view_analytics BOOLEAN DEFAULT NULL,

  -- Status
  status ENUM('active', 'invited', 'revoked') DEFAULT 'active',
  invited_by VARCHAR(26), -- user_id of inviter
  invited_at TIMESTAMP,
  accepted_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,

  UNIQUE KEY unique_project_user (project_id, user_id),
  INDEX idx_project_permissions_project_id (project_id),
  INDEX idx_project_permissions_user_id (user_id),
  INDEX idx_project_permissions_role (role),
  INDEX idx_project_permissions_status (status)
);
```

### Project Stars

Tracks user engagement with public projects.

```sql
CREATE TABLE project_stars (
  id VARCHAR(26) PRIMARY KEY, -- ulid: star_01H123...
  project_id VARCHAR(26) NOT NULL,
  user_id VARCHAR(26) NOT NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  UNIQUE KEY unique_project_user_star (project_id, user_id),
  INDEX idx_project_stars_project_id (project_id),
  INDEX idx_project_stars_user_id (user_id),
  INDEX idx_project_stars_created_at (created_at DESC)
);
```

### Project Activity

Tracks activity for public project analytics and discovery.

```sql
CREATE TABLE project_activity (
  id VARCHAR(26) PRIMARY KEY, -- ulid: activity_01H123...
  project_id VARCHAR(26) NOT NULL,
  user_id VARCHAR(26), -- NULL for anonymous activity

  -- Activity Details
  activity_type ENUM('mission_created', 'mission_completed', 'user_joined', 'star_added', 'repository_updated') NOT NULL,
  activity_data JSON, -- Flexible activity metadata

  -- Context
  mission_id VARCHAR(26), -- Associated mission if applicable
  workstation_id VARCHAR(26), -- Associated workstation if applicable

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE SET NULL,
  FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE SET NULL,

  INDEX idx_project_activity_project_id (project_id),
  INDEX idx_project_activity_user_id (user_id),
  INDEX idx_project_activity_type (activity_type),
  INDEX idx_project_activity_created_at (created_at DESC)
);
```

### Project Workstations

Defines which workstations can work on which projects.

```sql
CREATE TABLE project_workstations (
  id VARCHAR(26) PRIMARY KEY, -- ulid: projws_01H123...
  project_id VARCHAR(26) NOT NULL,
  workstation_id VARCHAR(26) NOT NULL,

  -- Access Control
  can_receive_missions BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100, -- lower = higher priority

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE CASCADE,

  UNIQUE KEY unique_project_workstation (project_id, workstation_id),
  INDEX idx_project_workstations_project_id (project_id),
  INDEX idx_project_workstations_workstation_id (workstation_id)
);
```

### Flows

Defines reusable flow sequences with per-stage review requirements.

```sql
CREATE TABLE flows (
  id VARCHAR(26) PRIMARY KEY, -- ulid: flow_01H123...
  project_id VARCHAR(26) NOT NULL,

  -- Flow Details
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Flow Configuration
  stage_sequence JSON NOT NULL, -- [{"stage": "clarify", "requireReview": true}, ...]
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false, -- System-provided flows

  -- Usage Statistics
  missions_using_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,

  INDEX idx_flows_project_id (project_id),
  INDEX idx_flows_is_default (is_default)
);
```

### Custom Flow Stages

Defines custom stages that can be used in flows beyond system stages.

```sql
CREATE TABLE flow_stages (
  id VARCHAR(26) PRIMARY KEY, -- ulid: flowstage_01H123...
  project_id VARCHAR(26) NULL, -- NULL for system stages

  -- Stage Details
  name VARCHAR(50) NOT NULL, -- Stage identifier
  display_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Stage Configuration
  prompt_template TEXT, -- Custom prompt for this stage
  is_system BOOLEAN DEFAULT false,
  requires_code_execution BOOLEAN DEFAULT true,

  -- Usage Statistics
  usage_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,

  UNIQUE KEY unique_stage_name_per_project (project_id, name),
  INDEX idx_flow_stages_project_id (project_id),
  INDEX idx_flow_stages_is_system (is_system)
);
```

### Actors

Defines AI agent personalities and methodologies for missions.

```sql
CREATE TABLE actors (
  id VARCHAR(26) PRIMARY KEY, -- ulid: actor_01H123...
  project_id VARCHAR(26) NOT NULL,

  -- Actor Details
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Configuration
  system_prompt TEXT, -- LLM system prompt
  methodology TEXT, -- working approach description
  focus_areas JSON, -- ["frontend", "testing", "security"]

  -- Usage
  is_default BOOLEAN DEFAULT false,
  missions_assigned_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,

  INDEX idx_actors_project_id (project_id),
  INDEX idx_actors_is_default (is_default)
);
```

### Missions

Core mission entity supporting flexible flows and workstation-based execution.

```sql
CREATE TABLE missions (
  id VARCHAR(26) PRIMARY KEY, -- ulid: mission_01H123...
  project_id VARCHAR(26) NOT NULL,

  -- Mission Content
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Refined Content (AI-generated)
  refined_title VARCHAR(500),
  refined_description TEXT,

  -- Mission Configuration
  priority INTEGER DEFAULT 3, -- 1-5 (5=highest)
  list ENUM('todo', 'doing', 'review', 'done', 'loop') DEFAULT 'todo',
  list_order DECIMAL(10,5) DEFAULT 1000.00000, -- for drag-and-drop ordering

  -- Flow
  stage VARCHAR(50) DEFAULT 'clarify', -- Now supports custom stages
  flow_id VARCHAR(26),
  flow_config JSON, -- customized stage sequence and review requirements
  current_flow_task INTEGER DEFAULT 0, -- Current position in flow
  requires_review BOOLEAN DEFAULT false, -- Current stage requires review

  -- Assignment (maintain compatibility with current system)
  project_repository_id VARCHAR(26), -- target repository
  main_repository_id VARCHAR(26), -- alias for compatibility with current system
  target_branch VARCHAR(100) DEFAULT 'main', -- target git branch
  actor_id VARCHAR(26), -- assigned AI persona

  -- PR Support
  pr_mode ENUM('disabled', 'enabled', 'auto') DEFAULT 'auto', -- per-mission PR override
  pr_created BOOLEAN DEFAULT false, -- has PR been created for this mission
  github_pr_number INTEGER, -- GitHub PR number
  github_pr_url TEXT, -- full GitHub PR URL
  pr_branch_name VARCHAR(255), -- mission-specific branch name
  pr_merge_strategy ENUM('merge', 'squash', 'rebase') DEFAULT 'squash',

  -- Loop Mission Configuration
  is_loop BOOLEAN DEFAULT false, -- loop mission flag
  loop_schedule JSON, -- future: {"maxPerDay": 2, "maxPerHour": 1}

  -- Status & Execution
  ready BOOLEAN DEFAULT false,
  agent_session_status ENUM('INACTIVE', 'PUSHING', 'ACTIVE') DEFAULT 'INACTIVE',
  agent_session_status_changed_at TIMESTAMP DEFAULT NOW(), -- for timeout detection
  code_agent_type VARCHAR(50), -- claude-code, cursor, etc.
  code_agent_name VARCHAR(255), -- display name from workstation
  last_code_agent_session_id VARCHAR(100), -- for tracking code agent sessions

  -- Plan (Hybrid filesystem + database tracking)
  plan_tasks_summary JSON, -- Array of one-liner task descriptions for UI display
  plan_current_task INTEGER DEFAULT 0, -- Current task being worked on (0-based index)

  -- Review
  review_status ENUM('pending', 'approved', 'rejected') DEFAULT NULL,
  review_feedback TEXT, -- feedback when rejected
  review_requested_at TIMESTAMP NULL,
  review_completed_at TIMESTAMP NULL,
  reviewed_by_user_id VARCHAR(26), -- user who approved/rejected

  -- Dependencies
  dependency_count INTEGER DEFAULT 0, -- cached count for performance

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE SET NULL,
  FOREIGN KEY (project_repository_id) REFERENCES project_repositories(id) ON DELETE SET NULL,

  -- Computed field for compatibility
  CONSTRAINT main_repository_id_computed
    CHECK (main_repository_id IS NULL OR main_repository_id = project_repository_id),
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

  INDEX idx_missions_project_id (project_id),
  INDEX idx_missions_list (list),
  INDEX idx_missions_stage (stage),
  INDEX idx_missions_ready (ready),
  INDEX idx_missions_agent_session_status (agent_session_status),
  INDEX idx_missions_is_loop (is_loop),
  INDEX idx_missions_agent_session_status_changed_at (agent_session_status_changed_at),
  INDEX idx_missions_priority_list_order (priority DESC, list, list_order),
  INDEX idx_missions_created_at (created_at),
  INDEX idx_missions_pr_number (github_pr_number),
  INDEX idx_missions_pr_created (pr_created)
);
```

### Mission Dependencies

Manages dependencies between missions.

```sql
CREATE TABLE mission_dependencies (
  id VARCHAR(26) PRIMARY KEY, -- ulid: missiondep_01H123...
  mission_id VARCHAR(26) NOT NULL, -- the mission that depends
  depends_on_mission_id VARCHAR(26) NOT NULL, -- the mission it depends on

  -- Dependency Type
  dependency_type ENUM('blocks', 'relates_to') DEFAULT 'blocks',

  -- Status
  status ENUM('active', 'resolved') DEFAULT 'active',
  resolved_at TIMESTAMP NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_mission_id) REFERENCES missions(id) ON DELETE CASCADE,

  UNIQUE KEY unique_mission_dependency (mission_id, depends_on_mission_id),
  INDEX idx_mission_deps_mission_id (mission_id),
  INDEX idx_mission_deps_depends_on (depends_on_mission_id),
  INDEX idx_mission_deps_status (status)
);
```

### Mission Assignment Strategy

**Client-Side Assignment**: Missions are assigned to available workstations based on:

1. **Project Workstation Access**: Which workstations can access the project
2. **Agent Availability**: Real-time agent status via WebSocket presence
3. **Repository Concurrency**: Respect `maxConcurrencyLimit` per repository
4. **Mission Priority**: Higher priority missions assigned first

**No Database Table Needed**: Assignment logic uses workstation presence data and simple mission queries.

### Mission Attachments

File attachments for missions (wireframes, specs, etc.).

```sql
CREATE TABLE mission_attachments (
  id VARCHAR(26) PRIMARY KEY, -- ulid: attach_01H123...
  mission_id VARCHAR(26) NOT NULL,

  -- File Details
  filename VARCHAR(500) NOT NULL,
  original_filename VARCHAR(500) NOT NULL,
  content_type VARCHAR(100),
  file_size BIGINT,

  -- Storage
  storage_provider ENUM('s3', 'local', 'cdn') DEFAULT 's3',
  storage_path TEXT NOT NULL, -- S3 key or local path
  storage_url TEXT, -- public URL if applicable

  -- Context
  attachment_type ENUM('spec', 'wireframe', 'reference', 'feedback', 'other') DEFAULT 'other',
  description TEXT,

  -- Timestamps
  uploaded_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,

  INDEX idx_attachments_mission_id (mission_id),
  INDEX idx_attachments_type (attachment_type)
);
```

### Code Agent Sessions

Tracks individual code agent execution sessions for missions.

```sql
CREATE TABLE code_agent_sessions (
  id VARCHAR(26) PRIMARY KEY, -- ulid: session_01H123...
  mission_id VARCHAR(26) NOT NULL,
  code_agent_type VARCHAR(50) NOT NULL, -- claude-code, cursor, etc.
  code_agent_name VARCHAR(255), -- display name
  workstation_id VARCHAR(26) NOT NULL,

  -- Session Details
  external_session_id VARCHAR(100), -- code agent's internal session ID
  stage VARCHAR(50), -- Now supports custom stages

  -- Execution Environment
  worktree_id VARCHAR(26), -- git worktree used
  working_directory TEXT,

  -- Status & Results
  status ENUM('starting', 'active', 'completed', 'failed', 'timeout') DEFAULT 'starting',
  start_reason TEXT, -- why this session was started
  end_reason TEXT, -- why this session ended

  -- Output & Results
  output_summary TEXT, -- AI-generated summary of work done
  files_changed JSON, -- ["src/auth.ts", "tests/auth.test.ts"]
  commits_made JSON, -- [{"sha": "abc123", "message": "Add login form"}]

  -- Timing
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP NULL,
  duration_seconds INTEGER, -- calculated on completion

  -- Error Handling
  error_type VARCHAR(100),
  error_message TEXT,
  recovery_attempts INTEGER DEFAULT 0,

  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE CASCADE,
  FOREIGN KEY (worktree_id) REFERENCES git_worktrees(id) ON DELETE SET NULL,

  INDEX idx_sessions_mission_id (mission_id),
  INDEX idx_sessions_code_agent_type (code_agent_type),
  INDEX idx_sessions_workstation_id (workstation_id),
  INDEX idx_sessions_status (status),
  INDEX idx_sessions_started_at (started_at)
);
```

### GitHub Pull Requests

Tracks GitHub PRs created by AI agents for missions in PR mode.

```sql
CREATE TABLE github_pull_requests (
  id VARCHAR(26) PRIMARY KEY, -- ulid: ghpr_01H123...
  mission_id VARCHAR(26) NOT NULL,
  project_repository_id VARCHAR(26) NOT NULL,

  -- GitHub PR Information
  github_pr_number INTEGER NOT NULL,
  github_pr_id BIGINT, -- GitHub PR ID (more stable)
  github_pr_url TEXT NOT NULL,

  -- Branch Information
  source_branch VARCHAR(255) NOT NULL, -- solo-unicorn/mission-123-feature
  target_branch VARCHAR(255) NOT NULL, -- main, develop, etc.

  -- PR Content
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- PR Status
  status ENUM('open', 'closed', 'merged', 'draft') NOT NULL,
  mergeable BOOLEAN,
  mergeable_state VARCHAR(50), -- clean, dirty, unstable, etc.

  -- Review Status
  review_status ENUM('pending', 'approved', 'changes_requested', 'dismissed') DEFAULT 'pending',
  required_reviews_count INTEGER DEFAULT 0,
  approved_reviews_count INTEGER DEFAULT 0,

  -- AI Code Agent Information
  created_by_code_agent_type VARCHAR(50), -- which code agent type created this PR
  created_by_code_agent_name VARCHAR(255), -- code agent display name
  created_by_workstation_id VARCHAR(26), -- workstation that created this PR

  -- GitHub Metadata
  github_created_at TIMESTAMP,
  github_updated_at TIMESTAMP,
  github_merged_at TIMESTAMP,
  github_closed_at TIMESTAMP,

  -- Sync Information
  last_synced_at TIMESTAMP DEFAULT NOW(),
  sync_status ENUM('synced', 'pending', 'error') DEFAULT 'pending',
  sync_error TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (mission_id) REFERENCES missions(id) ON DELETE CASCADE,
  FOREIGN KEY (project_repository_id) REFERENCES project_repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_workstation_id) REFERENCES workstations(id) ON DELETE SET NULL,

  UNIQUE KEY unique_repo_pr_number (project_repository_id, github_pr_number),
  INDEX idx_github_prs_mission_id (mission_id),
  INDEX idx_github_prs_repo_id (project_repository_id),
  INDEX idx_github_prs_status (status),
  INDEX idx_github_prs_review_status (review_status),
  INDEX idx_github_prs_sync_status (sync_status)
);
```

### GitHub PR Comments

Tracks GitHub PR comments for AI agent feedback integration.

```sql
CREATE TABLE github_pr_comments (
  id VARCHAR(26) PRIMARY KEY, -- ulid: ghcomment_01H123...
  github_pr_id VARCHAR(26) NOT NULL, -- references github_pull_requests.id

  -- GitHub Comment Information
  github_comment_id BIGINT NOT NULL, -- GitHub comment ID
  comment_type ENUM('issue', 'review', 'review_comment') NOT NULL,

  -- Comment Content
  body TEXT NOT NULL,
  html_url TEXT, -- GitHub comment URL

  -- Author Information
  author_github_login VARCHAR(100),
  author_github_id BIGINT,
  author_type ENUM('user', 'bot') DEFAULT 'user',

  -- Position Information (for review comments)
  file_path TEXT, -- file path for line comments
  line_number INTEGER, -- line number for line comments
  diff_hunk TEXT, -- diff context

  -- Review Information
  review_id BIGINT, -- GitHub review ID (if part of review)
  review_state ENUM('pending', 'approved', 'changes_requested', 'commented'),

  -- AI Processing
  processed_by_ai BOOLEAN DEFAULT false,
  ai_response TEXT, -- AI code agent's response to this comment
  ai_response_at TIMESTAMP,

  -- GitHub Metadata
  github_created_at TIMESTAMP,
  github_updated_at TIMESTAMP,

  -- Sync Information
  last_synced_at TIMESTAMP DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (github_pr_id) REFERENCES github_pull_requests(id) ON DELETE CASCADE,

  UNIQUE KEY unique_github_comment (github_comment_id),
  INDEX idx_pr_comments_pr_id (github_pr_id),
  INDEX idx_pr_comments_type (comment_type),
  INDEX idx_pr_comments_author (author_github_login),
  INDEX idx_pr_comments_processed (processed_by_ai),
  INDEX idx_pr_comments_review_state (review_state)
);
```

### Helpers (System Infrastructure)

System-wide helper table for database locking and configuration storage.
**Critical**: This table is required for the database locking mechanism used in mission assignment.

```sql
CREATE TABLE helpers (
  id VARCHAR(26) PRIMARY KEY, -- ulid: helper_01H123...

  -- Helper Identity
  code VARCHAR(100) UNIQUE NOT NULL, -- unique identifier (e.g., 'MISSION_PUSH_LOCK')
  description TEXT,

  -- Helper Data
  state JSON, -- flexible state storage

  -- Status
  active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_helpers_code (code),
  INDEX idx_helpers_active (active),
  INDEX idx_helpers_updated_at (updated_at)
);

-- Pre-populate with required system helpers
INSERT INTO helpers (id, code, description, state) VALUES
('helper_01MISSION_PUSH_LOCK', 'MISSION_PUSH_LOCK', 'Database lock for mission assignment operations',
 '{"locked": false, "timestamp": null, "expiresAt": null}');
```

## Indexes and Performance Optimization

### High-Frequency Query Optimization

**Critical Performance Note**: These indexes are optimized for queries that run every 10 seconds (monitoring) and complex mission assignment queries with embedded subqueries.

```sql
-- ULTRA HIGH FREQUENCY: Monitoring queries (every 10 seconds)
-- Count active missions: SELECT COUNT(*) FROM missions WHERE agent_session_status IN ('PUSHING', 'ACTIVE')
CREATE INDEX idx_monitoring_active_missions ON missions (
  agent_session_status,
  list
) WHERE agent_session_status IN ('PUSHING', 'ACTIVE') AND list NOT IN ('done', 'review');

-- Count ready missions: SELECT COUNT(*) FROM missions WHERE ready = true AND agent_session_status = 'INACTIVE'
CREATE INDEX idx_monitoring_ready_missions ON missions (
  ready,
  agent_session_status,
  list
) WHERE ready = true AND agent_session_status = 'INACTIVE' AND list NOT IN ('done', 'review');

-- COMPLEX QUERY: Mission assignment with embedded subqueries (from mission-finder.ts)
-- Primary mission assignment query with all conditions
CREATE INDEX idx_mission_assignment_complex ON missions (
  ready,
  agent_session_status,
  list,
  priority DESC,
  list_order,
  created_at
) WHERE ready = true AND agent_session_status = 'INACTIVE' AND list NOT IN ('done', 'review');

-- Repository concurrency subquery: COUNT(*) FROM missions WHERE main_repository_id = X AND agent_session_status IN ('PUSHING', 'ACTIVE')
CREATE INDEX idx_repo_active_missions ON missions (
  main_repository_id,
  agent_session_status,
  list
) WHERE agent_session_status IN ('PUSHING', 'ACTIVE') AND list NOT IN ('done', 'review');

-- Code Agent concurrency subquery: COUNT(*) FROM missions WHERE code_agent_type = X AND agent_session_status IN ('PUSHING', 'ACTIVE')
CREATE INDEX idx_code_agent_active_missions ON missions (
  code_agent_type,
  agent_session_status,
  list
) WHERE agent_session_status IN ('PUSHING', 'ACTIVE') AND list NOT IN ('done', 'review');

-- Mission dependency resolution (EXISTS subquery)
CREATE INDEX idx_mission_dependencies_blocking ON mission_dependencies (
  mission_id,
  status,
  depends_on_mission_id
) WHERE status = 'active';

-- Code Agent availability for mission assignment
CREATE INDEX idx_code_agent_availability ON code_agents (
  workstation_id,
  status,
  rate_limit_reset_at,
  max_concurrency_limit
) WHERE status IN ('available', 'busy');

-- Mission-code agent relationship queries
CREATE INDEX idx_mission_code_agents_assignment ON mission_code_agents (
  mission_id,
  code_agent_id,
  assignment_status,
  priority
);

-- Database locking (helpers table - very frequent)
CREATE INDEX idx_helpers_locking ON helpers (
  code,
  active,
  updated_at
) WHERE active = true;

-- Workstation monitoring and presence
CREATE INDEX idx_workstation_monitoring ON workstations (
  organization_id,
  status,
  last_seen_at DESC,
  last_heartbeat_at DESC
);

-- Project mission overview (web UI)
CREATE INDEX idx_project_missions_overview ON missions (
  project_id,
  list,
  priority DESC,
  list_order,
  updated_at DESC
) WHERE list IN ('todo', 'doing', 'review');

-- Code Agent session tracking
CREATE INDEX idx_code_agent_sessions_active ON code_agent_sessions (
  code_agent_id,
  status,
  started_at DESC
) WHERE status IN ('starting', 'active');

-- Git worktree management
CREATE INDEX idx_worktrees_usage ON git_worktrees (
  workstation_repository_id,
  status,
  active_mission_count,
  last_used_at DESC
);
```

### Simple Query-Based Monitoring

**Performance Strategy**: Use simple indexed queries for monitoring instead of complex materialized views.

```sql
-- Simple monitoring queries with proper indexes
-- Count active missions
SELECT
  COUNT(*) FILTER (WHERE agent_session_status = 'PUSHING') as pushing_count,
  COUNT(*) FILTER (WHERE agent_session_status = 'ACTIVE') as active_count,
  COUNT(*) FILTER (WHERE agent_session_status IN ('PUSHING', 'ACTIVE')) as total_active,
  COUNT(*) FILTER (WHERE ready = true AND agent_session_status = 'INACTIVE') as ready_count
FROM missions
WHERE list NOT IN ('done', 'review');

-- Code agent availability check (via workstation presence)
SELECT
  w.id as workstation_id,
  JSON_EXTRACT(w.available_code_agents, '$[*].type') as agent_types,
  JSON_EXTRACT(w.available_code_agents, '$[*].available') as availability,
  COALESCE(t.active_count, 0) as current_active_missions
FROM workstations w
LEFT JOIN (
  SELECT code_agent_type, COUNT(*) as active_count
  FROM missions
  WHERE agent_session_status IN ('PUSHING', 'ACTIVE')
    AND list NOT IN ('done', 'review')
  GROUP BY code_agent_type
) t ON JSON_CONTAINS(w.available_code_agents, JSON_QUOTE(t.code_agent_type), '$.type')
WHERE w.status = 'online';
```

### Error Recovery Functions

```sql
-- Reset stuck missions based on timeout
CREATE FUNCTION reset_stuck_missions()
RETURNS INTEGER
LANGUAGE SQL
AS $$
  UPDATE missions SET
    agent_session_status = 'INACTIVE',
    code_agent_id = NULL,
    agent_session_status_changed_at = NOW()
  WHERE
    (agent_session_status = 'PUSHING' AND agent_session_status_changed_at < NOW() - INTERVAL '10 minutes')
    OR
    (agent_session_status = 'ACTIVE' AND agent_session_status_changed_at < NOW() - INTERVAL '50 minutes');
$$;
```

### Permission System Functions

```sql
-- Check if user has specific permission on project
CREATE FUNCTION user_has_project_permission(
  p_user_id VARCHAR(26),
  p_project_id VARCHAR(26),
  p_permission VARCHAR(50)
)
RETURNS BOOLEAN
LANGUAGE SQL
READS SQL DATA
AS $$
  SELECT CASE
    -- Check if project is public and permission is public-allowed
    WHEN EXISTS (
      SELECT 1 FROM projects
      WHERE id = p_project_id
        AND visibility = 'public'
        AND (
          (p_permission = 'read_missions' AND public_mission_read = true) OR
          (p_permission = 'read_memory' AND public_memory_read = true)
        )
    ) THEN true

    -- Check organization membership first
    WHEN EXISTS (
      SELECT 1 FROM projects p
      JOIN organization_memberships om ON om.organization_id = p.organization_id
      WHERE p.id = p_project_id
        AND om.user_id = p_user_id
        AND om.status = 'active'
        AND om.role IN ('owner', 'admin')
    ) THEN true

    -- Check specific project permissions
    WHEN EXISTS (
      SELECT 1 FROM project_permissions pp
      WHERE pp.project_id = p_project_id
        AND pp.user_id = p_user_id
        AND pp.status = 'active'
        AND (
          CASE p_permission
            WHEN 'read_missions' THEN COALESCE(pp.can_read_missions,
              CASE pp.role
                WHEN 'public' THEN false
                WHEN 'contributor' THEN true
                WHEN 'collaborator' THEN true
                WHEN 'maintainer' THEN true
                WHEN 'owner' THEN true
                ELSE false
              END)
            WHEN 'write_missions' THEN COALESCE(pp.can_write_missions,
              CASE pp.role
                WHEN 'public' THEN false
                WHEN 'contributor' THEN true
                WHEN 'collaborator' THEN true
                WHEN 'maintainer' THEN true
                WHEN 'owner' THEN true
                ELSE false
              END)
            WHEN 'read_workstations' THEN COALESCE(pp.can_read_workstations,
              CASE pp.role
                WHEN 'public' THEN false
                WHEN 'contributor' THEN false
                WHEN 'collaborator' THEN true
                WHEN 'maintainer' THEN true
                WHEN 'owner' THEN true
                ELSE false
              END)
            WHEN 'execute_missions' THEN COALESCE(pp.can_execute_missions,
              CASE pp.role
                WHEN 'public' THEN false
                WHEN 'contributor' THEN false
                WHEN 'collaborator' THEN false
                WHEN 'maintainer' THEN true
                WHEN 'owner' THEN true
                ELSE false
              END)
            WHEN 'admin_project' THEN COALESCE(pp.can_admin_project,
              CASE pp.role
                WHEN 'owner' THEN true
                ELSE false
              END)
            ELSE false
          END
        )
    ) THEN true

    ELSE false
  END;
$$;

-- Get user's effective role on project
CREATE FUNCTION get_user_project_role(
  p_user_id VARCHAR(26),
  p_project_id VARCHAR(26)
)
RETURNS VARCHAR(20)
LANGUAGE SQL
READS SQL DATA
AS $$
  SELECT COALESCE(
    -- Check organization membership first (highest priority)
    (SELECT CASE
      WHEN om.role IN ('owner', 'admin') THEN 'owner'
      ELSE NULL
    END
    FROM projects p
    JOIN organization_memberships om ON om.organization_id = p.organization_id
    WHERE p.id = p_project_id
      AND om.user_id = p_user_id
      AND om.status = 'active'
    LIMIT 1),

    -- Check project-specific permissions
    (SELECT pp.role::VARCHAR(20)
    FROM project_permissions pp
    WHERE pp.project_id = p_project_id
      AND pp.user_id = p_user_id
      AND pp.status = 'active'
    LIMIT 1),

    -- Check if project is public
    (SELECT CASE
      WHEN p.visibility = 'public' THEN 'public'
      ELSE 'none'
    END
    FROM projects p
    WHERE p.id = p_project_id
    LIMIT 1),

    'none'
  );
$$;

-- Update project star count trigger helper
CREATE FUNCTION update_project_star_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects
    SET star_count = star_count + 1
    WHERE id = NEW.project_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects
    SET star_count = GREATEST(star_count - 1, 0)
    WHERE id = OLD.project_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
```

### Database Triggers

```sql
-- Update agent session status timestamp on status changes
DELIMITER //
CREATE TRIGGER update_agent_session_status_timestamp
BEFORE UPDATE ON missions
FOR EACH ROW
BEGIN
  -- Update timestamp when agent session status changes
  IF OLD.agent_session_status != NEW.agent_session_status THEN
    SET NEW.agent_session_status_changed_at = NOW();
  END IF;
END//
DELIMITER ;

-- Note: Code agent mission counts managed via workstation presence updates
-- No database triggers needed since counts are tracked client-side

-- Update dependency count when dependencies change
DELIMITER //
CREATE TRIGGER update_mission_dependency_count
AFTER INSERT ON mission_dependencies
FOR EACH ROW
BEGIN
  UPDATE missions
  SET dependency_count = (
    SELECT COUNT(*) FROM mission_dependencies
    WHERE mission_id = NEW.mission_id AND status = 'active'
  )
  WHERE id = NEW.mission_id;
END//

CREATE TRIGGER update_mission_dependency_count_delete
AFTER DELETE ON mission_dependencies
FOR EACH ROW
BEGIN
  UPDATE missions
  SET dependency_count = (
    SELECT COUNT(*) FROM mission_dependencies
    WHERE mission_id = OLD.mission_id AND status = 'active'
  )
  WHERE id = OLD.mission_id;
END//
DELIMITER ;

-- Update flow usage count
DELIMITER //
CREATE TRIGGER update_flow_usage
AFTER INSERT ON missions
FOR EACH ROW
BEGIN
  IF NEW.flow_id IS NOT NULL THEN
    UPDATE flows
    SET missions_using_count = missions_using_count + 1
    WHERE id = NEW.flow_id;
  END IF;
END//

-- Maintain main_repository_id compatibility field
CREATE TRIGGER maintain_main_repository_id
BEFORE INSERT ON missions
FOR EACH ROW
BEGIN
  SET NEW.main_repository_id = NEW.project_repository_id;
END//

CREATE TRIGGER maintain_main_repository_id_update
BEFORE UPDATE ON missions
FOR EACH ROW
BEGIN
  SET NEW.main_repository_id = NEW.project_repository_id;
END//
DELIMITER ;

-- Project star count triggers
CREATE TRIGGER project_star_count_insert
AFTER INSERT ON project_stars
FOR EACH ROW
EXECUTE FUNCTION update_project_star_count();

CREATE TRIGGER project_star_count_delete
AFTER DELETE ON project_stars
FOR EACH ROW
EXECUTE FUNCTION update_project_star_count();

-- Project activity logging triggers
DELIMITER //
CREATE TRIGGER log_mission_activity
AFTER UPDATE ON missions
FOR EACH ROW
BEGIN
  -- Log mission completion
  IF OLD.list != 'done' AND NEW.list = 'done' THEN
    INSERT INTO project_activity (id, project_id, user_id, activity_type, activity_data, mission_id)
    VALUES (
      CONCAT('activity_', SUBSTRING(MD5(RAND()) FROM 1 FOR 22)),
      NEW.project_id,
      NULL, -- Will need to be updated based on session user
      'mission_completed',
      JSON_OBJECT(
        'mission_title', NEW.title,
        'stage', NEW.stage,
        'priority', NEW.priority
      ),
      NEW.id
    );
  END IF;
END//

CREATE TRIGGER log_project_permission_changes
AFTER INSERT ON project_permissions
FOR EACH ROW
BEGIN
  IF NEW.status = 'active' AND NEW.role != 'public' THEN
    INSERT INTO project_activity (id, project_id, user_id, activity_type, activity_data)
    VALUES (
      CONCAT('activity_', SUBSTRING(MD5(RAND()) FROM 1 FOR 22)),
      NEW.project_id,
      NEW.user_id,
      'user_joined',
      JSON_OBJECT(
        'role', NEW.role,
        'invited_by', NEW.invited_by
      )
    );
  END IF;
END//
DELIMITER ;
```

## Monster Services Integration

### Monster Auth Integration

The schema integrates with Monster Auth through:

- `users.monster_auth_user_id`: Links to Monster Auth user identity
- `organizations.monster_auth_client_id`: OAuth client configuration
- Personal access tokens stored securely on workstations (not in database)

### Monster Realtime Integration

Real-time communication is handled through Monster Realtime channels:

```typescript
// Channel structure matches schema design
interface RealtimeChannels {
  // Direct workstation communication
  workstation: `workstation:${workstation.id}`;

  // Project-wide workstation updates
  project_workstations: `project:${project.id}:workstations`;

  // Mission-specific coordination
  mission: `mission:${mission.id}`;
}

// Presence metadata stored in workstations.realtime_presence_meta
interface WorkstationPresenceMeta {
  status: 'online' | 'busy' | 'offline';
  availableAgents: string[];
  activeProjects: string[];
  devServerPort?: number;
  currentMissionCount: number;
}
```

## Migration Strategy

### Phase 1: Core Entities
1. Organizations, Users, Memberships
2. Workstations, Agents
3. Projects, Repositories

### Phase 2: Mission Management
1. Flows, Actors
2. Missions, Dependencies
3. Mission Agents, Attachments

### Phase 3: Advanced Features
1. Git Worktrees
2. Agent Sessions
3. Performance optimizations

### Data Migration from v2

**Zero-Downtime Migration Strategy**

```sql
-- Phase 1: Core entities with backward compatibility
INSERT INTO organizations (id, name, slug, created_at)
SELECT
  CONCAT('org_', SUBSTRING(MD5(RAND()) FROM 1 FOR 22)) as id,
  name,
  LOWER(REPLACE(name, ' ', '-')) as slug,
  created_at
FROM v2_organizations;

-- Phase 2: Migrate missions with compatibility fields
INSERT INTO missions (
  id, project_id, title, description, priority,
  list, stage, flow_id,
  project_repository_id, main_repository_id, -- both fields for compatibility
  agent_session_status, ready,
  created_at
)
SELECT
  t.id, t.project_id, t.title, t.description, t.priority,
  CASE
    WHEN t.list = 'todo' THEN 'todo'
    WHEN t.list = 'doing' THEN 'doing'
    WHEN t.list = 'done' THEN 'done'
    WHEN t.list = 'check' THEN 'review' -- enum mapping
  END as list,
  COALESCE(t.stage, 'execute') as stage,
  NULL as flow_id,
  r.id as project_repository_id,
  r.id as main_repository_id, -- compatibility
  t.agent_session_status,
  t.ready,
  t.created_at
FROM v2_missions t
JOIN v2_repositories r ON r.id = t.main_repository_id;

-- Phase 3: Initialize materialized views after migration
REFRESH MATERIALIZED VIEW mv_active_mission_counts;
REFRESH MATERIALIZED VIEW mv_agent_capacity;

-- Phase 4: Validate data integrity
SELECT
  'missions' as table_name,
  COUNT(*) as v2_count,
  (SELECT COUNT(*) FROM missions) as v3_count,
  CASE WHEN COUNT(*) = (SELECT COUNT(*) FROM missions) THEN '✓ MATCH' ELSE '✗ MISMATCH' END as status
FROM v2_missions;
```

## V3 Architecture Adaptations & Performance Optimizations

### Critical Issues Resolved

This v3 schema design addresses **critical performance and compatibility issues** identified from analyzing existing query patterns in the v2 codebase:

#### 1. **Workstation-Agent Architecture Alignment**
- **Problem**: V3 introduces workstation hierarchy (Organizations → Workstations → Agents) but existing mission assignment expects direct mission-agent relationships
- **Solution**: Hybrid approach with denormalized fields in `mission_agents` table:
  - Maintains workstation hierarchy for management
  - Provides direct mission-agent relationships for performance
  - Adds `workstation_id` and `project_workstation_id` for validation

#### 2. **Ultra-High Frequency Query Optimization**
- **Problem**: Monitoring queries run every 10 seconds and must be lightning fast
- **Solution**: Materialized views + specialized indexes:
  - `mv_active_mission_counts` - cached aggregations for monitoring
  - `mv_agent_capacity` - precomputed agent availability
  - Triggered refresh on mission status changes
  - Dedicated functions: `get_active_mission_counts()`, `is_agent_available()`

#### 3. **Complex Mission Assignment Query Performance**
- **Problem**: Mission finder uses embedded subqueries checking repository/agent concurrency
- **Solution**: Purpose-built composite indexes:
  - `idx_repo_active_missions` - repository concurrency subquery
  - `idx_agent_active_missions` - agent concurrency subquery
  - `idx_mission_assignment_complex` - primary mission selection
  - `idx_mission_dependencies_blocking` - dependency resolution

#### 4. **Missing Critical Infrastructure**
- **Added `helpers` table** - database locking mechanism for atomic mission assignment
- **Added `agent_settings`** - compatibility with existing agent configuration
- **Added `last_mission_pushed_at`** - required for mission distribution logic
- **Added `main_repository_id`** - compatibility field with triggers

### Query Pattern Adaptations

#### Current V2 Pattern → V3 Optimization
```sql
-- V2: Direct mission-agent query (fast)
SELECT * FROM mission_agents ta
JOIN agents a ON a.id = ta.agent_id
WHERE ta.mission_id = ?

-- V3: Same performance with denormalized fields
SELECT ta.*, a.*, w.status as workstation_status
FROM mission_agents ta
JOIN agents a ON a.id = ta.agent_id
JOIN workstations w ON w.id = ta.workstation_id  -- denormalized for speed
WHERE ta.mission_id = ?
```

#### Monitoring Queries (Every 10 Seconds)
```sql
-- V2: Count queries on main table (slower with scale)
SELECT COUNT(*) FROM missions WHERE agent_session_status IN ('PUSHING', 'ACTIVE');

-- V3: Materialized view query (ultra-fast)
SELECT total_active FROM mv_active_mission_counts;
```

#### Agent Availability Check
```sql
-- V2: Complex calculation on each check
SELECT a.*, COUNT(t.id) as active_count
FROM agents a
LEFT JOIN missions t ON t.active_agent_id = a.id AND t.agent_session_status IN ('PUSHING', 'ACTIVE')
WHERE a.id = ? AND (a.rate_limit_reset_at IS NULL OR a.rate_limit_reset_at <= NOW())
GROUP BY a.id;

-- V3: Pre-computed with function call
SELECT is_agent_available(?) as available;
```

### Performance Benchmarks Expected

| Query Type | V2 Performance | V3 Performance | Improvement |
|------------|----------------|----------------|-------------|
| Monitoring (10s) | ~50-100ms | ~1-5ms | 10-20x faster |
| Mission Assignment | ~200-500ms | ~50-100ms | 4-5x faster |
| Agent Availability | ~10-50ms | ~1-2ms | 10-25x faster |
| Mission Count | ~20-100ms | ~1ms | 20-100x faster |

### Backward Compatibility

- **Field Aliases**: `main_repository_id` maintained via computed column
- **Enum Compatibility**: Trigger-based status mapping where needed
- **API Compatibility**: Existing query patterns supported with better performance
- **Migration Path**: Clear data migration from v2 → v3 with zero downtime

### Scalability Design

- **Horizontal Scaling**: Workstation-based partitioning ready
- **Read Replicas**: Materialized views perfect for read-only replicas
- **Sharding Ready**: Organization-based sharding possible
- **Cache Integration**: Materialized views integrate with Redis/Memcached

This comprehensive schema supports all the features outlined in the UI/UX and CLI design documents while providing **dramatic performance improvements** for the most critical query patterns. The design is optimized for the workstation-centric architecture and flexible flow system that defines Solo Unicorn v3, with **special attention to ultra-high frequency monitoring queries** that are essential for real-time mission orchestration.
