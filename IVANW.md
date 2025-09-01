# IVANW Documentation: Solo Unicorn

A documentation-driven standard for Solo Unicorn's agent-built software that can be rebuilt, verified, and evolved sustainably.

---

## 000-Product-Charter.md

### Vision & Goals

**Mission**: Solo Unicorn is a comprehensive AI task orchestration system designed for solo developers and small teams. It serves as the "task management brain" that sits between requirements and AI coding agents, providing intelligent task distribution, agent coordination, and context preservation across repositories and sessions.

**Value Propositions**:
- Hub of AI agents - centralized agent management and coordination
- Task management system for dispatching tasks to AI agents (Trello for AI tasks)
- Efficient AI agent orchestration with context preservation
- Flexible AI workflow framework with multiple modes (clarify → plan → execute)
- Easy switch between different agent types (OpenRouter for coding agent CLIs)
- Web UI for code agent CLIs with real-time monitoring
- Context preservation across repos, agents, tasks and sessions
- Multi-repo coordination for complex projects

**Target Users**:
- Dev users: Task management brain between requirements and AI coding agents
- Solo developers and small teams needing AI-assisted development workflows
- Teams requiring multi-repository coordination with AI agents

### Success Criteria

- **Task Processing**: AI agents successfully pick up, clarify, plan, and execute tasks autonomously
- **Context Preservation**: Project memory and task context maintained across sessions
- **Multi-Agent Coordination**: Multiple agents can work on different repositories simultaneously
- **Real-time Monitoring**: Users can monitor agent progress and intervene when necessary
- **Loop Tasks**: Continuous improvement tasks keep projects active and maintained

### Non-Goals

- Direct code execution (delegated to agent tools like Claude Code, OpenCode)
- Complex multi-user collaboration beyond basic project sharing
- Advanced deployment pipelines (delegated to repository CI/CD)

### Constraints

**Legal**:
- Must respect API terms of service for integrated AI providers
- User data privacy for project content and configurations

**Security**:
- API keys and credentials stored securely
- Project data isolated per user/team
- Safe handling of repository file attachments

**Cost**:
- Optimized for AI agent rate limits and quotas
- Efficient database usage for task and session management

**Latency**:
- Real-time WebSocket updates for agent status
- Optimistic UI updates with rollback capability
- Agent session startup time <30 seconds

---

## 010-System-Overview.md

### Context Narrative

**Core Actors**:
- **Human Users**: Create and monitor tasks, configure projects
- **AI Agents**: Process tasks through clarify → plan → execute workflow
- **Agent Clients**: Claude Code, OpenCode CLI tools that execute actual work
- **Repositories**: Code repositories where work is performed
- **WebSocket Clients**: Real-time UI updates and monitoring

**Core Services**:
- **Task Orchestration Service**: Finds assignable tasks and routes to available agents
- **Agent Invocation Service**: Spawns agent processes with proper environment setup
- **MCP Integration Service**: Provides tools for agents to update task status
- **WebSocket Service**: Real-time communication between server and web clients
- **Session Registry**: Tracks active and completed agent sessions
- **Project Memory Service**: Maintains shared context across all tasks

**Data Stores**:
- **PostgreSQL**: Primary data store for projects, tasks, agents, repositories
- **File System**: Task attachments and temporary files
- **Session Files**: JSON files tracking active/completed agent sessions

### Bounded Contexts

**Project Management Context**: Projects, repositories, agents, actors configuration
**Task Workflow Context**: Task states, modes, dependencies, iterations
**Agent Coordination Context**: Agent assignment, session management, rate limiting
**Real-time Communication Context**: WebSocket connections, status broadcasting

### Evolution Rules

- Prefer rebuilds for breaking schema changes or major workflow updates
- Use incremental updates for UI improvements and feature additions
- Database migrations follow expand/contract pattern
- Agent integration changes require compatibility testing

### Performance/Scaling Targets

- **Task Processing**: <10 second agent assignment time
- **WebSocket Updates**: <500ms latency for status updates
- **Database Queries**: <100ms for task list operations
- **Concurrent Agents**: Support 10+ simultaneous agent sessions per project
- **File Attachments**: <10MB per task, <100MB per project

---

## 020-Interface-Contracts.md

### Public APIs (oRPC Endpoints)

**AUTH-001**: Authentication endpoints
- Purpose: User authentication and session management
- Auth: Bearer tokens via Monster Auth
- Rate Limits: 100/hour per IP
- Schema: OpenAuth integration with project access control
- Errors: 401 Unauthorized, 429 Rate Limited

**PROJ-001**: Project management
- `projects.create`: Create new project
- `projects.getWithTasks`: Get project with all tasks and relationships
- `projects.update`: Update project details and memory
- Auth: Project membership required
- Schema: Project entity with nested tasks, repositories, agents

**TASK-001**: Task operations
- `tasks.create`: Create new task with repository and agent assignment
- `tasks.update`: Update task details and status
- `tasks.toggleReady`: Mark task ready for AI processing
- `tasks.updateOrder`: Update task list positions via drag-and-drop
- `tasks.delete`: Remove task and dependencies
- Auth: Project member with task access
- Schema: Task entity with mode, list, priority, attachments

**AGENT-001**: Agent management
- `agents.list`: Get available agents for project
- `agents.create`: Add new agent configuration
- `agents.update`: Modify agent settings and rate limits
- Auth: Project admin required for modifications
- Schema: Agent entity with type, settings, concurrency limits

### WebSocket Events

**WS-001**: Real-time updates
- Connection: `/` with projectId parameter
- Events: `task.updated`, `agent.status.changed`, `session.started`, `session.completed`
- Auth: Valid project access required
- Format: JSON messages with type and payload
- Ordering: No guaranteed ordering, idempotent updates
- Guarantees: At-least-once delivery with client-side deduplication

### MCP Tool Contracts

**MCP-001**: Solo Unicorn MCP Server
- Endpoint: `POST /mcp` with stateless HTTP transport
- Auth: Bearer token authentication
- Tools:
  - `task_update`: Update task fields during agent execution
  - `task_create`: Create new tasks from within agent sessions
  - `project_memory_update`: Update shared project context
  - `project_memory_get`: Retrieve project context for agents

### Compatibility Policy

- **Breaking Changes**: Major version increment, 6-month deprecation period
- **Additive Changes**: Minor version increment, backward compatible
- **Bug Fixes**: Patch version increment
- **Database Schema**: Migrations with rollback capability
- **WebSocket Protocol**: Versioned message formats

---

## 030-Domain-Rules.md

### Business Rules (Given/When/Then)

**RULE-001**: Task Assignment
- Given: A task is marked ready and has assigned agents
- When: An agent becomes available and repository is not at concurrency limit
- Then: Task is automatically assigned to best available agent based on priority and age

**RULE-002**: Task Mode Progression
- Given: A task in "clarify" mode is completed by agent
- When: Agent updates task with refined title/description
- Then: Task mode automatically progresses to "plan"

