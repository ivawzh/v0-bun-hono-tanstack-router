# Solo Unicorn v3 Database Schema Design

## Overview

This document defines the complete database schema for Solo Unicorn v3, supporting the workstation-based architecture, flexible workflow system, git worktree management, and Monster services integration.

## Architecture Principles

- **Workstation-Centric**: Organizations own workstations, workstations contain agents
- **Flexible Workflows**: Template-based workflow system with customizable modes
- **Git Worktree Support**: Multiple working directories from same repository
- **Monster Integration**: Compatible with Monster Auth and Monster Realtime
- **Multi-tenancy**: Organization-based isolation with project-level access control
- **Audit Trail**: Complete history tracking for all operations
- **PR Support**: Optional pull request workflow for controlled development

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
- Existing task assignment code requires complex agent queries (impossible with JSONB)
- Server needs agent status, concurrency limits, and type for task assignment
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

**Decision**: Optional per-project and per-task PR workflow

**Rationale**:
- Early stage projects need fast iteration (direct push to main)
- Production projects need code review and controlled changes
- Seamless GitHub integration with PR creation and comment parsing
- AI agents can respond to GitHub PR feedback

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
     1                    *
     |                    |
     *                    1
  Tasks *---* TaskAgents *---1 Agents
     |               |
     |               |
     1               *
     |               |
     *               1
WorkflowTemplates   GitHubPRs
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
  
  -- Monster Auth integration
  monster_auth_client_id VARCHAR(100), -- OAuth client ID
  
  -- Settings
  default_workflow_template_id VARCHAR(26),
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

Users have stable identity within Solo Unicorn, supporting multiple authentication methods.

```sql
CREATE TABLE users (
  id VARCHAR(26) PRIMARY KEY, -- ulid: user_01H123...
  
  -- Primary Identity
  email VARCHAR(255) UNIQUE NOT NULL, -- primary identifier
  name VARCHAR(255),
  avatar TEXT, -- avatar URL
  
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

### User Authentications

Separate table for authentication methods, supporting multiple providers per user.

```sql
CREATE TABLE user_authentications (
  id VARCHAR(26) PRIMARY KEY, -- ulid: userauth_01H123...
  user_id VARCHAR(26) NOT NULL,
  
  -- Provider Information
  provider ENUM('google', 'password', 'github') NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL, -- googleUserId, email for password
  
  -- Provider-Specific Data (JSON for flexibility)
  provider_data JSON, -- GoogleUser or PasswordUser data from Monster Auth
  
  -- Status
  is_primary BOOLEAN DEFAULT false, -- primary authentication method
  verified BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_provider_user (provider, provider_user_id),
  INDEX idx_user_auth_user_id (user_id),
  INDEX idx_user_auth_provider (provider),
  INDEX idx_user_auth_primary (user_id, is_primary)
);
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

### Agents

Simplified agents table for server-side task assignment. Client-side configuration stored in local JSON.

```sql
CREATE TABLE agents (
  id VARCHAR(26) PRIMARY KEY, -- ulid: agent_01H123...
  workstation_id VARCHAR(26) NOT NULL,
  
  -- Agent Identity
  type ENUM('claude-code', 'cursor', 'opencode', 'custom') NOT NULL,
  name VARCHAR(255) NOT NULL, -- display name
  version VARCHAR(50), -- agent version
  
  -- Server-Side Configuration (needed for task assignment)
  max_concurrency_limit INTEGER DEFAULT 1, -- 0 = unlimited
  
  -- Status & Rate Limiting
  status ENUM('available', 'busy', 'rate_limited', 'error', 'disabled') DEFAULT 'available',
  rate_limit_reset_at TIMESTAMP NULL,
  rate_limit_reason TEXT,
  
  -- Usage Statistics
  tasks_completed INTEGER DEFAULT 0,
  total_execution_time INTEGER DEFAULT 0, -- seconds
  last_task_pushed_at TIMESTAMP,
  active_task_count INTEGER DEFAULT 0, -- cached count for performance
  
  -- Rate Limiting (from current system)
  rate_limit_hits INTEGER DEFAULT 0,
  rate_limit_window_start TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE CASCADE,
  
  INDEX idx_agents_workstation_id (workstation_id),
  INDEX idx_agents_type (type),
  INDEX idx_agents_status (status),
  INDEX idx_agents_rate_limit_reset_at (rate_limit_reset_at)
);
```

