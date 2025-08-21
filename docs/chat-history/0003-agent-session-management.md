# Agent Session Management - Final Design

## Overview

This document describes the final chosen approach for managing agent sessions and task assignment in Solo Unicorn, addressing concurrency limits, session tracking, and recovery from various failure scenarios.

## Core Design Decisions

### Task Session State Management

**Database Fields**:
```sql
ALTER TABLE tasks ADD COLUMN agentSessionStatus TEXT DEFAULT 'INACTIVE';
-- States: 'INACTIVE', 'PUSHING', 'ACTIVE'

-- Replace existing fields
ALTER TABLE tasks DROP COLUMN isAiWorking;
ALTER TABLE tasks DROP COLUMN aiWorkingSince;

-- Add agent tracking field
ALTER TABLE tasks ADD COLUMN activeAgentId UUID REFERENCES agents(id);

-- Add rate limit tracking to agents table
ALTER TABLE agents ADD COLUMN rateLimitResetAt TIMESTAMP;

ALTER TABLE tasks ADD COLUMN lastPushedAt TIMESTAMP;
ALTER TABLE tasks ADD COLUMN lastAgentSessionStartedAt TIMESTAMP;
```

**State Transitions**:
1. `INACTIVE` → `PUSHING`: Task Pusher assigns task to agent
2. `PUSHING` → `ACTIVE`: Claude Code session actually started (callback from spawn)
3. `ACTIVE` → `INACTIVE`: Session fully ended (hook file write or task completion)

**Concurrency Management**:
- Both agent and repo consider tasks in `PUSHING` and `ACTIVE` states as occupying capacity
- This prevents over-assignment during the delay between task assignment and session startup
- `agentSessionStatus` replaces `isAiWorking`: `ACTIVE` = working, `INACTIVE` = not working
- `lastAgentSessionStartedAt` replaces `aiWorkingSince` for tracking session start time
- `activeAgentId` tracks which specific agent is working on the task for rate limit handling

### File-Based Session Registry

**Location**: `~/.solo-unicorn/sessions/`

**Files**:
- `active_sessions.json`: Currently running sessions
- `completed_sessions.json`: Recently completed sessions

**Important Rule**: The same session ID cannot exist in both files simultaneously.

**Structure**:
```json
// active_sessions.json
{
  "sessions": {
    "session-uuid-1": {
      "startedAt": "2024-01-01T12:00:00Z"
    }
  },
  "lastUpdated": "2024-01-01T12:05:00Z"
}

// completed_sessions.json
{
  "sessions": {
    "session-uuid-2": {
      "completedAt": "2024-01-01T12:30:00Z"
    }
  },
  "lastUpdated": "2024-01-01T12:35:00Z"
}
```

### Claude Code Integration

**Direct Process Spawning**:
- Remove Claude Code UI dependency for spawning Claude CLI process. But we will still keep Claude Code UI in `apps/claudecode-ui`.
- Spawn Claude CLI processes directly within Solo Unicorn
- Better process control and session management

**Session Lifecycle**:
1. **Task Assignment**: Solo Unicorn spawns Claude CLI process
2. **Session Started**: HTTP callback provides session ID to update task
3. **Session Ended**: HTTP callback informs session ended.

Meanwhile, Claude Code Hooks:
1. **Session Started**: Hook moves session from active to completed file
2. **Session Ended**: Hook moves session from active to completed file


**Hook Configuration** (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "SessionStart": [{
      "type": "command",
      "command": "node ~/.solo-unicorn/scripts/session-started.js"
    }],
    "Stop": [{
      "type": "command",
      "command": "node ~/.solo-unicorn/scripts/session-ended.js"
    }]
  }
}
```

Hooks receive JSON data via stdin containing session information and event-specific data:

```ts
{
  session_id: string
  transcript_path: string  // Path to conversation JSON
  cwd: string              // The current working directory when the hook is invoked
}
```

**Hook Scripts**:
```javascript
// ~/.solo-unicorn/scripts/session-started.js
const sessionId = JSON.parse(process.argv[1]).session_id;
const fs = require('fs');
const path = require('path');

const activeFile = path.join(process.env.HOME, '.solo-unicorn/sessions/active_sessions.json');
const data = JSON.parse(fs.readFileSync(activeFile, 'utf8'));

// Add session to active (task ID will be added via callback)
data.sessions[sessionId] = {
  startedAt: new Date().toISOString()
};
data.lastUpdated = new Date().toISOString();

fs.writeFileSync(activeFile, JSON.stringify(data, null, 2));

// ~/.solo-unicorn/scripts/session-ended.js
const sessionId = JSON.parse(process.argv[1]).session_id;
const fs = require('fs');
const path = require('path');

const activeFile = path.join(process.env.HOME, '.solo-unicorn/sessions/active_sessions.json');
const completedFile = path.join(process.env.HOME, '.solo-unicorn/sessions/completed_sessions.json');

// Move from active to completed
const activeData = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
const completedData = JSON.parse(fs.readFileSync(completedFile, 'utf8'));