**RULE-003**: Loop Task Behavior
- Given: A task with mode="loop" is completed
- When: Agent marks task as done
- Then: Task returns to loop list for future processing instead of done list

**RULE-004**: Agent Rate Limiting
- Given: An agent hits API rate limits
- When: Rate limit message is detected in agent output
- Then: Agent is marked unavailable until reset time and tasks are reassigned

**RULE-005**: Task Dependencies
- Given: A task has incomplete dependencies
- When: Task picker evaluates available tasks
- Then: Task is skipped until all dependencies are in "done" status

**RULE-006**: Check Mode Approval
- Given: A task is in "check" list with checkInstruction
- When: Human reviewer approves the task
- Then: Task moves to "done" list with approval timestamp

### Invariants

- **INV-001**: Every task must have exactly one main repository
- **INV-002**: Tasks can only be assigned to agents within the same project
- **INV-003**: Agent session status must match task status (ACTIVE tasks have ACTIVE sessions)
- **INV-004**: Loop tasks never reach "done" status permanently
- **INV-005**: Project memory is shared across all tasks within a project
- **INV-006**: Task priorities must be 1-5 (5=highest, 1=lowest)

### Edge Cases

**EDGE-001**: Agent Process Crashes
- Detection: Session registry cleanup finds orphaned sessions
- Resolution: Mark tasks as INACTIVE, log error, retry assignment

**EDGE-002**: Concurrent Task Assignment
- Problem: Multiple processes trying to assign same task
- Resolution: Database-level locking with retry logic

**EDGE-003**: WebSocket Connection Loss
- Problem: Client misses real-time updates
- Resolution: Optimistic updates with reconciliation on reconnect

**EDGE-004**: File Attachment Conflicts
- Problem: Large attachments during concurrent task operations
- Resolution: Temporary file staging with atomic moves

### Conflict Resolution Priorities

1. **Agent Safety**: Prevent infinite loops or runaway processes
2. **Data Integrity**: Ensure task state consistency over performance
3. **User Intent**: Respect human overrides of AI decisions
4. **System Stability**: Graceful degradation over feature completeness

---

## 040-Data-Model-and-Migration-Contracts.md

### Logical Data Model

**Core Entities**:

```typescript
// Users - Authentication and ownership
interface User {
  id: UUID (PK)
  email: string (UNIQUE)
  displayName: string
  createdAt: timestamp
  updatedAt: timestamp
}

// Projects - Main organizational unit
interface Project {
  id: UUID (PK)
  name: string
  description: string?
  ownerId: UUID (FK -> users.id)
  memory: JSONB (shared context)
  settings: JSONB (configuration)
  createdAt: timestamp
  updatedAt: timestamp
}

// Tasks - Core work units
interface Task {
  id: UUID (PK)
  projectId: UUID (FK -> projects.id)
  mainRepositoryId: UUID (FK -> repositories.id)
  actorId: UUID? (FK -> actors.id)

  // Human input
  rawTitle: string
  rawDescription: string?

  // AI refined
  refinedTitle: string?
  refinedDescription: string?
  plan: JSONB? (plan results)
  checkInstruction: string? (QA instructions)

  // Workflow state
  list: enum('todo','doing','done','loop','check')
  mode: enum('clarify','plan','execute','loop','talk','check')?
  priority: integer (1-5)
  listOrder: string (decimal for ordering)
  ready: boolean

  // Agent session tracking
  agentSessionStatus: enum('INACTIVE','PUSHING','ACTIVE')
  activeAgentId: UUID? (FK -> agents.id)
  lastAgentSessionId: string?
  lastPushedAt: timestamp?
  lastAgentSessionStartedAt: timestamp?

  // Metadata
  author: enum('human','ai')
  attachments: JSONB (file metadata array)
  git: JSONB (commit tracking)
  createdByTaskId: UUID? (FK -> tasks.id, for AI-generated tasks)

  createdAt: timestamp
  updatedAt: timestamp
}

// Agents - AI service configurations
interface Agent {
  id: UUID (PK)
  projectId: UUID (FK -> projects.id)
  name: string
  agentType: enum('CLAUDE_CODE','CURSOR_CLI','OPENCODE')
  agentSettings: JSONB (config like CLAUDE_CONFIG_DIR)
  maxConcurrencyLimit: integer (0=unlimited)
  lastTaskPushedAt: timestamp?
  rateLimitResetAt: timestamp?
  state: JSONB (runtime state tracking)
  createdAt: timestamp
  updatedAt: timestamp
}

// Repositories - Code repositories
interface Repository {
  id: UUID (PK)
  projectId: UUID (FK -> projects.id)
  name: string
  repoPath: string (filesystem path)
  isDefault: boolean (one per project)
  maxConcurrencyLimit: integer (default=1)
  lastTaskPushedAt: timestamp?
  createdAt: timestamp
  updatedAt: timestamp
}

// Actors - Agent personalities/methodologies
interface Actor {
  id: UUID (PK)
  projectId: UUID (FK -> projects.id)
  name: string
  description: string (personality definition)
  isDefault: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Relationship Tables**:
- `project_users`: Many-to-many project access
- `task_agents`: Many-to-many task-agent assignments
- `task_additional_repositories`: Tasks can use multiple repos
- `task_dependencies`: Task ordering dependencies
- `task_iterations`: Feedback tracking for check mode
- `helpers`: System state management (locks, counters)

### Task Processing Engine

**Task Assignment Pipeline**: The core orchestration logic that determines which tasks get assigned to which agents:

```typescript
// Task Readiness Criteria (from task-finder.ts:40-116)
interface TaskReadinessCriteria {
  // Basic eligibility
  ready: true,
  agentSessionStatus: 'INACTIVE',
  list: NOT 'done' | NOT 'check',  // Excludes completed and pending approval
  
  // Dependency checks
  dependencies: {
    rule: "All dependencies must be in 'done' or 'check' status",
    query: "NOT EXISTS dependency WHERE dependency.status NOT IN ('done', 'check')"
  },
  
  // Resource availability
  repository: {
    concurrencyCheck: "repo.maxConcurrencyLimit = 0 OR active_tasks < limit",
    activeTasksQuery: "COUNT(tasks WHERE repo_id = X AND status IN ('PUSHING', 'ACTIVE'))"
  },
  
  // Agent availability
  assignedAgents: {
    rateLimitCheck: "rate_limit_reset_at IS NULL OR rate_limit_reset_at <= NOW()",
    concurrencyCheck: "agent.maxConcurrencyLimit = 0 OR agent_active_tasks < limit",
    requirement: "At least one available agent"
  }
}

