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

## Entity Relationship Overview

```
Organizations 1---* Workstations 1---* Agents
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
     |
     1
     |
     *
WorkflowTemplates
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

Users belong to organizations through memberships and can access projects.

```sql
CREATE TABLE users (
  id VARCHAR(26) PRIMARY KEY, -- ulid: user_01H123...
  
  -- Identity (from Monster Auth)
  monster_auth_user_id VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  
  -- Profile
  display_name VARCHAR(255),
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  INDEX idx_users_monster_auth_user_id (monster_auth_user_id),
  INDEX idx_users_email (email),
  INDEX idx_users_last_active_at (last_active_at)
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

Agents are AI coding tools available on workstations (Claude Code, Cursor, etc.).

```sql
CREATE TABLE agents (
  id VARCHAR(26) PRIMARY KEY, -- ulid: agent_01H123...
  workstation_id VARCHAR(26) NOT NULL,
  
  -- Agent Identity
  type ENUM('claude-code', 'cursor', 'opencode', 'custom') NOT NULL,
  name VARCHAR(255) NOT NULL, -- display name
  version VARCHAR(50), -- agent version
  
  -- Configuration
  config_path TEXT, -- path to config directory/file
  executable_path TEXT, -- path to agent executable
  environment_vars JSON, -- additional environment variables
  
  -- Capabilities
  max_concurrency_limit INTEGER DEFAULT 1, -- 0 = unlimited
  supported_languages JSON, -- ["javascript", "python", "rust"]
  
  -- Status & Rate Limiting
  status ENUM('available', 'busy', 'rate_limited', 'error', 'disabled') DEFAULT 'available',
  rate_limit_reset_at TIMESTAMP NULL,
  rate_limit_reason TEXT,
  
  -- Usage Statistics
  tasks_completed INTEGER DEFAULT 0,
  total_execution_time INTEGER DEFAULT 0, -- seconds
  last_task_pushed_at TIMESTAMP,
  
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

Links GitHub repositories to projects with worktree support.

```sql
CREATE TABLE project_repositories (
  id VARCHAR(26) PRIMARY KEY, -- ulid: repo_01H123...
  project_id VARCHAR(26) NOT NULL,
  
  -- Repository Identity
  name VARCHAR(255) NOT NULL, -- display name
  github_url TEXT NOT NULL, -- https://github.com/user/repo
  github_owner VARCHAR(100), -- extracted from URL
  github_repo VARCHAR(100), -- extracted from URL
  
  -- Git Configuration
  default_branch VARCHAR(100) DEFAULT 'main',
  
  -- Concurrency Control
  max_concurrent_tasks INTEGER DEFAULT 1, -- 0 = unlimited
  
  -- Status
  status ENUM('active', 'inactive', 'error') DEFAULT 'active',
  last_accessed_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_project_github_url (project_id, github_url),
  INDEX idx_repositories_project_id (project_id),
  INDEX idx_repositories_github_url (github_url)
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
  
  -- Assignment
  project_repository_id VARCHAR(26), -- target repository
  target_branch VARCHAR(100), -- target git branch
  actor_id VARCHAR(26), -- assigned AI persona
  
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
  FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE SET NULL,
  FOREIGN KEY (active_agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  
  INDEX idx_tasks_project_id (project_id),
  INDEX idx_tasks_list (list),
  INDEX idx_tasks_mode (mode),
  INDEX idx_tasks_ready (ready),
  INDEX idx_tasks_agent_session_status (agent_session_status),
  INDEX idx_tasks_priority_list_order (priority DESC, list, list_order),
  INDEX idx_tasks_created_at (created_at)
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

Many-to-many relationship between tasks and available agents.

```sql
CREATE TABLE task_agents (
  id VARCHAR(26) PRIMARY KEY, -- ulid: taskagent_01H123...
  task_id VARCHAR(26) NOT NULL,
  agent_id VARCHAR(26) NOT NULL,
  
  -- Assignment Priority
  priority INTEGER DEFAULT 100, -- lower = higher priority
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  
  UNIQUE KEY unique_task_agent (task_id, agent_id),
  INDEX idx_task_agents_task_id (task_id),
  INDEX idx_task_agents_agent_id (agent_id)
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

## Indexes and Performance Optimization

### Primary Query Patterns

```sql
-- Task assignment queries (high frequency)
CREATE INDEX idx_task_assignment ON tasks (
  ready, 
  agent_session_status, 
  list, 
  priority DESC, 
  list_order, 
  created_at
) WHERE list != 'done';

-- Project task overview (frequent)
CREATE INDEX idx_project_tasks_active ON tasks (
  project_id, 
  list, 
  priority DESC, 
  list_order
) WHERE list IN ('todo', 'doing', 'review');

-- Agent availability queries (high frequency)
CREATE INDEX idx_agent_availability ON agents (
  workstation_id, 
  status, 
  max_concurrency_limit
) WHERE status IN ('available', 'busy');

-- Workstation monitoring (frequent)
CREATE INDEX idx_workstation_monitoring ON workstations (
  organization_id, 
  status, 
  last_seen_at DESC
);

-- Dependency resolution (frequent)
CREATE INDEX idx_dependency_resolution ON task_dependencies (
  depends_on_task_id, 
  status
) WHERE status = 'active';
```

### Database Triggers

```sql
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
```sql
-- Example migration patterns
INSERT INTO organizations (id, name, slug, created_at)
SELECT 
  CONCAT('org_', SUBSTRING(MD5(RAND()) FROM 1 FOR 22)) as id,
  name,
  LOWER(REPLACE(name, ' ', '-')) as slug,
  created_at
FROM v2_organizations;

-- Migrate existing tasks with default workflow
INSERT INTO tasks (
  id, project_id, title, description, priority, 
  list, mode, workflow_template_id, created_at
)
SELECT 
  CONCAT('task_', SUBSTRING(MD5(RAND()) FROM 1 FOR 22)) as id,
  project_id, title, description, priority,
  CASE 
    WHEN status = 'todo' THEN 'todo'
    WHEN status = 'in_progress' THEN 'doing'
    WHEN status = 'done' THEN 'done'
  END as list,
  'execute' as mode, -- default mode for migrated tasks
  NULL as workflow_template_id, -- will use project default
  created_at
FROM v2_tasks;
```

This comprehensive schema supports all the features outlined in the UI/UX and CLI design documents while providing scalability, performance, and integration with Monster services. The design is optimized for the workstation-centric architecture and flexible workflow system that defines Solo Unicorn v3.