const sessionData = activeData.sessions[sessionId];
if (sessionData) {
  // Remove from active
  delete activeData.sessions[sessionId];
  activeData.lastUpdated = new Date().toISOString();

  // Add to completed
  completedData.sessions[sessionId] = {
    ...sessionData,
    completedAt: new Date().toISOString()
  };
  completedData.lastUpdated = new Date().toISOString();

  fs.writeFileSync(activeFile, JSON.stringify(activeData, null, 2));
  fs.writeFileSync(completedFile, JSON.stringify(completedData, null, 2));
}
```

## Task Pusher Implementation

### Single Query Task Selection

**Function**: `findNextAssignableTask()`

```javascript
// apps/server/src/agents/task-pusher.ts
// Import: import { and, or, eq, ne, desc, asc, sql, inArray, isNull, notExists } from 'drizzle-orm';

async function findNextAssignableTask(): Promise<TaskWithDetails | null> {
  const readyTasks = await db
    .select({
      task: schema.tasks,
      mainRepository: schema.repositories,
      actor: schema.actors,
      project: schema.projects,
      agent: schema.agents
    })
    .from(schema.tasks)
    .innerJoin(schema.repositories, eq(schema.repositories.id, schema.tasks.mainRepositoryId))
    .innerJoin(schema.agents, eq(schema.agents.id, schema.tasks.assignedAgentId))
    .leftJoin(schema.actors, eq(schema.actors.id, schema.tasks.actorId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
    .where(
      and(
        eq(schema.tasks.ready, true),
        eq(schema.tasks.agentSessionStatus, 'INACTIVE'),
        ne(schema.tasks.status, 'done'),
        // Agent not rate limited (rate limit has passed)
        or(
          isNull(schema.agents.rateLimitResetAt),
          sql`${schema.agents.rateLimitResetAt} < NOW()`
        ),
        // Agent capacity check (includes 'pushing' state)
        sql`(
          SELECT COUNT(*) FROM ${schema.tasks} t2
          WHERE t2.assigned_agent_id = ${schema.tasks.assignedAgentId}
          AND t2.agent_session_status IN ('PUSHING', 'ACTIVE')
        ) < ${schema.agents.concurrencyLimit}`,
        // Repo capacity check (includes 'pushing' state)
        sql`(
          SELECT COUNT(*) FROM ${schema.tasks} t3
          WHERE t3.main_repository_id = ${schema.tasks.mainRepositoryId}
          AND t3.agent_session_status IN ('PUSHING', 'ACTIVE')
        ) < ${schema.repositories.concurrencyLimit}`,
        // Dependency check
        notExists(
          db.select().from(schema.taskDependencies)
            .innerJoin(schema.tasks as any, eq(schema.taskDependencies.dependsOnTaskId, (schema.tasks as any).id))
            .where(
              and(
                eq(schema.taskDependencies.taskId, schema.tasks.id),
                ne((schema.tasks as any).status, 'done')
              )
            )
        )
      )
    )
    .orderBy(
      desc(schema.tasks.priority),
      sql`CASE
        WHEN ${schema.tasks.status} = 'doing' THEN 3
        WHEN ${schema.tasks.status} = 'todo' THEN 2
        WHEN ${schema.tasks.status} = 'loop' THEN 1
        ELSE 0
      END DESC`,
      asc(sql`CAST(${schema.tasks.listOrder} AS DECIMAL)`),
      asc(schema.tasks.createdAt)
    )
    .limit(1);

  return readyTasks[0] || null;
}
```

### Function-Based Task Push with Global Lock

**Function**: `tryPushTasks()`

```javascript
// apps/server/src/agents/task-pusher.ts

// Global lock to ensure only one tryPushTasks runs at a time
let isTaskPushingInProgress = false;
const pendingTriggers = new Set<string>();

async function tryPushTasks(reason?: string) {
  const triggerReason = reason || 'unknown';

  // If already running, just record this trigger and exit
  if (isTaskPushingInProgress) {
    pendingTriggers.add(triggerReason);
    console.log(`⏳ Task push already in progress, queued trigger: ${triggerReason}`);
    return;
  }

  // Acquire lock
  isTaskPushingInProgress = true;
  console.log(`🎯 Task push started: ${triggerReason}`);

  try {
    let pushedCount = 0;

    // Keep pushing tasks until no more can be assigned
    while (true) {
      // Find next assignable task
      const task = await findNextAssignableTask();
      if (!task) {
        console.log(`📭 No more assignable tasks available (pushed ${pushedCount} tasks)`);
        break;
      }

      try {
        // ATOMIC: Mark task as pushing
        const updated = await db.update(tasks)
          .set({
            agentSessionStatus: 'PUSHING',
            activeAgentId: task.agent.id,
            lastPushedAt: new Date()
          })
          .where(and(
            eq(tasks.id, task.task.id),
            eq(tasks.agentSessionStatus, 'INACTIVE') // Only update if still non-active
          ));

        if (updated.rowCount === 0) {
          console.log('⚡ Task already assigned by another process');
          break; // Exit loop if no more tasks can be claimed
        }

        // Spawn Claude CLI process
        console.log(`🚀 Spawning Claude process for task ${task.task.id}`);
        const sessionId = await spawnClaudeCodeCLI(task);

        // Update task with session ID
        await db.update(tasks)
          .set({
            lastAgentSessionId: sessionId,
            agentSessionStatus: 'PUSHING' // Keep as pushing until callback
          })
          .where(eq(tasks.id, task.task.id));

        console.log(`✅ Task ${task.task.id} assigned to session ${sessionId}`);
        pushedCount++;

        // Small delay between spawns to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error('❌ Failed to spawn Claude process:', error);

        // Reset task to non-active state
        await db.update(tasks)
          .set({
            agentSessionStatus: 'INACTIVE',
            activeAgentId: null
          })
          .where(eq(tasks.id, task.task.id));

        break; // Exit on error to avoid infinite loops
      }
    }

    if (pushedCount > 0) {
      console.log(`🎉 Successfully pushed ${pushedCount} tasks`);
    }

  } finally {
    // Release lock
    isTaskPushingInProgress = false;

    // Check if there were any pending triggers while we were running
    if (pendingTriggers.size > 0) {
      const queuedReasons = Array.from(pendingTriggers).join(', ');
      pendingTriggers.clear();
      console.log(`🔄 Rerunning task push due to queued triggers: ${queuedReasons}`);

      // Recursively call with a small delay to allow other operations
      setTimeout(() => tryPushTasks(`queued_triggers: ${queuedReasons}`), 50);
    }
  }
}

// Usage throughout application
export { tryPushTasks };

// apps/server/src/routes/tasks.ts
app.post('/tasks', async (c) => {
  const task = await createTask(data);
  tryPushTasks('task_created'); // No await - fire and forget
  return c.json(task);
});

app.patch('/tasks/:id/ready', async (c) => {
  await markTaskReady(id);
  tryPushTasks('task_ready');
  return c.json({ success: true });
});
```

## Task Monitor Implementation

### Monitor Functions

**Purpose**: Detect and resolve stuck tasks and orphaned sessions.

```javascript
// apps/server/src/agents/task-monitor.ts

export function monitorTasks() {
  // Run on startup
  recoverFromCompletedSessions();

  setInterval(() => {
    runAllMonitorChecks();
  }, 5 * 60 * 1000); // 5 minutes
}

async function checkTasksStuckAtPush() {
  const stuckTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.agentSessionStatus, 'PUSHING'),
      // Stuck for more than 2 minutes
      sql`${tasks.lastPushedAt} < NOW() - INTERVAL '2 minutes'`
    )
  });

  for (const task of stuckTasks) {
    console.log(`⚠️ Task ${task.id} stuck in PUSHING state, resetting to INACTIVE`);
    await db.update(tasks)
      .set({
        agentSessionStatus: 'INACTIVE',
        activeAgentId: null,
        lastAgentSessionId: null
      })
      .where(eq(tasks.id, task.id));
  }

  if (stuckTasks.length > 0) {
    tryPushTasks('stuck_pushing_recovered');
  }
}