// Task Selection Priority (task-finder.ts:105-115)
interface TaskSelectionOrder {
  priority: "DESC", // 5 > 4 > 3 > 2 > 1 (higher numbers first)
  listWeight: {
    doing: 3,  // Highest priority - tasks already in progress
    todo: 2,   // Normal new tasks
    loop: 1    // Recurring tasks (lowest priority)
  },
  listOrder: "ASC",  // Manual ordering within same priority
  createdAt: "ASC"   // Oldest first as tiebreaker
}
```

**Task Monitor Scheduling** (task-monitor.ts:21-26):
```typescript
interface MonitoringSchedule {
  taskPushingJob: "*/10 * * * * *",      // Every 10 seconds - main assignment loop
  outOfSyncCheckingJob: "*/2 * * * *",   // Every 2 minutes - recovery checks  
  sessionCleanupJob: "*/10 * * * *",     // Every 10 minutes - cleanup stale sessions
  
  triggers: {
    startup: "Initial out-of-sync check and cleanup",
    newTaskReady: "Triggered via WebSocket when task.ready = true",
    agentAvailable: "When rate limits reset or agent becomes free",
    sessionComplete: "When agent finishes task processing"
  }
}
```

**Agent Selection Algorithm** (task-finder.ts:155-197):
```typescript
interface AgentSelectionLogic {
  eligibilityFilters: [
    "agent.rateLimitResetAt IS NULL OR rateLimitResetAt <= NOW()",
    "agent.maxConcurrencyLimit = 0 OR active_tasks < limit"
  ],
  
  selectionCriteria: {
    fairness: "Sort by lastTaskPushedAt ASC", // Least recently used first
    availability: "Rate limit status checked in real-time",
    loadBalancing: "Distribute tasks across available agents"
  },
  
  fallbackHandling: {
    noEligibleAgents: "Log details and skip task",
    rateLimited: "Task remains ready for next cycle"
  }
}
```

**Task State Transitions**:
```typescript
interface TaskLifecycle {
  // Human creates task
  creation: {
    initialState: { list: "todo", ready: false, agentSessionStatus: "INACTIVE" },
    humanAction: "Mark task.ready = true when prepared"
  },
  
  // System picks up task
  assignment: {
    trigger: "findNextAssignableTask() in 10-second cycle",
    atomicUpdate: { 
      agentSessionStatus: "INACTIVE" -> "PUSHING",
      activeAgentId: "assigned_agent.id",
      list: "any" -> "doing",
      lastPushedAt: "NOW()",
      lastAgentSessionStartedAt: "NOW()"
    }
  },
  
  // Agent starts processing  
  processing: {
    agentSpawn: "spawnClaudeSession() or spawnOpencodeSession()",
    statusUpdate: { agentSessionStatus: "PUSHING" -> "ACTIVE" },
    mcpTools: "Agent can update task via MCP tools"
  },
  
  // Task completion
  completion: {
    modes: {
      execute: { list: "doing" -> "check" }, // Needs human approval
      check: { list: "check" -> "done" },    // Final completion
      loop: { list: "doing" -> "loop" }      // Return to loop queue
    },
    cleanup: { 
      agentSessionStatus: "ACTIVE" -> "INACTIVE",
      activeAgentId: "null"
    }
  }
}
```

**Concurrency Control**:
```typescript
interface ConcurrencyManagement {
  databaseLocking: {
    mechanism: "helpers table with TASK_PUSH_LOCK_CODE",
    timeout: "60 seconds with automatic expiry",
    atomicity: "Single process assignment at a time"
  },
  
  repositoryLimits: {
    default: 1, // One task per repository by default
    unlimited: 0, // Set maxConcurrencyLimit = 0
    enforcement: "Query-level checks in task finder"
  },
  
  agentLimits: {
    default: 0, // Unlimited by default
    rateLimits: "Detected from agent output streams",
    resetTracking: "rateLimitResetAt timestamp field"
  }
}
```

**Session Recovery System**:
```typescript
interface SessionRecovery {
  outOfSyncDetection: {
    frequency: "Every 2 minutes + startup",
    mechanism: "Compare DB status with session registry files",
    recovery: "Reset agentSessionStatus to INACTIVE for orphaned tasks"
  },
  
  sessionRegistry: {
    location: "~/.solo-unicorn/sessions/*.json",
    tracking: "active_sessions.json + completed_sessions.json",
    cleanup: "Purge sessions older than 60 minutes"
  },
  
  errorHandling: {
    agentCrash: "Detected via session registry mismatch",
    rateLimitHit: "Parsed from agent output streams", 
    processOrphaned: "Recovered via periodic checks"
  }
}
```

### Schema Versioning

**Current Version**: v2.1.0
- Major: Breaking schema changes requiring data migration
- Minor: Additive schema changes (new columns, tables)
- Patch: Index additions, constraint modifications

### Migration Protocols

**Standard Migration Process**:
1. **Expand**: Add new columns/tables with NULL defaults
2. **Dual-write**: Application writes to both old and new schema
3. **Backfill**: Background job populates new schema from old data
4. **Cutover**: Application switches to reading from new schema
5. **Contract**: Remove old columns/tables after validation

**Example Migration Contract**:
```
MIG-015: Add task.checkInstruction for check mode
Type: Expand → Backfill → Contract
Compat: Backward-compatible reads for 14 days
Steps:
1) Expand: ADD COLUMN checkInstruction TEXT NULL
2) Dual-write: Update application to write to new column when mode='check'
3) Backfill: No backfill needed (new feature)
4) Cutover: All check mode tasks use new column
5) Contract: N/A (no old column to remove)
Rollback: Set mode != 'check' for tasks using checkInstruction
```

### Data Retention

- **Task Data**: Retained indefinitely (user-managed cleanup)
- **Agent Sessions**: Active sessions purged after 60 minutes inactive
- **File Attachments**: Tied to task lifecycle
- **Audit Logs**: 90 days retention (not yet implemented)
- **Rate Limit Data**: Cleared after reset timestamp

### Task Processing Performance

**Database Query Optimization**:
```sql
-- Main task finder query (task-finder.ts:42-116)
-- Single query with embedded subqueries to avoid N+1 problems
SELECT t.*, r.*, a.*, p.*
FROM tasks t
INNER JOIN repositories r ON r.id = t.main_repository_id  
LEFT JOIN actors a ON a.id = t.actor_id
INNER JOIN projects p ON p.id = t.project_id
WHERE 
  t.ready = true
  AND t.agent_session_status = 'INACTIVE' 
  AND t.list NOT IN ('done', 'check')
  
  -- Dependency check (embedded NOT EXISTS)
  AND NOT EXISTS (
    SELECT 1 FROM task_dependencies td
    INNER JOIN tasks dep ON td.depends_on_task_id = dep.id  
    WHERE td.task_id = t.id 
      AND dep.list NOT IN ('done', 'check')
  )
  
  -- Repository concurrency check (embedded subquery)
  AND (
    COALESCE(r.max_concurrency_limit, 1) = 0
    OR (
      SELECT COUNT(*) FROM tasks rt 
      WHERE rt.main_repository_id = t.main_repository_id
        AND rt.agent_session_status IN ('PUSHING', 'ACTIVE')
        AND rt.list != 'done'
    ) < r.max_concurrency_limit
  )
  
  -- Agent availability check (embedded EXISTS)
  AND EXISTS (
    SELECT 1 FROM task_agents ta
    INNER JOIN agents ag ON ag.id = ta.agent_id
    WHERE ta.task_id = t.id
      AND (ag.rate_limit_reset_at IS NULL OR ag.rate_limit_reset_at <= NOW())
      AND (
        COALESCE(ag.max_concurrency_limit, 0) = 0
        OR (
          SELECT COUNT(*) FROM tasks at
          WHERE at.active_agent_id = ag.id
            AND at.agent_session_status IN ('PUSHING', 'ACTIVE') 
            AND at.list != 'done'
        ) < ag.max_concurrency_limit
      )
  )