### Agent Type Definitions (Server-Side Static Configuration)

Server maintains static configuration for agent capabilities:

```typescript
// Server-side agent type definitions
interface AgentTypeDefinition {
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
const AGENT_TYPE_DEFINITIONS: Record<string, AgentTypeDefinition> = {
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

### Client-Side Agent Configuration

Workstation stores agent-specific configuration in local JSON file:

```typescript
// ~/.solo-unicorn/agents.json
interface WorkstationAgentConfig {
  version: string;
  workstationId: string;
  agents: {
    [agentId: string]: {
      // Agent Identity
      id: string;
      type: 'claude-code' | 'cursor' | 'opencode' | 'custom';
      name: string;
      
      // Local Configuration (not stored in database)
      configPath: string;              // ~/.claude, /Applications/Cursor.app
      executablePath?: string;         // /usr/local/bin/cursor
      environmentVars: Record<string, string>; // PATH, CLAUDE_CONFIG_DIR, etc.
      
      // Agent-Specific Settings
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
      tasksCompleted: number;
      lastUsed?: string;               // ISO timestamp
      averageTaskDuration?: number;    // seconds
    };
  };
  
  // Global Settings
  settings: {
    autoUpdateAgentStatus: boolean;
    healthCheckInterval: number;       // seconds
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    backupConfig: boolean;
  };
}
```
```

### Projects

Projects contain tasks and define which workstations can work on them.

```sql
CREATE TABLE projects (
  id VARCHAR(26) PRIMARY KEY, -- ulid: proj_01H123...
  organization_id VARCHAR(26) NOT NULL,
  
  -- Project Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(100), -- URL-safe identifier within org
  
  -- Configuration
  default_workflow_template_id VARCHAR(26),
  default_actor_id VARCHAR(26),
  
  -- Project Memory (shared context for all tasks)
  memory TEXT, -- markdown content
  
  -- Pull Request Configuration
  pr_mode_default ENUM('disabled', 'enabled') DEFAULT 'disabled', -- default PR mode for new tasks
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
  INDEX idx_projects_organization_id (organization_id),
  INDEX idx_projects_status (status)
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
  pr_mode_enabled BOOLEAN DEFAULT false, -- enable PR workflow for this repo
  pr_branch_prefix VARCHAR(50) DEFAULT 'solo-unicorn/', -- branch naming prefix
  pr_target_branch VARCHAR(100), -- target branch for PRs (defaults to default_branch)
  auto_delete_pr_branches BOOLEAN DEFAULT true, -- cleanup merged branches
  
  -- Concurrency Control
  max_concurrent_tasks INTEGER DEFAULT 1, -- 0 = unlimited
  
  -- Status
  status ENUM('active', 'inactive', 'error') DEFAULT 'active',
  last_accessed_at TIMESTAMP,
  last_task_pushed_at TIMESTAMP, -- critical for task assignment logic
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
  active_task_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (workstation_repository_id) REFERENCES workstation_repositories(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_ws_repo_branch (workstation_repository_id, branch),
  INDEX idx_worktrees_ws_repo_id (workstation_repository_id),
  INDEX idx_worktrees_status (status)
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
  can_receive_tasks BOOLEAN DEFAULT true,
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

### Workflow Templates

Defines reusable workflow sequences with per-mode review requirements.

```sql
CREATE TABLE workflow_templates (
  id VARCHAR(26) PRIMARY KEY, -- ulid: wftpl_01H123...
  project_id VARCHAR(26) NOT NULL,
  
  -- Template Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Template Configuration
  mode_sequence JSON NOT NULL, -- [{"mode": "clarify", "requireReview": true}, ...]
  is_default BOOLEAN DEFAULT false,
  
  -- Usage Statistics
  tasks_using_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  
  INDEX idx_workflow_templates_project_id (project_id),
  INDEX idx_workflow_templates_is_default (is_default)
);
```

### Actors

Defines AI agent personalities and methodologies for tasks.

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
  tasks_assigned_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  
  INDEX idx_actors_project_id (project_id),
  INDEX idx_actors_is_default (is_default)
);
```