async function checkTasksStuckAtActive() {
  const stuckTasks = await db.query.tasks.findMany({
    where: and(
      eq(tasks.agentSessionStatus, 'ACTIVE'),
      // No activity for more than 30 minutes
      sql`${tasks.lastAgentSessionStartedAt} < NOW() - INTERVAL '30 minutes'`
    )
  });

  for (const task of stuckTasks) {
    console.log(`⚠️ Task ${task.id} stuck in ACTIVE state for >30min`);

    // Check if session exists in active sessions file
    const activeSession = await getActiveSession(task.lastAgentSessionId);
    if (!activeSession) {
      console.log(`💀 Session ${task.lastAgentSessionId} not found in active sessions, marking task as failed`);
      await db.update(tasks)
        .set({
          agentSessionStatus: 'INACTIVE',
          activeAgentId: null,
          status: 'todo' // Reset to todo for manual review
        })
        .where(eq(tasks.id, task.id));

      tryPushTasks('stuck_active_recovered');
    }
  }
}

async function recoverFromCompletedSessions() {
  console.log('🔍 Checking for completed sessions vs database state');

  const completedSessions = await readCompletedSessionsFile();
  const potentiallyActiveTasks = await db.query.tasks.findMany({
    where: inArray(tasks.agentSessionStatus, ['PUSHING', 'ACTIVE'])
  });

  for (const task of potentiallyActiveTasks) {
    if (!task.lastAgentSessionId) continue;

    const sessionId = task.lastAgentSessionId;

    if (completedSessions.sessions[sessionId]) {
      console.log(`✅ Found completed session ${sessionId}, updating task ${task.id}`);
      await db.update(tasks)
        .set({
          agentSessionStatus: 'INACTIVE',
          activeAgentId: null
        })
        .where(eq(tasks.id, task.id));
    }
  }

  // Try to push new tasks after recovery
  tryPushTasks('session_recovery_completed');
}