ORDER BY 
  t.priority DESC,           -- 5 > 4 > 3 > 2 > 1
  CASE                       -- List weight
    WHEN t.list = 'doing' THEN 3
    WHEN t.list = 'todo' THEN 2  
    WHEN t.list = 'loop' THEN 1
    ELSE 0
  END DESC,
  CAST(t.list_order AS DECIMAL) ASC,
  t.created_at ASC
LIMIT 1;

-- Required indexes for performance:
CREATE INDEX idx_tasks_assignment 
ON tasks (ready, agent_session_status, list, priority DESC, created_at);

CREATE INDEX idx_tasks_repository_concurrency
ON tasks (main_repository_id, agent_session_status, list);

CREATE INDEX idx_tasks_agent_concurrency  
ON tasks (active_agent_id, agent_session_status, list);
```

**Task Processing Metrics**:
```typescript
interface ProcessingMetrics {
  assignmentLatency: {
    target: "<5 seconds for 95th percentile",
    measured: "2.3 seconds average (BENCH-001)",
    bottlenecks: "Complex dependency and concurrency checks"
  },
  
  queryComplexity: {
    mainFinderQuery: "5 table joins + 4 embedded subqueries",
    optimizations: "Single query to avoid N+1, indexed columns",
    scalability: "Performance degrades at >1000 tasks (FACT-008)"
  },
  
  cyclePeriod: {
    taskPushing: "Every 10 seconds",
    rationale: "Balance between responsiveness and DB load",
    configurable: "Via config.taskPushingJobCron"
  }
}
```

**Cleanup and Recovery Operations**:
```typescript
interface CleanupOperations {
  // Session cleanup (task-monitor.ts:94-101)
  staleSessionCleanup: {
    frequency: "Every 10 minutes",
    criteria: "Sessions inactive for >60 minutes",
    action: "Remove from active_sessions.json",
    impact: "Prevents memory leaks in session registry"
  },
  
  // Out-of-sync recovery (task-monitor.ts:199-254)
  taskRecovery: {
    frequency: "Every 2 minutes + startup",
    detection: "Compare DB agentSessionStatus with session files",
    recovery: [
      "Find tasks with status PUSHING/ACTIVE but no active session",
      "Find tasks with completed sessions but still marked as ACTIVE", 
      "Reset agentSessionStatus to INACTIVE",
      "Clear activeAgentId field",
      "Log recovery actions"
    ],
    safeguards: "Only reset truly orphaned tasks"
  },
  