### Tasks

Core task entity supporting flexible workflows and workstation-based execution.

```sql
CREATE TABLE tasks (
  id VARCHAR(26) PRIMARY KEY, -- ulid: task_01H123...
  project_id VARCHAR(26) NOT NULL,
  
  -- Task Content
  title VARCHAR(500) NOT NULL,
  description TEXT,
  
  -- Refined Content (AI-generated)
  refined_title VARCHAR(500),
  refined_description TEXT,
  
  -- Task Configuration
  priority INTEGER DEFAULT 3, -- 1-5 (5=highest)
  list ENUM('todo', 'doing', 'review', 'done', 'loop') DEFAULT 'todo',
  list_order DECIMAL(10,5) DEFAULT 1000.00000, -- for drag-and-drop ordering
  
  -- Workflow
  mode ENUM('clarify', 'plan', 'execute', 'review', 'iterate') DEFAULT 'clarify',
  workflow_template_id VARCHAR(26),
  workflow_config JSON, -- customized mode sequence and review requirements
  
  -- Assignment (maintain compatibility with current system)
  project_repository_id VARCHAR(26), -- target repository
  main_repository_id VARCHAR(26), -- alias for compatibility with current system
  target_branch VARCHAR(100) DEFAULT 'main', -- target git branch
  actor_id VARCHAR(26), -- assigned AI persona
  
  -- PR Support
  pr_mode ENUM('disabled', 'enabled', 'auto') DEFAULT 'auto', -- per-task PR override
  pr_created BOOLEAN DEFAULT false, -- has PR been created for this task
  github_pr_number INTEGER, -- GitHub PR number
  github_pr_url TEXT, -- full GitHub PR URL
  pr_branch_name VARCHAR(255), -- task-specific branch name
  pr_merge_strategy ENUM('merge', 'squash', 'rebase') DEFAULT 'squash',
  
  -- Status & Execution
  ready BOOLEAN DEFAULT false,
  agent_session_status ENUM('INACTIVE', 'PUSHING', 'ACTIVE') DEFAULT 'INACTIVE',
  active_agent_id VARCHAR(26), -- currently assigned agent
  last_agent_session_id VARCHAR(100), -- for tracking agent sessions
  
  -- Plan (AI-generated in plan mode)
  plan_solution TEXT, -- selected solution approach
  plan_spec TEXT, -- implementation specification
  plan_steps JSON, -- [{"step": "Create login form", "completed": false}]
  
  -- Review
  review_instructions TEXT, -- instructions for human review
  review_feedback TEXT, -- feedback when rejected
  review_attachments JSON, -- files attached to review feedback
  
  -- Dependencies
  dependency_count INTEGER DEFAULT 0, -- cached count for performance
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP NULL,
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (project_repository_id) REFERENCES project_repositories(id) ON DELETE SET NULL,
  
  -- Computed field for compatibility
  CONSTRAINT main_repository_id_computed 
    CHECK (main_repository_id IS NULL OR main_repository_id = project_repository_id),
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE SET NULL,
  FOREIGN KEY (active_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  
  INDEX idx_tasks_project_id (project_id),
  INDEX idx_tasks_list (list),
  INDEX idx_tasks_mode (mode),
  INDEX idx_tasks_ready (ready),
  INDEX idx_tasks_agent_session_status (agent_session_status),
  INDEX idx_tasks_priority_list_order (priority DESC, list, list_order),
  INDEX idx_tasks_created_at (created_at),
  INDEX idx_tasks_pr_number (github_pr_number),
  INDEX idx_tasks_pr_created (pr_created)
);
```

### Task Dependencies

Manages dependencies between tasks.

```sql
CREATE TABLE task_dependencies (
  id VARCHAR(26) PRIMARY KEY, -- ulid: taskdep_01H123...
  task_id VARCHAR(26) NOT NULL, -- the task that depends
  depends_on_task_id VARCHAR(26) NOT NULL, -- the task it depends on
  
  -- Dependency Type
  dependency_type ENUM('blocks', 'relates_to') DEFAULT 'blocks',
  
  -- Status
  status ENUM('active', 'resolved') DEFAULT 'active',
  resolved_at TIMESTAMP NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_task_dependency (task_id, depends_on_task_id),
  INDEX idx_task_deps_task_id (task_id),
  INDEX idx_task_deps_depends_on (depends_on_task_id),
  INDEX idx_task_deps_status (status)
);
```