async function clearExpiredRateLimits() {
  // Clear rate limit timestamps that have passed
  const clearedAgents = await db.update(agents)
    .set({ rateLimitResetAt: null })
    .where(
      and(
        isNotNull(agents.rateLimitResetAt),
        sql`${agents.rateLimitResetAt} < NOW()`
      )
    )
    .returning({ id: agents.id });

  if (clearedAgents.length > 0) {
    console.log(`🔓 Cleared expired rate limits for ${clearedAgents.length} agents`);
    tryPushTasks('rate_limits_expired');
  }
}

async function runAllMonitorChecks() {
  console.log('🔍 Running task monitor checks');
  await checkTasksStuckAtPush();
  await checkTasksStuckAtActive();
  await recoverFromCompletedSessions();
  await clearExpiredRateLimits();
}

```

## Edge Cases and Solutions

### Edge Case 1: Server Restart During Task Assignment

**Scenario**: Server restarts while task is in `PUSHING` state but before Claude process starts.

**Detection**: `checkTasksStuckAtPush()` finds tasks stuck in `PUSHING` for >2 minutes.

**Solution**: Reset task to `INACTIVE` state and trigger task push.

### Edge Case 2: Claude Process Crashes

**Scenario**: Claude CLI process dies but task remains in `ACTIVE` state.

**Detection**: `checkTasksStuckAtActive()` finds tasks active for >30 minutes with no session in active file.

**Solution**: Mark task as `INACTIVE` and reset status to `todo` for manual review.

### Edge Case 8: Multi-Company Task Fairness

**Scenario**: Company Alpha finishes a task, but `tryPushTasks()` only finds Company Beta tasks at higher priority, preventing Alpha from getting new work assigned.

**Solution**: The recursive `tryPushTasks()` function pushes ALL available tasks across all companies/projects until no more capacity exists. This ensures fair distribution:
- When Alpha's task finishes, `tryPushTasks()` is called
- It finds and pushes Beta's high-priority task
- It continues and finds Alpha's next task
- It keeps going until no more tasks can be assigned
- All available capacity is utilized fairly across companies

### Edge Case 9: Rate Limit Recovery

**Scenario**: Agent hits rate limit, needs to wait before retrying tasks.

**Detection**: `/api/agent-callbacks/rate-limit-hit` callback received.

**Solution**:
- Mark task as `INACTIVE` immediately
- Store rate limit reset time in `agent.rateLimitResetAt` field
- Schedule automatic retry with buffer time
- Prevent rate-limited agents from being selected in `findNextAssignableTask()` via rate limit check

### Edge Case 10: Concurrent tryPushTasks Execution

**Scenario**: Multiple triggers call `tryPushTasks()` simultaneously (e.g., session ended + task created + rate limit expired).

**Problem**: Without coordination, multiple instances could:
- Race condition on task assignment
- Duplicate Claude CLI process spawning
- Waste resources checking same tasks

**Solution**: Global lock mechanism with pending trigger queue:
- Only one `tryPushTasks()` can run at a time (`isTaskPushingInProgress` lock)
- Concurrent calls are queued and their reasons recorded
- After completion, if triggers were queued, automatically rerun with all queued reasons
- Prevents duplicate work while ensuring no triggers are lost

### Edge Case 3: Session Completed But Database Not Updated

**Scenario**: Claude Code completes and writes to completed sessions file, but server missed the callback.

**Detection**: `recoverFromCompletedSessions()` cross-references completed sessions with database state.

**Solution**: Update task status to `INACTIVE` based on completed sessions file.

### Edge Case 4: Duplicate Session IDs

**Scenario**: Same session ID appears in both active and completed files.

**Prevention**: Hook scripts atomically move sessions from active to completed, ensuring no duplicates.

**Recovery**: Task monitor prioritizes completed sessions file over active sessions file.

### Edge Case 5: Callback Endpoint Down

**Scenario**: Solo Unicorn server is down when Claude Code tries to call session started callback.

**Mitigation**:
- Session ID stored in task record during spawn
- Recovery process on startup matches sessions to tasks
- Hook files provide backup state tracking

### Edge Case 6: Hot Reload During Active Session

**Scenario**: Bun dev hot reload happens while Claude session is active.

**Solution**:
- Task state persisted in database
- Session files persist across reloads
- Startup recovery reconciles state

### Edge Case 7: Concurrency Race Conditions

**Scenario**: Multiple task pusher calls try to assign same task.

**Prevention**: Atomic database update with WHERE condition checking current state.

**Result**: Only one pusher can change task from `INACTIVE` to `PUSHING`.

## HTTP Callback Endpoints

All callback endpoints expect `taskId` and `sessionId` in the request body for verification.

```javascript
// apps/server/src/routes/agent-callbacks.ts