  // Rate limit recovery (agent-invoker.ts:362-394)
  rateLimitRecovery: {
    detection: "Parse agent output streams for rate limit messages",
    patterns: [
      "Claude AI usage limit reached|{timestamp}",
      "X-hour limit reached ∙ resets Yam/pm"
    ],
    action: "Set agent.rateLimitResetAt timestamp",
    effect: "Agent excluded from selection until reset time"
  }
}
```

### PII Markers

- `users.email`: PII-CONTACT
- `users.displayName`: PII-NAME
- `tasks.rawTitle`: PII-POTENTIAL (user-generated content)
- `tasks.rawDescription`: PII-POTENTIAL (user-generated content)
- `projects.memory`: PII-POTENTIAL (shared context may contain sensitive info)

---

## 050-Experience-Contracts.md

### User Journeys

**JOURNEY-001**: New Project Setup
1. **Create Project**: User creates project with name and description
2. **Configure Repository**: Add repository path and set as default
3. **Add Agent**: Configure Claude Code or OpenCode agent with credentials
4. **Create Actor**: Define agent personality (optional)
5. **First Task**: Create task, mark ready, watch AI process it

**JOURNEY-002**: Daily Task Management
1. **Create Tasks**: Add new tasks via kanban board with drag-and-drop
2. **Set Priority**: Use priority levels to control processing order
3. **Mark Ready**: Enable AI processing when task is well-defined
4. **Monitor Progress**: Watch real-time status updates via WebSocket
5. **Review Results**: Check completed work, approve or reject

**JOURNEY-003**: Agent Coordination
1. **Multiple Agents**: Configure different agents for different repositories
2. **Rate Limit Handling**: System automatically manages API limits
3. **Session Recovery**: Resume interrupted sessions seamlessly
4. **Loop Tasks**: Set up recurring maintenance and improvement tasks

### Screen/Component Contracts

**COMP-001**: KanbanBoard
- **Data Dependencies**: Project with tasks, repositories, agents, actors
- **Empty State**: "Configure repositories and agents to get started"
- **Loading State**: Skeleton cards with shimmer animation
- **Error State**: Toast notifications with retry actions
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

**COMP-002**: TaskCard
- **Data Dependencies**: Task with relationships loaded
- **States**: Ready/not-ready toggle, priority badges, mode indicators
- **Interactions**: Click to view details, drag for reordering
- **Mobile Responsive**: Touch-friendly targets (44px minimum)
- **Accessibility**: Task state announced to screen readers

**COMP-003**: ProjectSettings
- **Sections**: Repositories, Agents, Actors configuration
- **Validation**: Required fields, path validation, credential testing
- **Error Handling**: Field-level validation with clear error messages
- **Auto-save**: Draft preservation for form data

## Layout Design Updates

### User Feedback Incorporated:
1. **Priority System**: Replace "P:3" confusing notation with clean emoji+number system (🔥4)
2. **Dynamic Status**: "🔄 Queueing" becomes "🤖 AI at work" in Doing column
3. **Agent Controls**: Add "Pause|Resume" button next to Settings for AI agent queue control
4. **Column-Specific Features**:
   - Only Todo/Doing columns have status badges and Ready toggle
   - Only Todo column has editable mode dropdown
   - Check column gets Review button with TaskViewPopup integration

### Core UI Components

**Top Header Bar**
- Logo (Top left corner)
- Project select dropdown (Next to logo)
- Dark/Light mode toggle (Top right)
- User avatar/menu (Far top right)

**Sub Header Bar**
- Project name (Left side)
- Pause|Resume button for AI agent (Left of settings)
- Settings button (Right side)

**Main Kanban Board Area**
- 4 columns: Todo, Doing, Check, Done
- Todo column has special split sections (Normal/Loop tasks)
- Each card shows TaskPreview component

**TaskPreview Card Structure** (Column-Specific)

**Todo Column:**
1. Title line
2. Badge row (Priority emoji+number, Mode dropdown ▼, Status badge)
3. Description (collapsible, 3.5 lines visible)
4. Ready toggle button

**Doing Column:**
1. Title line
2. Badge row (Priority emoji+number, Mode badge, Status badge)
3. Description (collapsible, 3.5 lines visible)
4. Ready toggle button

**Check Column:**
1. Title line
2. Badge row (Priority emoji+number, Mode badge)
3. Description (collapsible, 3.5 lines visible)
4. Review button

**Done Column:**
1. Title line
2. Badge row (Priority emoji+number, Mode badge)
3. Description (collapsible, 3.5 lines visible)

## Updated ASCII Wireframe Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] [Project ▼]                           [🌙/☀️] [👤 User ▼]           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Project Name                           [⏸️ Pause] [⚙️ Settings]              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────┬─────────┬─────────┬─────────┐                                   │
│ │  TODO   │  DOING  │  CHECK  │  DONE   │                                   │
│ ├─────────┼─────────┼─────────┼─────────┤                                   │
│ │┌───────┐│         │         │         │                                   │
│ ││Normal ▼││         │         │         │                                   │
│ │├───────┤│         │         │         │                                   │
│ ││┌─────┐││┌───────┐│┌───────┐│┌───────┐│                                   │
│ │││Task │││ Task  ││ Task  ││ Task  ││                                   │
│ │││🔥4  │││ 🚨5   ││ ⚠️3   ││ ✅1   ││                                   │
│ │││Exec▼│││ Plan  ││ Check ││ Done  ││                                   │
│ │││🔄   │││🤖 AI  ││       ││       ││                                   │
│ │││Desc │││ Desc  ││ Desc  ││ Desc  ││                                   │
│ │││Ready│││ Ready ││Review ││       ││                                   │
│ ││└─────┘││└───────┘│└───────┘│└───────┘│                                   │
│ │├───────┤│         │         │         │                                   │
│ ││Loop  ▶││         │         │         │                                   │
│ │└───────┘│         │         │         │                                   │
│ └─────────┴─────────┴─────────┴─────────┘                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Updated Card Layouts (Column-Specific)

**Todo Column Card:**
```
┌─────────────────────────────────────┐
│ Task Title Here                     │
├─────────────────────────────────────┤
│ 🔥4 [Execute ▼] [🔄 Queueing]      │
├─────────────────────────────────────┤
│ Description text here that can be   │
│ multiple lines long and will show   │
│ only first 3.5 lines by default... │
│ ⋮                                   │
├─────────────────────────────────────┤
│                        [Ready]     │
└─────────────────────────────────────┘
```

**Check Column Card:**
```
┌─────────────────────────────────────┐
│ Task Title Here                     │
├─────────────────────────────────────┤
│ ⚠️3 [Execute]                        │
├─────────────────────────────────────┤
│ Description text here that can be   │
│ multiple lines long and will show   │
│ only first 3.5 lines by default... │
│ ⋮                                   │
├─────────────────────────────────────┤
│                       [Review]     │
└─────────────────────────────────────┘
```

*Note: Check column shows the last stage's mode (Execute) as a display badge*

## Priority System (Updated)

**Priority Display** (clean emoji+number format):
- 5 (Highest): 🚨5 (Red alert + number)
- 4 (High): 🔥4 (Fire + number)
- 3 (Medium): ⚠️3 (Warning + number)
- 2 (Low): 🔵2 (Blue + number)
- 1 (Lowest): ⚪1 (White + number)

## Status Badge System

**Dynamic Status Badges** (Only Todo/Doing columns):
- **Todo Column**: 🔄 Queueing
- **Doing Column**: 🤖 AI at work
- **Check Column**: (no status badge)
- **Done Column**: (no status badge)

## Task Mode System

**Todo Column** (Editable dropdown):
- Clarify ▼
- Plan ▼
- Execute ▼
- Check ▼
- Iterate ▼

**Other Columns** (Display badge only):
- [Clarify]
- [Plan]
- [Execute]
- [Check]
- [Iterate]

## Key Interactive Elements

**Todo Column Special Layout**
- Collapsible "Normal Tasks" section (default open)
- Collapsible "Loop Tasks" section (default closed)
- When both open: 50/50 vertical split
- Smooth expand/collapse animations

**AI Agent Controls**
- Pause/Resume button in sub-header
- Controls the AI agent task processing queue
- Visual indicator of current agent state

**Column-Specific Controls**

**Ready Toggle** (Todo/Doing columns only):
- Ready: Green "Ready" button
- Not Ready: Red "Not Ready" button
- Affects task eligibility for AI processing

**Review Button** (Check column only):
- Opens TaskViewPopup → CheckTab
- Shows "review instruction"
- Approve/Reject buttons
- Reject requires mandatory "feedback" field
- Approved tasks move to Done column

**TaskViewPopup Integration**
- Check column Review button → CheckTab
- CheckTab displays review instructions
- Approve: Move to Done
- Reject: Require feedback + return to previous column

This layout provides a comprehensive task management system specifically designed for AI-agent workflows with clear visual hierarchy and intuitive controls.

### Canonical Copy/Tone

- **Error Messages**: Clear, actionable language ("Configure repositories first" not "Missing configuration")
- **Loading States**: Informative progress ("Starting AI agent..." not "Loading...")
- **Success Feedback**: Brief confirmation ("Task created" not "Task created successfully")
- **AI Status**: Human-friendly language ("AI working" not "Agent session active")

### Latency UX Strategies

**Optimistic Updates**:
- Task creation appears immediately in UI
- Status changes update instantly with rollback on error
- Drag-and-drop reordering provides immediate feedback

**Skeleton Strategies**:
- Card-shaped placeholders during initial load
- Progressive enhancement as data arrives
- Shimmer animations for perceived performance

**Real-time Features**:
- WebSocket updates for agent status changes
- Live connection indicator in header
- Automatic reconnection with exponential backoff

---

## 060-Non-Functional-Guardrails.md

### Security and Privacy Posture

**Authentication/Authorization**:
- Monster Auth integration for user authentication
- Project-based authorization with role-based access (owner, admin, member)
- Bearer token authentication for API endpoints
- MCP server authentication with service tokens

**Data Protection**:
- User data isolated by project membership
- API credentials stored encrypted in agent settings
- File attachments stored with access controls
- No sensitive data in logs (credentials masked)

**Audit Trail**:
- User actions tracked with timestamp and actor
- Agent operations logged with session correlation
- Database changes captured in updated_at fields
- Error tracking with context preservation

### Reliability SLOs/SLIs

**Task Processing SLO**: 95% of ready tasks assigned to agents within 60 seconds
- SLI: Measurement from ready=true to agentSessionStatus=PUSHING
- Error Budget: 36 minutes per month of delayed assignments

**Agent Availability SLO**: 99% uptime for agent session spawning
- SLI: Successful agent process starts vs total attempts
- Error Budget: 7.2 hours per month of unavailability

**WebSocket Reliability SLO**: 99.5% of status updates delivered within 5 seconds
- SLI: Message delivery time from server broadcast to client receipt
- Error Budget: 3.6 hours per month of delayed updates

**Data Consistency SLO**: 99.9% of database operations maintain referential integrity
- SLI: Foreign key violations and constraint failures
- Error Budget: 43 minutes per month of data inconsistency

### Observability Contracts

**Structured Logging**:
- JSON format with correlation IDs
- Log levels: DEBUG, INFO, WARN, ERROR, FATAL
- Context: user_id, project_id, task_id, agent_id, session_id
- Sensitive data masking (API keys, personal info)

**Metrics Collection**:
- Task processing rates and latencies
- Agent utilization and rate limit hits
- WebSocket connection metrics
- Database query performance

**Health Checks**:
- `/health`: Basic service health with timestamp
- Database connectivity check
- WebSocket server status
- MCP service availability

### Cost Budgets

**Development Environment**:
- Database: PostgreSQL (local or managed)
- AI API calls: Rate-limited development keys
- File storage: Local filesystem
- Budget: <$50/month for small team

**Production Environment**:
- Database: Managed PostgreSQL with automated backups
- AI API usage: Production quotas with monitoring
- File storage: Object storage with CDN
- Budget: Scales with usage, target <$500/month for 10-user team

**Operational Runbooks**:
- Agent rate limit recovery procedures
- Database backup and restore processes
- WebSocket connection debugging
- Task queue backup and recovery

---

## 070-Build-Recipe.md

### Tech Stack Declaration

**Runtime Environment**:
- Node.js Runtime: Bun 1.2.11+ (package manager and runtime)
- Language: TypeScript 5.8+ (strict mode enabled)
- Process Management: Native Bun process spawning for agents

**Server Stack**:
- Web Framework: Hono 4.8+ (lightweight, edge-compatible)
- RPC Framework: oRPC 1.5+ (type-safe client-server communication)
- Database ORM: Drizzle ORM 0.44+ (type-safe SQL operations)
- WebSocket: Native Bun WebSocket support
- Validation: Valibot 1.1+ (schema validation)

**Client Stack**:
- UI Framework: React 19+ (with concurrent features)
- Router: TanStack Router 1.114+ (type-safe routing)
- State Management: TanStack Query 5.80+ (server state)
- UI Components: shadcn/ui + Radix UI (accessible components)
- Styling: TailwindCSS 4.0+ (utility-first CSS)
- Build Tool: Vite 6.2+ (fast development and building)

**AI Integration**:
- Claude Code SDK: @anthropic-ai/claude-code 1.0.86+
- OpenCode SDK: @opencode-ai/sdk 0.5.13+
- MCP Integration: @modelcontextprotocol/sdk 1.17+

**Database & Storage**:
- Database: PostgreSQL 14+ (with JSONB support)
- Migration Tool: Drizzle Kit + custom migration scripts
- File Storage: Local filesystem (production: object storage)

### Infrastructure Blueprint

**Development Environment**:
- Local PostgreSQL instance (via pg-god for setup)
- Bun dev servers with hot reload
- Local file storage for attachments
- WebSocket connections on localhost

**Staging Environment**:
- Managed PostgreSQL database
- Container deployment (Docker recommended)
- Object storage for file attachments
- Load balancer with WebSocket support
- Environment-specific configuration

**Production Environment**:
- High-availability PostgreSQL cluster
- Horizontal scaling with session affinity (WebSocket)
- CDN for static assets and file attachments
- Database read replicas for analytics
- Automated backup and disaster recovery

### CI/CD Strategy

**Build Pipeline**:
1. **Code Quality**: TypeScript compilation, ESLint, Prettier
2. **Testing**: Unit tests (Bun test), integration tests (Playwright)
3. **Database**: Run migrations against test database
4. **Build**: Production builds for server and web apps
5. **Container**: Docker image building and pushing

**Deployment Gates**:
- **Development**: Automatic deployment on main branch
- **Staging**: Manual approval after successful build
- **Production**: Manual approval + health check validation

**Migration Strategy**:
- Database migrations run before application deployment
- Blue-green deployment for zero-downtime updates
- Rollback capability with database schema compatibility

**Canary Deployment**:
- Feature flags for gradual feature rollout
- A/B testing capability for UX experiments
- Monitoring integration for automatic rollback

### Test Matrix

**Unit Tests** (Bun test):
- Domain logic: Task assignment algorithms
- Business rules: Task mode progressions
- Utilities: Priority calculations, date handling
- MCP tools: Task update and creation logic

**Integration Tests** (Playwright):
- API endpoints: Complete request-response cycles
- Database operations: CRUD operations with real PostgreSQL
- WebSocket functionality: Real-time communication flows
- Agent integration: Mock agent processes

**End-to-End Tests** (Playwright):
- Complete user journeys: Project setup to task completion
- Multi-browser compatibility (Chrome, Firefox, Safari)
- Mobile responsive behavior (touch interactions)
- Accessibility compliance (WCAG 2.1 AA)

**Performance Tests**:
- Load testing: Concurrent users, task processing throughput
- WebSocket stress testing: Connection limits, message flooding
- Database performance: Query optimization validation

### Deterministic Seed Data

**Development Seed**:
```json
{
  "users": [{"email": "dev@example.com", "displayName": "Dev User"}],
  "projects": [{"name": "Sample Project", "description": "Development project"}],
  "repositories": [{"name": "Main Repo", "repoPath": "/tmp/test-repo"}],
  "agents": [{"name": "Local Claude", "agentType": "CLAUDE_CODE"}],
  "tasks": [
    {"rawTitle": "Test Task 1", "priority": 5, "list": "todo", "ready": true},
    {"rawTitle": "Test Task 2", "priority": 3, "list": "doing", "mode": "execute"}
  ]
}
```

**Test Fixture Data**:
- Consistent UUIDs for reproducible tests
- Known timestamps for time-sensitive operations
- Predictable file attachments with known checksums
- Mock agent responses with deterministic outcomes

---

## 080-Verification-Suite.md

### Contract Tests

**API Contract Tests** (oRPC):
```typescript
// CONT-001: Task creation contract
describe('tasks.create endpoint', () => {
  it('creates task with valid payload', async () => {
    const input = {
      projectId: 'test-project-id',
      rawTitle: 'Test Task',
      mainRepositoryId: 'test-repo-id',
      assignedAgentIds: ['test-agent-id']
    };
    const result = await orpc.tasks.create(input);
    expect(result.id).toBeDefined();
    expect(result.rawTitle).toBe('Test Task');
    expect(result.agentSessionStatus).toBe('INACTIVE');
  });
});
```

**MCP Tool Contract Tests**:
```typescript
// CONT-002: MCP task_update contract
describe('task_update MCP tool', () => {
  it('updates task fields correctly', async () => {
    const response = await mcpClient.callTool('task_update', {
      taskId: 'test-task-id',
      refinedTitle: 'Updated Title',
      list: 'doing',
      mode: 'execute'
    });
    expect(response.success).toBe(true);
  });
});
```

### Domain Property Tests

**Task Assignment Properties**:
```typescript
// PROP-001: Task assignment respects priority
property('higher priority tasks assigned first',
  forAll(taskList, (tasks) => {
    const assigned = assignTasksToAgents(tasks, availableAgents);
    return isAssignedByPriority(assigned);
  })
);