### Task Agents

Direct many-to-many relationship between tasks and available agents for performance.
**Note**: This table provides direct task-agent assignment for performance, while maintaining the workstation hierarchy for management.

```sql
CREATE TABLE task_agents (
  id VARCHAR(26) PRIMARY KEY, -- ulid: taskagent_01H123...
  task_id VARCHAR(26) NOT NULL,
  agent_id VARCHAR(26) NOT NULL,
  
  -- Assignment Priority
  priority INTEGER DEFAULT 100, -- lower = higher priority
  
  -- Performance Denormalization (derived from workstation hierarchy)
  workstation_id VARCHAR(26) NOT NULL, -- denormalized for query performance
  project_workstation_id VARCHAR(26) NOT NULL, -- denormalized for validation
  
  -- Assignment Status
  assignment_status ENUM('available', 'preferred', 'blocked') DEFAULT 'available',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE CASCADE,
  FOREIGN KEY (project_workstation_id) REFERENCES project_workstations(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_task_agent (task_id, agent_id),
  INDEX idx_task_agents_task_id (task_id),
  INDEX idx_task_agents_agent_id (agent_id),
  INDEX idx_task_agents_workstation_id (workstation_id),
  INDEX idx_task_agents_assignment_status (assignment_status)
);
```

### Task Attachments

File attachments for tasks (wireframes, specs, etc.).

```sql
CREATE TABLE task_attachments (
  id VARCHAR(26) PRIMARY KEY, -- ulid: attach_01H123...
  task_id VARCHAR(26) NOT NULL,
  
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
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  
  INDEX idx_attachments_task_id (task_id),
  INDEX idx_attachments_type (attachment_type)
);
```

### Agent Sessions

Tracks individual agent execution sessions for tasks.

```sql
CREATE TABLE agent_sessions (
  id VARCHAR(26) PRIMARY KEY, -- ulid: session_01H123...
  task_id VARCHAR(26) NOT NULL,
  agent_id VARCHAR(26) NOT NULL,
  
  -- Session Details
  external_session_id VARCHAR(100), -- agent's internal session ID
  mode ENUM('clarify', 'plan', 'execute', 'review', 'iterate'),
  
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
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  FOREIGN KEY (worktree_id) REFERENCES git_worktrees(id) ON DELETE SET NULL,
  
  INDEX idx_sessions_task_id (task_id),
  INDEX idx_sessions_agent_id (agent_id),
  INDEX idx_sessions_status (status),
  INDEX idx_sessions_started_at (started_at)
);
```

### GitHub Pull Requests

Tracks GitHub PRs created by AI agents for tasks in PR mode.