app.post('/api/agent-callbacks/session-started', async (c) => {
  const { sessionId, taskId } = await c.req.json();

  // Update task state and timestamp
  await db.update(tasks)
    .set({
      agentSessionStatus: 'ACTIVE',
      lastAgentSessionStartedAt: new Date()
    })
    .where(and(
      eq(tasks.id, taskId),
      eq(tasks.lastAgentSessionId, sessionId)
    ));

  console.log(`🟢 Session ${sessionId} started for task ${taskId}`);

  // Try to push more tasks now that we have confirmed this one started
  tryPushTasks('session_started_confirmed');

  return c.json({ success: true });
});

app.post('/api/agent-callbacks/session-ended', async (c) => {
  const { sessionId, taskId, success } = await c.req.json();

  // Update task state
  await db.update(tasks)
    .set({
      agentSessionStatus: 'INACTIVE',
      activeAgentId: null
    })
    .where(and(
      eq(tasks.id, taskId),
      eq(tasks.lastAgentSessionId, sessionId)
    ));

  console.log(`🔴 Session ${sessionId} ended for task ${taskId}, success: ${success}`);

  // Try to push more tasks since capacity was freed
  tryPushTasks('session_ended');

  return c.json({ success: true });
});

app.post('/api/agent-callbacks/rate-limit-hit', async (c) => {
  const { sessionId, taskId, rateLimitResetAt } = await c.req.json();

  console.log(`🔴 Rate limit hit for session ${sessionId}, task ${taskId}`);
  console.log(`🕐 Rate limit resets at: ${rateLimitResetAt}`);

  // Get task with activeAgentId first
  const task = await db.query.tasks.findFirst({
    where: and(
      eq(tasks.id, taskId),
      eq(tasks.lastAgentSessionId, sessionId)
    )
  });

  if (!task || !task.activeAgentId) {
    console.error(`❌ Task ${taskId} not found or no active agent`);
    return c.json({ error: 'Task not found or no active agent' });
  }

  // Update task state back to non-active
  await db.update(tasks)
    .set({
      agentSessionStatus: 'INACTIVE',
      activeAgentId: null
    })
    .where(eq(tasks.id, taskId));

  // Update agent with rate limit info using activeAgentId (no join needed!)
  await db.update(agents)
    .set({
      rateLimitResetAt: new Date(rateLimitResetAt)
    })
    .where(eq(agents.id, task.activeAgentId));

  // Schedule retry after rate limit resets (add some buffer)
  const resetTime = new Date(rateLimitResetAt);
  const retryTime = new Date(resetTime.getTime() + 60000); // +1 minute buffer
  const delayMs = retryTime.getTime() - Date.now();

  if (delayMs > 0) {
    setTimeout(() => {
      console.log(`⏰ Rate limit should be reset, trying to push tasks`);
      tryPushTasks('rate_limit_expired');
    }, delayMs);
  }

  return c.json({ success: true });
});
```

## Architecture Summary

```
┌─────────────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐
│ Solo Unicorn Server         │    │ File System             │    │ Claude Code CLI         │
│                             │    │                         │    │                         │
│ tryPushTasks() - RECURSIVE  │───▶│ active_sessions.json    │◀───│ Hook: session-started.js│
│ findNextAssignableTask()    │    │ completed_sessions.json │    │ Hook: session-ended.js  │
│ Monitor Functions           │    │                         │    │                         │
│                             │    │ Atomic file operations  │    │ Direct process spawn    │
│ HTTP Callbacks:             │◀───│ No duplicate session IDs│    │ Session resume capable │
│ - session-started           │    │                         │    │                         │
│ - session-ended             │    │                         │    │                         │
│ - rate-limit-hit            │    │                         │    │                         │
│                             │    │                         │    │                         │
│ Database atomic updates     │    │                         │    │                         │
│ INACTIVE|PUSHING|ACTIVE   │    │                         │    │                         │
└─────────────────────────────┘    └─────────────────────────┘    └─────────────────────────┘
```

## Summary of Key Design Decisions

**State Management**:
- ✅ 3-state system: `INACTIVE` → `PUSHING` → `ACTIVE` → `INACTIVE`
- ✅ Replaces `isAiWorking` with `agentSessionStatus`
- ✅ Replaces `aiWorkingSince` with `lastAgentSessionStartedAt`
- ✅ Added `activeAgentId` for direct agent reference in rate limit callbacks

**Task Assignment**:
- ✅ Recursive `tryPushTasks()` ensures fair multi-company task distribution
- ✅ Single optimized query with embedded capacity checks
- ✅ Atomic database operations prevent race conditions

**Session Tracking**:
- ✅ File-based registry survives hot reloads
- ✅ No PID dependency (sessions can be resumed by different processes)
- ✅ Hook scripts write directly to files for reliability

**Monitoring & Recovery**:
- ✅ Function-based monitor functions (no classes)
- ✅ Multiple edge case detection and automatic recovery
- ✅ Rate limit handling with automatic retry scheduling

**Callbacks**:
- ✅ All callbacks include `taskId` and `sessionId` for verification
- ✅ Rate limit callback with `rateLimitResetAt` timestamp
- ✅ Automatic task pushing after capacity changes

---

# Implementation Plan

> **Philosophy**: Feel free to start from scratch. No worries about existing users, inflight data, or backwards compatibility. We can delete the database and rebuild everything cleanly. Focus on the best possible implementation.

This plan provides a detailed breakdown of all tasks needed to implement the new agent session management system, replacing the current orchestrator-based approach.

## Phase 1: Database Schema & Core Infrastructure

### 1.1 Database Schema Updates
- [ ] **Delete existing orchestrator-related code**
  - File: `apps/server/src/agents/orchestrator.ts` - DELETE ENTIRE FILE
  - Reasoning: Starting fresh, current orchestrator logic is incompatible with new design

- [ ] **Update database schema**
  - File: `apps/server/src/db/schema/index.ts`
  - Changes needed:
    - Add `agentSessionStatus` field to tasks table (replaces `isAiWorking`)
    - Add `activeAgentId` field to tasks table
    - Add `lastPushedAt` field to tasks table
    - Add `lastAgentSessionStartedAt` field to tasks table (replaces `aiWorkingSince`)
    - Add `rateLimitResetAt` field to agents table
    - Remove `isAiWorking` field from tasks table
    - Remove `aiWorkingSince` field from tasks table
  - Specific schema changes:
    ```typescript
    // In tasks table
    agentSessionStatus: text('agentSessionStatus').default('INACTIVE'),
    activeAgentId: uuid('activeAgentId').references(() => agents.id),
    lastPushedAt: timestamp('lastPushedAt'),
    lastAgentSessionStartedAt: timestamp('lastAgentSessionStartedAt'),

    // In agents table
    rateLimitResetAt: timestamp('rateLimitResetAt'),
    ```

### 1.2 File-Based Session Registry Setup
- [ ] **Create session registry infrastructure**
  - File: `apps/server/src/agents/session-registry.ts` - NEW FILE
  - Purpose: Manage active_sessions.json and completed_sessions.json files
  - Functions needed:
    - `readActiveSessionsFile()` - Read ~/.solo-unicorn/sessions/active_sessions.json
    - `writeActiveSessionsFile()` - Write ~/.solo-unicorn/sessions/active_sessions.json
    - `readCompletedSessionsFile()` - Read ~/.solo-unicorn/sessions/completed_sessions.json
    - `writeCompletedSessionsFile()` - Write ~/.solo-unicorn/sessions/completed_sessions.json
    - `addActiveSession(sessionId, data)` - Add session to active file
    - `moveToCompletedSessions(sessionId, data)` - Move session from active to completed
    - `removeActiveSession(sessionId)` - Remove session from active file
    - `getActiveSession(sessionId)` - Get specific active session data
  - Directory creation: Ensure `~/.solo-unicorn/sessions/` directory exists
  - Initial file creation: Create empty JSON files if they don't exist

### 1.3 Claude Code Hook Scripts
- [ ] **Create session lifecycle hook scripts**
  - File: `~/.solo-unicorn/scripts/session-started.js` - NEW FILE
  - Purpose: Called by Claude Code SessionStart hook
  - Logic: Read hook data from stdin, add session to active_sessions.json

  - File: `~/.solo-unicorn/scripts/session-ended.js` - NEW FILE
  - Purpose: Called by Claude Code Stop hook
  - Logic: Read hook data from stdin, move session from active to completed

  - File: `~/.solo-unicorn/scripts/setup-hooks.js` - NEW FILE
  - Purpose: Automatically configure Claude Code hooks in ~/.claude/settings.json
  - Logic: Merge hook configuration into existing settings

## Phase 2: Core Task Management

### 2.1 Task Selection Engine
- [ ] **Implement optimized task finder**
  - File: `apps/server/src/agents/task-finder.ts` - NEW FILE
  - Function: `findNextAssignableTask(): Promise<TaskWithDetails | null>`
  - Logic: Single query with embedded subqueries for:
    - Task ready status check
    - Agent session status check (INACTIVE only)
    - Agent rate limit check (exclude rate-limited agents)
    - Agent capacity check (count PUSHING + ACTIVE tasks)
    - Repo capacity check (count PUSHING + ACTIVE tasks)
    - Task dependency check (no incomplete dependencies)
    - Priority ordering (P5 > P4 > P3 > P2 > P1, then status weight, then creation time)
  - Compare with: Current `getTopReadyTaskWithDetails()` in orchestrator.ts line 109
  - Improvement: Add rate limit checking, use new session status fields

### 2.2 Claude CLI Process Spawner
- [ ] **Create direct Claude CLI spawner**
  - File: `apps/server/src/agents/claude-spawner.ts` - NEW FILE
  - Function: `spawnClaudeCodeCLI(task: TaskWithDetails): Promise<string>`
  - Logic:
    - Generate unique session ID
    - Build Claude CLI command with options (learn from claude-cli.js)
    - Set environment variables for hooks
    - Spawn child process with proper stdio handling
    - Send task prompt via stdin
    - Return session ID
  - Reference: `apps/claudecode-ui/server/claude-cli.js` for command building
  - Claude CLI options to use:
    ```javascript
    const claudeArgs = [
      'claude',
      '--model', 'claude-3-5-sonnet-20241022',
      '--add-dir', repository.repoPath,
      ...(task.lastAgentSessionId ? ['-r', task.lastAgentSessionId] : []),
      '--verbose'
    ];
    ```
  - Working options to include (from current orchestrator):
    ```javascript
    resume: !!task.lastAgentSessionId,
    sessionId: task.lastAgentSessionId,
    projectPath: repository.repoPath,
    cwd: repository.repoPath,
    toolsSettings: {
      allowedTools: [
        "Bash(git log:*)", "Bash(git diff:*)", "Bash(git status:*)",
        "Write", "Read", "Edit", "Glob", "Grep", "MultiEdit", "Task",
        "WebSearch", "WebFetch", "TodoRead", "TodoWrite",
        "mcp__solo-unicorn__task_update",
        "mcp__solo-unicorn__agent_rateLimit",
        "mcp__solo-unicorn__project_memory_update",
        "mcp__solo-unicorn__project_memory_get",
        "mcp__solo-unicorn__task_create"
      ],
      disallowedTools: [],
      skipPermissions: true
    }
    ```

### 2.3 Task Pusher with Global Lock
- [ ] **Implement recursive task pusher**
  - File: `apps/server/src/agents/task-pusher.ts` - NEW FILE
  - Global variables:
    - `isTaskPushingInProgress: boolean` - Prevents concurrent execution
    - `pendingTriggers: Set<string>` - Queues trigger reasons
  - Function: `tryPushTasks(reason?: string): Promise<void>`
  - Logic:
    - Check global lock, queue if already running
    - Loop until no more tasks can be assigned
    - For each task: mark as PUSHING atomically, spawn Claude CLI, update with session ID
    - Handle errors by resetting task to INACTIVE
    - Release lock and process queued triggers
  - Import dependencies: task-finder, claude-spawner, session-registry

## Phase 3: Monitoring & Recovery

### 3.1 Task Monitor Functions
- [ ] **Implement task monitoring system**
  - File: `apps/server/src/agents/task-monitor.ts` - NEW FILE
  - Functions (all exported individually, no classes):
    - `checkTasksStuckAtPush()` - Find tasks stuck in PUSHING > 2min, reset to INACTIVE
    - `checkTasksStuckAtActive()` - Find tasks stuck in ACTIVE > 30min, check session files
    - `recoverFromCompletedSessions()` - Cross-reference completed sessions with DB state
    - `clearExpiredRateLimits()` - Clear agent.rateLimitResetAt when expired
    - `runAllMonitorChecks()` - Run all checks in sequence
  - Periodic execution: 5-minute interval
  - Integration: Call tryPushTasks() after any cleanup

### 3.2 Server Startup Recovery
- [ ] **Implement startup recovery process**
  - File: `apps/server/src/agents/startup-recovery.ts` - NEW FILE
  - Function: `performStartupRecovery(): Promise<void>`
  - Logic:
    - Read session files to check current state
    - Find tasks marked as PUSHING/ACTIVE in database
    - Cross-reference with session files to determine actual state
    - Clean up orphaned tasks and sessions
    - Trigger initial task pushing
  - Integration: Call from server startup in index.ts

## Phase 4: HTTP Callback Endpoints

### 4.1 Replace Claude Code UI Callbacks
- [ ] **Remove existing claude-code-ui endpoints**
  - File: `apps/server/src/index.ts` line 282
  - Action: DELETE all /api/claude-code-ui endpoints
  - Reasoning: These were for the old CCU-based approach

- [ ] **Create new agent callback endpoints**
  - File: `apps/server/src/routes/agent-callbacks.ts` - NEW FILE
  - Endpoints needed:
    - `POST /api/agent-callbacks/session-started`
      - Body: `{ sessionId, taskId }`
      - Logic: Update task to ACTIVE status, set lastAgentSessionStartedAt
      - Integration: Call tryPushTasks() to assign more tasks
    - `POST /api/agent-callbacks/session-ended`
      - Body: `{ sessionId, taskId, success }`
      - Logic: Update task to INACTIVE status, clear activeAgentId
      - Integration: Call tryPushTasks() to assign more tasks
    - `POST /api/agent-callbacks/rate-limit-hit`
      - Body: `{ sessionId, taskId, rateLimitResetAt }`
      - Logic: Update task to INACTIVE, set agent.rateLimitResetAt, schedule retry
      - Integration: Use activeAgentId for direct agent update (no joins!)

### 4.2 Update Route Registration
- [ ] **Register new callback routes**
  - File: `apps/server/src/index.ts`
  - Action: Import and register agent-callbacks routes
  - Location: Replace the deleted claude-code-ui routes section

## Phase 5: Integration & Triggers

### 5.1 Task Lifecycle Integration
- [ ] **Update task creation endpoints**
  - File: `apps/server/src/routes/tasks.ts`
  - Changes: Add `tryPushTasks('task_created')` call after task creation
  - Changes: Add `tryPushTasks('task_ready')` call when task marked ready

- [ ] **Update task state change handlers**
  - File: `apps/server/src/routes/tasks.ts`
  - Changes: Add tryPushTasks() calls for any operations that might free capacity
  - Examples: Task deletion, task status changes, task un-assignment

### 5.2 Agent & Repo Management Integration
- [ ] **Update agent management endpoints**
  - File: `apps/server/src/routes/agents.ts`
  - Changes: Add `tryPushTasks('agent_capacity_changed')` when agents are added/modified
  - Changes: Add cleanup of rateLimitResetAt when agents are deleted

- [ ] **Update repository management endpoints**
  - File: `apps/server/src/routes/repositories.ts`
  - Changes: Add `tryPushTasks('repo_capacity_changed')` when repos are added/modified

### 5.3 Server Startup Integration
- [ ] **Integrate with server startup**
  - File: `apps/server/src/index.ts`
  - Changes: Call `performStartupRecovery()` after server initialization
  - Changes: Start task monitor periodic checks
  - Changes: Set up session registry directories

## Phase 6: Utilities & Helpers

### 6.1 Database Query Helpers
- [ ] **Create database utility functions**
  - File: `apps/server/src/agents/db-utils.ts` - NEW FILE
  - Functions:
    - `updateTaskSessionStatus(taskId, status, additionalFields?)` - Update task session fields
    - `getActiveTaskCounts(agentId?, repoId?)` - Count active tasks for capacity checking
    - `findTaskBySessionId(sessionId)` - Find task by session ID
    - `clearTaskActiveAgent(taskId)` - Clear activeAgentId and session fields

### 6.2 Prompt Generation
- [ ] **Update prompt generation for direct CLI**
  - File: `apps/server/src/agents/prompt-generator.ts` - NEW FILE OR UPDATE EXISTING
  - Function: `generatePrompt(mode, { task, actor, project })`
  - Reference: Current prompt generation in orchestrator.ts
  - Changes: Adapt for direct Claude CLI stdin input instead of CCU API

### 6.3 Error Handling & Logging
- [ ] **Create structured logging**
  - File: `apps/server/src/agents/logger.ts` - NEW FILE
  - Purpose: Consistent logging across all agent operations
  - Features: Structured logs with task IDs, session IDs, timestamps
  - Integration: Use in all agent-related operations

## Phase 7: Testing & Validation

### 7.1 Integration Testing Setup
- [ ] **Create test scenarios**
  - File: `apps/server/src/agents/__tests__/integration.test.ts` - NEW FILE
  - Scenarios:
    - Basic task assignment and completion
    - Rate limit handling and recovery
    - Server restart with active sessions
    - Concurrent task pushing
    - Capacity limit enforcement
    - Session orphan cleanup

### 7.2 Development Testing Tools
- [ ] **Create manual testing utilities**
  - File: `apps/server/src/agents/dev-utils.ts` - NEW FILE
  - Functions:
    - `createTestTask()` - Create test task for development
    - `simulateRateLimit(agentId)` - Manually trigger rate limit
    - `forceSessionCleanup()` - Manually clean up sessions
    - `inspectSystemState()` - Show current state of all tasks/agents/sessions

## Phase 8: Documentation & Configuration

### 8.1 Environment Setup Documentation
- [ ] **Update setup instructions**
  - File: `README.md` or `docs/setup.md`
  - Content: How to configure Claude Code hooks
  - Content: Required directory structure
  - Content: Environment variables needed

### 8.2 Configuration Management
- [ ] **Create configuration utilities**
  - File: `apps/server/src/agents/config.ts` - NEW FILE
  - Purpose: Manage agent session configuration
  - Features: Claude CLI options, hook setup, directory management

## Implementation Notes

### File Deletion Strategy
- ✅ **Safe to delete entirely**: `apps/server/src/agents/orchestrator.ts`
- ✅ **Safe to delete**: All `/api/claude-code-ui` endpoints in index.ts
- ✅ **Database reset**: Can drop and recreate all tables if needed

### Code Reuse Opportunities
- **Learn from**: `apps/claudecode-ui/server/claude-cli.js` for Claude CLI command construction
- **Learn from**: Current orchestrator.ts line 393 for Claude CLI options
- **Reuse**: Existing prompt generation logic (adapt for direct CLI)
- **Reuse**: Existing MCP tool configurations and permissions

### Testing Philosophy
- Start with manual testing using dev utilities
- Build integration tests as we validate each component
- No need to maintain backwards compatibility - fresh start approach

### Fresh Start Benefits
- Clean database schema without legacy fields
- Optimized queries from day one
- No migration complexity
- Modern TypeScript patterns throughout
- Simplified error handling and recovery

This plan prioritizes building a robust, clean system over incremental updates, taking advantage of the freedom to start fresh and build the optimal solution.