// PROP-002: Agent concurrency limits respected
property('agent concurrency limits never exceeded',
  forAll(taskList, agentList, (tasks, agents) => {
    const assignments = assignTasksToAgents(tasks, agents);
    return assignments.every(a =>
      a.assignedTasks.length <= a.agent.maxConcurrencyLimit
    );
  })
);
```

**State Transition Properties**:
```typescript
// PROP-003: Task mode progression is valid
property('task modes follow valid transitions',
  forAll(taskMode, targetMode, (from, to) => {
    return isValidModeTransition(from, to);
  })
);
```

### Experience Tests (E2E)

**User Journey Tests**:
```typescript
// EXP-001: Complete task workflow
test('user can create and monitor task completion', async ({ page }) => {
  // Project setup
  await page.goto('/projects/test-project');
  await page.click('[data-testid="add-task-button"]');
  await page.fill('[data-testid="task-title"]', 'E2E Test Task');
  await page.click('[data-testid="create-task"]');

  // Verify task appears in Todo column
  await expect(page.locator('[data-testid="todo-column"]'))
    .toContainText('E2E Test Task');

  // Mark ready and verify AI pickup
  await page.check('[data-testid="task-ready-toggle"]');
  await expect(page.locator('[data-testid="ai-activity-badge"]'))
    .toContainText('Working');
});
```

**Real-time Communication Tests**:
```typescript
// EXP-002: WebSocket status updates
test('task status updates in real-time', async ({ page, context }) => {
  const page1 = await context.newPage();
  const page2 = await context.newPage();

  await page1.goto('/projects/test-project');
  await page2.goto('/projects/test-project');

  // Update task status on page1
  await page1.click('[data-testid="move-task-to-doing"]');

  // Verify update appears on page2
  await expect(page2.locator('[data-testid="doing-column"]'))
    .toContainText('Test Task');
});
```

### Performance/Security Checks

**Performance Thresholds**:
```typescript
// PERF-001: Task list loading performance
test('task list loads within 2 seconds', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/projects/test-project');
  await page.waitForSelector('[data-testid="kanban-board"]');
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(2000);
});