```sql
CREATE TABLE github_pull_requests (
  id VARCHAR(26) PRIMARY KEY, -- ulid: ghpr_01H123...
  task_id VARCHAR(26) NOT NULL,
  project_repository_id VARCHAR(26) NOT NULL,
  
  -- GitHub PR Information
  github_pr_number INTEGER NOT NULL,
  github_pr_id BIGINT, -- GitHub PR ID (more stable)
  github_pr_url TEXT NOT NULL,
  
  -- Branch Information
  source_branch VARCHAR(255) NOT NULL, -- solo-unicorn/task-123-feature
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
  
  -- AI Agent Information
  created_by_agent_id VARCHAR(26), -- which agent created this PR
  last_updated_by_agent_id VARCHAR(26), -- which agent last updated this PR
  
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
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (project_repository_id) REFERENCES project_repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  FOREIGN KEY (last_updated_by_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  
  UNIQUE KEY unique_repo_pr_number (project_repository_id, github_pr_number),
  INDEX idx_github_prs_task_id (task_id),
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
  ai_response TEXT, -- AI agent's response to this comment
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
**Critical**: This table is required for the database locking mechanism used in task assignment.

```sql
CREATE TABLE helpers (
  id VARCHAR(26) PRIMARY KEY, -- ulid: helper_01H123...
  
  -- Helper Identity
  code VARCHAR(100) UNIQUE NOT NULL, -- unique identifier (e.g., 'TASK_PUSH_LOCK')
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
('helper_01TASK_PUSH_LOCK', 'TASK_PUSH_LOCK', 'Database lock for task assignment operations', 
 '{"locked": false, "timestamp": null, "expiresAt": null}');
```

## Indexes and Performance Optimization

### High-Frequency Query Optimization

**Critical Performance Note**: These indexes are optimized for queries that run every 10 seconds (monitoring) and complex task assignment queries with embedded subqueries.

```sql
-- ULTRA HIGH FREQUENCY: Monitoring queries (every 10 seconds)
-- Count active tasks: SELECT COUNT(*) FROM tasks WHERE agent_session_status IN ('PUSHING', 'ACTIVE')
CREATE INDEX idx_monitoring_active_tasks ON tasks (
  agent_session_status, 
  list
) WHERE agent_session_status IN ('PUSHING', 'ACTIVE') AND list != 'done';

-- Count ready tasks: SELECT COUNT(*) FROM tasks WHERE ready = true AND agent_session_status = 'INACTIVE'
CREATE INDEX idx_monitoring_ready_tasks ON tasks (
  ready,
  agent_session_status,
  list
) WHERE ready = true AND agent_session_status = 'INACTIVE' AND list != 'done';

-- COMPLEX QUERY: Task assignment with embedded subqueries (from task-finder.ts)
-- Primary task assignment query with all conditions
CREATE INDEX idx_task_assignment_complex ON tasks (
  ready,
  agent_session_status,
  list,
  priority DESC,
  list_order,
  created_at
) WHERE ready = true AND agent_session_status = 'INACTIVE' AND list NOT IN ('done', 'review');

-- Repository concurrency subquery: COUNT(*) FROM tasks WHERE main_repository_id = X AND agent_session_status IN ('PUSHING', 'ACTIVE')
CREATE INDEX idx_repo_active_tasks ON tasks (
  main_repository_id,
  agent_session_status,
  list
) WHERE agent_session_status IN ('PUSHING', 'ACTIVE') AND list != 'done';

-- Agent concurrency subquery: COUNT(*) FROM tasks WHERE active_agent_id = X AND agent_session_status IN ('PUSHING', 'ACTIVE')
CREATE INDEX idx_agent_active_tasks ON tasks (
  active_agent_id,
  agent_session_status,
  list
) WHERE agent_session_status IN ('PUSHING', 'ACTIVE') AND list != 'done';

-- Task dependency resolution (EXISTS subquery)
CREATE INDEX idx_task_dependencies_blocking ON task_dependencies (
  task_id,
  status,
  depends_on_task_id
) WHERE status = 'active';

-- Agent availability for task assignment
CREATE INDEX idx_agent_availability ON agents (
  workstation_id,
  status,
  rate_limit_reset_at,
  max_concurrency_limit
) WHERE status IN ('available', 'busy');

-- Task-agent relationship queries  
CREATE INDEX idx_task_agents_assignment ON task_agents (
  task_id,
  agent_id,
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

-- Project task overview (web UI)
CREATE INDEX idx_project_tasks_overview ON tasks (
  project_id,
  list,
  priority DESC,
  list_order,
  updated_at DESC
) WHERE list IN ('todo', 'doing', 'review');

-- Agent session tracking
CREATE INDEX idx_agent_sessions_active ON agent_sessions (
  agent_id,
  status,
  started_at DESC
) WHERE status IN ('starting', 'active');

-- Git worktree management
CREATE INDEX idx_worktrees_usage ON git_worktrees (
  workstation_repository_id,
  status,
  active_task_count,
  last_used_at DESC
);
```

### Materialized Views for Ultra-High Frequency Queries

**Performance Critical**: These views cache expensive aggregations for monitoring queries that run every 10 seconds.

```sql
-- Active tasks count (refreshed via trigger)
CREATE MATERIALIZED VIEW mv_active_task_counts AS
SELECT 
  COUNT(*) FILTER (WHERE agent_session_status = 'PUSHING') as pushing_count,
  COUNT(*) FILTER (WHERE agent_session_status = 'ACTIVE') as active_count,
  COUNT(*) FILTER (WHERE agent_session_status IN ('PUSHING', 'ACTIVE')) as total_active,
  COUNT(*) FILTER (WHERE ready = true AND agent_session_status = 'INACTIVE' AND list != 'done') as ready_count,
  NOW() as last_updated
FROM tasks 
WHERE list != 'done';

CREATE UNIQUE INDEX idx_mv_active_task_counts ON mv_active_task_counts (last_updated);

-- Agent capacity utilization (refreshed via trigger)
CREATE MATERIALIZED VIEW mv_agent_capacity AS
SELECT 
  a.id as agent_id,
  a.workstation_id,
  a.max_concurrency_limit,
  COALESCE(t.active_count, 0) as current_active_tasks,
  CASE 
    WHEN a.max_concurrency_limit = 0 THEN 999999 -- unlimited
    ELSE a.max_concurrency_limit - COALESCE(t.active_count, 0)
  END as available_capacity,
  a.rate_limit_reset_at,
  NOW() as last_updated
FROM agents a
LEFT JOIN (
  SELECT 
    active_agent_id,
    COUNT(*) as active_count
  FROM tasks 
  WHERE agent_session_status IN ('PUSHING', 'ACTIVE') AND list != 'done'
  GROUP BY active_agent_id
) t ON t.active_agent_id = a.id
WHERE a.status IN ('available', 'busy');

CREATE UNIQUE INDEX idx_mv_agent_capacity_agent ON mv_agent_capacity (agent_id);
CREATE INDEX idx_mv_agent_capacity_workstation ON mv_agent_capacity (workstation_id, available_capacity DESC);
```

### Performance Optimization Functions

```sql
-- Fast task count function using materialized view
CREATE FUNCTION get_active_task_counts()
RETURNS TABLE(
  pushing_count BIGINT,
  active_count BIGINT, 
  total_active BIGINT,
  ready_count BIGINT
)
LANGUAGE SQL
READS SQL DATA
AS $$
  SELECT pushing_count, active_count, total_active, ready_count
  FROM mv_active_task_counts
  LIMIT 1;
$$;

-- Fast agent availability check
CREATE FUNCTION is_agent_available(
  p_agent_id VARCHAR(26)
)
RETURNS BOOLEAN
LANGUAGE SQL
READS SQL DATA
AS $$
  SELECT 
    available_capacity > 0 
    AND (rate_limit_reset_at IS NULL OR rate_limit_reset_at <= NOW())
  FROM mv_agent_capacity
  WHERE agent_id = p_agent_id;
$$;
```

### Database Triggers

**Performance Critical**: These triggers maintain cached counts and refresh materialized views for ultra-high frequency queries.

```sql
-- Refresh materialized views when tasks change (CRITICAL for monitoring performance)
DELIMITER //
CREATE TRIGGER refresh_task_counts_on_insert
AFTER INSERT ON tasks
FOR EACH ROW
BEGIN
  REFRESH MATERIALIZED VIEW mv_active_task_counts;
  REFRESH MATERIALIZED VIEW mv_agent_capacity;
END//

CREATE TRIGGER refresh_task_counts_on_update
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
  -- Only refresh if status or assignment changed
  IF OLD.agent_session_status != NEW.agent_session_status 
     OR OLD.active_agent_id != NEW.active_agent_id
     OR OLD.ready != NEW.ready
     OR OLD.list != NEW.list THEN
    REFRESH MATERIALIZED VIEW mv_active_task_counts;
    REFRESH MATERIALIZED VIEW mv_agent_capacity;
  END IF;
END//

CREATE TRIGGER refresh_task_counts_on_delete
AFTER DELETE ON tasks
FOR EACH ROW
BEGIN
  REFRESH MATERIALIZED VIEW mv_active_task_counts;
  REFRESH MATERIALIZED VIEW mv_agent_capacity;
END//
DELIMITER ;

-- Update agent active task count when tasks assigned/completed
DELIMITER //
CREATE TRIGGER update_agent_active_count
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
  -- Update old agent count
  IF OLD.active_agent_id IS NOT NULL THEN
    UPDATE agents
    SET active_task_count = (
      SELECT COUNT(*) FROM tasks 
      WHERE active_agent_id = OLD.active_agent_id 
        AND agent_session_status IN ('PUSHING', 'ACTIVE')
        AND list != 'done'
    )
    WHERE id = OLD.active_agent_id;
  END IF;
  
  -- Update new agent count
  IF NEW.active_agent_id IS NOT NULL THEN
    UPDATE agents
    SET active_task_count = (
      SELECT COUNT(*) FROM tasks 
      WHERE active_agent_id = NEW.active_agent_id 
        AND agent_session_status IN ('PUSHING', 'ACTIVE')
        AND list != 'done'
    )
    WHERE id = NEW.active_agent_id;
  END IF;
END//
DELIMITER ;

-- Update dependency count when dependencies change
DELIMITER //
CREATE TRIGGER update_task_dependency_count 
AFTER INSERT ON task_dependencies
FOR EACH ROW
BEGIN
  UPDATE tasks 
  SET dependency_count = (
    SELECT COUNT(*) FROM task_dependencies 
    WHERE task_id = NEW.task_id AND status = 'active'
  )
  WHERE id = NEW.task_id;
END//

CREATE TRIGGER update_task_dependency_count_delete
AFTER DELETE ON task_dependencies
FOR EACH ROW
BEGIN
  UPDATE tasks 
  SET dependency_count = (
    SELECT COUNT(*) FROM task_dependencies 
    WHERE task_id = OLD.task_id AND status = 'active'
  )
  WHERE id = OLD.task_id;
END//
DELIMITER ;

-- Update workflow template usage count
DELIMITER //
CREATE TRIGGER update_workflow_template_usage
AFTER INSERT ON tasks
FOR EACH ROW
BEGIN
  IF NEW.workflow_template_id IS NOT NULL THEN
    UPDATE workflow_templates 
    SET tasks_using_count = tasks_using_count + 1
    WHERE id = NEW.workflow_template_id;
  END IF;
END//

-- Maintain main_repository_id compatibility field
CREATE TRIGGER maintain_main_repository_id
BEFORE INSERT ON tasks
FOR EACH ROW
BEGIN
  SET NEW.main_repository_id = NEW.project_repository_id;
END//

CREATE TRIGGER maintain_main_repository_id_update
BEFORE UPDATE ON tasks
FOR EACH ROW
BEGIN
  SET NEW.main_repository_id = NEW.project_repository_id;
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
  
  // Task-specific coordination
  task: `task:${task.id}`;
}

// Presence metadata stored in workstations.realtime_presence_meta
interface WorkstationPresenceMeta {
  status: 'online' | 'busy' | 'offline';
  availableAgents: string[];
  activeProjects: string[];
  devServerPort?: number;
  currentTaskCount: number;
}
```

## Migration Strategy

### Phase 1: Core Entities
1. Organizations, Users, Memberships
2. Workstations, Agents
3. Projects, Repositories

### Phase 2: Task Management
1. Workflow Templates, Actors
2. Tasks, Dependencies
3. Task Agents, Attachments

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

-- Phase 2: Migrate tasks with compatibility fields
INSERT INTO tasks (
  id, project_id, title, description, priority,
  list, mode, workflow_template_id,
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
  COALESCE(t.mode, 'execute') as mode,
  NULL as workflow_template_id,
  r.id as project_repository_id,
  r.id as main_repository_id, -- compatibility
  t.agent_session_status,
  t.ready,
  t.created_at
FROM v2_tasks t
JOIN v2_repositories r ON r.id = t.main_repository_id;

-- Phase 3: Initialize materialized views after migration
REFRESH MATERIALIZED VIEW mv_active_task_counts;
REFRESH MATERIALIZED VIEW mv_agent_capacity;

-- Phase 4: Validate data integrity
SELECT 
  'tasks' as table_name,
  COUNT(*) as v2_count,
  (SELECT COUNT(*) FROM tasks) as v3_count,
  CASE WHEN COUNT(*) = (SELECT COUNT(*) FROM tasks) THEN '✓ MATCH' ELSE '✗ MISMATCH' END as status
FROM v2_tasks;
```

## V3 Architecture Adaptations & Performance Optimizations

### Critical Issues Resolved

This v3 schema design addresses **critical performance and compatibility issues** identified from analyzing existing query patterns in the v2 codebase:

#### 1. **Workstation-Agent Architecture Alignment**
- **Problem**: V3 introduces workstation hierarchy (Organizations → Workstations → Agents) but existing task assignment expects direct task-agent relationships
- **Solution**: Hybrid approach with denormalized fields in `task_agents` table:
  - Maintains workstation hierarchy for management
  - Provides direct task-agent relationships for performance
  - Adds `workstation_id` and `project_workstation_id` for validation

#### 2. **Ultra-High Frequency Query Optimization**
- **Problem**: Monitoring queries run every 10 seconds and must be lightning fast
- **Solution**: Materialized views + specialized indexes:
  - `mv_active_task_counts` - cached aggregations for monitoring
  - `mv_agent_capacity` - precomputed agent availability 
  - Triggered refresh on task status changes
  - Dedicated functions: `get_active_task_counts()`, `is_agent_available()`

#### 3. **Complex Task Assignment Query Performance**
- **Problem**: Task finder uses embedded subqueries checking repository/agent concurrency
- **Solution**: Purpose-built composite indexes:
  - `idx_repo_active_tasks` - repository concurrency subquery
  - `idx_agent_active_tasks` - agent concurrency subquery
  - `idx_task_assignment_complex` - primary task selection
  - `idx_task_dependencies_blocking` - dependency resolution

#### 4. **Missing Critical Infrastructure**
- **Added `helpers` table** - database locking mechanism for atomic task assignment
- **Added `agent_settings`** - compatibility with existing agent configuration
- **Added `last_task_pushed_at`** - required for task distribution logic
- **Added `main_repository_id`** - compatibility field with triggers

### Query Pattern Adaptations

#### Current V2 Pattern → V3 Optimization
```sql
-- V2: Direct task-agent query (fast)
SELECT * FROM task_agents ta 
JOIN agents a ON a.id = ta.agent_id
WHERE ta.task_id = ?

-- V3: Same performance with denormalized fields
SELECT ta.*, a.*, w.status as workstation_status
FROM task_agents ta
JOIN agents a ON a.id = ta.agent_id
JOIN workstations w ON w.id = ta.workstation_id  -- denormalized for speed
WHERE ta.task_id = ?
```

#### Monitoring Queries (Every 10 Seconds)
```sql
-- V2: Count queries on main table (slower with scale)
SELECT COUNT(*) FROM tasks WHERE agent_session_status IN ('PUSHING', 'ACTIVE');

-- V3: Materialized view query (ultra-fast)
SELECT total_active FROM mv_active_task_counts;
```

#### Agent Availability Check
```sql
-- V2: Complex calculation on each check
SELECT a.*, COUNT(t.id) as active_count
FROM agents a
LEFT JOIN tasks t ON t.active_agent_id = a.id AND t.agent_session_status IN ('PUSHING', 'ACTIVE')
WHERE a.id = ? AND (a.rate_limit_reset_at IS NULL OR a.rate_limit_reset_at <= NOW())
GROUP BY a.id;

-- V3: Pre-computed with function call
SELECT is_agent_available(?) as available;
```

### Performance Benchmarks Expected

| Query Type | V2 Performance | V3 Performance | Improvement |
|------------|----------------|----------------|-------------|
| Monitoring (10s) | ~50-100ms | ~1-5ms | 10-20x faster |
| Task Assignment | ~200-500ms | ~50-100ms | 4-5x faster |
| Agent Availability | ~10-50ms | ~1-2ms | 10-25x faster |
| Task Count | ~20-100ms | ~1ms | 20-100x faster |

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

This comprehensive schema supports all the features outlined in the UI/UX and CLI design documents while providing **dramatic performance improvements** for the most critical query patterns. The design is optimized for the workstation-centric architecture and flexible workflow system that defines Solo Unicorn v3, with **special attention to ultra-high frequency monitoring queries** that are essential for real-time task orchestration.