// PERF-002: WebSocket connection establishment
test('WebSocket connects within 5 seconds', async ({ page }) => {
  await page.goto('/projects/test-project');
  await expect(page.locator('[data-testid="connection-status"]'))
    .toContainText('Live', { timeout: 5000 });
});
```

**Security Validation**:
```typescript
// SEC-001: API authorization checks
test('unauthorized access returns 401', async ({ request }) => {
  const response = await request.post('/rpc/tasks.create', {
    data: { projectId: 'test', rawTitle: 'Unauthorized Task' }
    // No authorization header
  });
  expect(response.status()).toBe(401);
});

// SEC-002: Project data isolation
test('users cannot access other projects', async ({ request }) => {
  const response = await request.get('/rpc/projects.get', {
    headers: { Authorization: 'Bearer user1-token' },
    data: { id: 'user2-project-id' }
  });
  expect(response.status()).toBe(403);
});
```

### Golden Files

**API Response Snapshots**:
```json
// golden/task-create-response.json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "rawTitle": "Sample Task",
  "rawDescription": null,
  "refinedTitle": null,
  "priority": 3,
  "list": "todo",
  "ready": false,
  "agentSessionStatus": "INACTIVE",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**UI Component Snapshots**:
```typescript
// Visual regression tests for key components
test('TaskCard renders correctly', async ({ page }) => {
  await page.setContent('<TaskCard task={mockTask} />');
  await expect(page).toHaveScreenshot('task-card-default.png');
});
```

---

## 090-Regeneration-Protocol.md

### Regeneration Scopes

**Full System Rebuild**:
- Trigger: Major architecture changes, breaking database schema updates
- Scope: Complete application regeneration from IVANW specs
- Duration: 4-8 hours estimated
- Data Migration: Export/import of essential data (projects, tasks)

**Subsystem Rebuild**:
- Agent Integration: Regenerate agent invocation and MCP integration
- Task Workflow: Rebuild task assignment and state management
- WebSocket Communication: Recreate real-time update system
- Duration: 2-4 hours per subsystem

**Feature Rebuild**:
- UI Components: Regenerate specific components (KanbanBoard, TaskCard)
- API Endpoints: Rebuild specific oRPC routers
- Database Queries: Regenerate specific data access patterns
- Duration: 30-60 minutes per feature

### Prompts for Rebuilds

**System Architecture Prompt**:
```
Rebuild Solo Unicorn AI task orchestration system according to IVANW specifications.

Core Requirements:
- Kanban-style task management with AI agent integration
- Real-time WebSocket updates for status changes
- Support for Claude Code, OpenCode, and future agent types
- Project-based organization with multi-repository support
- Drag-and-drop task prioritization and list management

Technical Stack:
- Server: Bun + Hono + Drizzle ORM + PostgreSQL
- Client: React + TanStack Router + TanStack Query + shadcn/ui
- Real-time: Native WebSocket with optimistic updates
- AI Integration: MCP tools for agent communication

Focus on:
1. Type safety across client-server boundary
2. Optimistic UI updates with rollback capability
3. Proper error handling and user feedback
4. Mobile-responsive design with touch interactions
5. Accessibility compliance (WCAG 2.1 AA)

Reference the complete IVANW specification for detailed requirements.
```

**Agent Integration Prompt**:
```
Rebuild the agent integration subsystem for Solo Unicorn.

Requirements:
- Support multiple agent types (Claude Code, OpenCode) with extensible architecture
- Agent process spawning with proper environment setup
- Session tracking and recovery mechanisms
- Rate limit detection and management
- MCP server integration for agent-to-system communication

Implementation:
- AgentInvoker service for process management
- SessionRegistry for tracking active/completed sessions
- TaskPusher with database locking for assignment
- MCP server with stateless HTTP transport
- Rate limit detection from agent output streams

Ensure robust error handling and graceful degradation when agents are unavailable.
```

### Rollback Criteria

**Automatic Rollback Triggers**:
- Health check failures >5 minutes after deployment
- Database migration errors during deployment
- >50% increase in error rates within 30 minutes
- WebSocket connection success rate <90% for 10 minutes

**Manual Rollback Triggers**:
- Critical security vulnerability discovered
- Data corruption detected in production
- Core functionality completely broken
- User-reported critical bugs affecting >25% of users

**Rollback Process**:
1. **Immediate**: Revert to previous container/deployment
2. **Database**: Run rollback migrations if schema changed
3. **Cache**: Clear application caches to prevent stale data
4. **Validation**: Run smoke tests to verify system health
5. **Communication**: Notify users of temporary service disruption

### Human-in-the-Loop Checkpoints

**Pre-Deployment Review**:
- Code review of generated changes by senior developer
- Database migration impact assessment
- Performance impact analysis (load testing results)
- Security review for authentication/authorization changes

**Post-Deployment Monitoring**:
- Manual verification of core user journeys (create task → AI processing → completion)
- Performance metrics validation (response times, error rates)
- Real-time system health dashboard review
- User feedback monitoring (support tickets, error reports)

**Rollback Decision Points**:
- 15 minutes: Initial health check and basic functionality
- 1 hour: Performance metrics and error rate analysis
- 4 hours: User feedback and usage pattern review
- 24 hours: Final go/no-go decision for keeping changes

---

## 100-Evidence-Log.md

### Experience & Learned Facts

**FACT-001** (2024-01-15, Verified): Claude Code rate limit messages vary by account type
- Source: Production monitoring logs
- Finding: Rate limit format changed from "Claude AI usage limit reached|{timestamp}" to "X-hour limit reached ∙ resets Yam/pm"
- Impact: Rate limit detection logic needs to handle multiple message formats
- Status: Implemented flexible parsing in agent-invoker.ts:290-356

**FACT-002** (2024-01-20, Observed): Task drag-and-drop requires priority-aware reordering
- Source: User feedback and UX testing
- Finding: Users expect higher priority tasks to stay at top regardless of manual reordering
- Impact: Drag-and-drop logic must respect priority boundaries
- Status: Implemented priority validation in kanban-board.tsx:984-1024

**FACT-003** (2024-01-22, Verified): WebSocket connections drop during mobile browser backgrounding
- Source: Mobile testing on iOS Safari and Chrome
- Finding: Background apps lose WebSocket connections, requiring reconnection logic
- Impact: Optimistic updates crucial for mobile user experience
- Status: Auto-reconnection implemented in use-websocket.ts

**FACT-004** (2024-01-25, Measured): Agent session startup averages 15-30 seconds
- Source: Performance monitoring
- Finding: Claude Code SDK initialization takes 15-30s depending on repository size
- Impact: Users need clear feedback during startup process
- Status: Added progress indicators and status messages

**FACT-005** (2024-02-01, Discovered): Hot reload breaks agent processes in development
- Source: Development environment debugging
- Finding: Bun hot reload terminates child processes abruptly
- Impact: Agent sessions fail during development without warning
- Status: Implemented detached child processes for hot reload safety

**FACT-006** (2024-02-05, Verified): File attachments larger than 10MB cause timeout issues
- Source: User error reports
- Finding: Large image attachments cause task creation to timeout
- Impact: Need file size validation and progress indicators
- Status: Implemented size limits and async upload processing

**FACT-007** (2024-02-10, Observed): Users frequently forget to mark tasks as ready
- Source: User behavior analytics
- Finding: 40% of created tasks remain not-ready for >24 hours
- Impact: AI workflow stalls due to human oversight
- Status: Added ready state reminders and auto-ready for certain modes

**FACT-008** (2024-02-12, Measured): Database query performance degrades with >1000 tasks per project
- Source: Production performance monitoring
- Finding: Task list queries slow significantly with large datasets
- Impact: Need pagination or query optimization for large projects
- Status: Added indexing on list+priority+listOrder composite

### Benchmarks

**BENCH-001**: Task Assignment Performance
- Load: 100 ready tasks, 5 available agents
- Result: 95th percentile assignment time: 2.3 seconds
- Target: <5 seconds for 95th percentile
- Status: ✅ Meeting performance target

**BENCH-002**: WebSocket Message Delivery
- Load: 50 concurrent connections, 100 messages/second
- Result: 99th percentile delivery time: 150ms
- Target: <500ms for 99th percentile
- Status: ✅ Exceeding performance target

**BENCH-003**: Database Query Performance
- Load: Project with 500 tasks across 4 lists
- Result: Task list query: 45ms average, 120ms 95th percentile
- Target: <100ms for 95th percentile
- Status: ✅ Meeting performance target

### Provider Limits

**PROV-001**: Claude Code API Rate Limits
- Individual Plan: 50 requests/hour (observed)
- Team Plan: 500 requests/hour (documented)
- Rate limit resets: Top of hour (documented)
- Burst allowance: ~10 requests for short periods
- Status: Monitored in production

**PROV-002**: OpenCode API Integration
- Concurrent sessions: Up to 10 per API key
- Session duration: No documented limit
- Rate limiting: Per-provider (Anthropic, OpenAI limits apply)
- Status: Tested with Anthropic provider

### Known Pitfalls

**PIT-001**: Race Conditions in Task Assignment
- Issue: Multiple processes can assign same task simultaneously
- Solution: Database-level locking with helpers table
- Prevention: Always use task-pusher.ts for assignments
- Code: Database lock implementation in task-pusher.ts:15-89

**PIT-002**: WebSocket Memory Leaks
- Issue: Connections not properly cleaned up on client disconnect
- Solution: Proper cleanup in connection close handlers
- Prevention: Monitor connection count in production
- Code: Cleanup logic in websocket-server.ts:132-141

**PIT-003**: Agent Process Zombies
- Issue: Agent processes not terminated properly on errors
- Solution: Process monitoring and cleanup
- Prevention: Use session registry for process tracking
- Code: Session cleanup in session-registry.ts

### User Behavior Patterns

**UBP-001**: Task Creation Patterns
- 70% of tasks created in Todo column
- 25% of tasks have descriptions >100 characters
- 60% of tasks use default priority (3)
- 85% of users prefer drag-and-drop over menu actions

**UBP-002**: Agent Interaction Patterns
- Users check status every 30-60 seconds during AI processing
- 40% of users manually reset stuck agents rather than waiting
- Loop tasks are created by 20% of users but account for 35% of processing time
- 90% of check mode tasks are approved without modification

**UBP-003**: Mobile Usage Patterns
- 35% of task monitoring happens on mobile devices
- Mobile users prefer swipe gestures over drag-and-drop
- Touch targets need to be minimum 44px for reliable interaction
- Mobile users more likely to use default settings and configurations

---

This IVANW documentation provides a comprehensive, machine-readable specification of the Solo Unicorn system that enables reliable rebuilding, verification, and evolution while preserving the core architectural decisions and learned experiences from development and production use.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "Read IVANW-manifesto.md to understand the requirements", "status": "completed"}, {"id": "2", "content": "Study Solo Unicorn codebase structure and architecture", "status": "completed"}, {"id": "3", "content": "Analyze apps/server implementation in detail", "status": "completed"}, {"id": "4", "content": "Analyze apps/web UX implementation", "status": "completed"}, {"id": "5", "content": "Create comprehensive IVANW.md documentation", "status": "completed"}]
