# Better Ways to Track Agent & Repo Concurrency

## Original Prompt
> Note, both agent and repo has its own concurrency limit.
>
> At the moment we use orchestrator, a every second background job, to check if there is any free repo and free agent. If yes, we get the top priority ready task, and then feed the task to agent.
>
> However, the current logic is broken because the way we determine the vacancy of repo and agent (by their last task pushed at) is not trust worthy.
>
> Some concerns:
> - I use bun dev server a lot. even for start:prod it is using bun dev.
> - at hot reload it might hot reload and lose memory of state.
> - at hot reload we might miss callbacks. it happened before the API server crashed but Claude Code in child process keeps going. So that when Claude Code calls back, API missed it, then task.agentSessionStatus is out of sync.
> - because the background job is every second. And there is delay between job assigning task and task db record got updated. There is a chance that we creating multiple sessions for the same task.
>
> Currently i am relying on task.lastAgentSessionId and task.agentSessionStatus to keep track of free repo and agent. maybe not the most effective way.

## Current Problems

1. **Unreliable State Tracking**: `lastTaskPushedAt` is not trustworthy during hot reloads
2. **Memory Loss**: Hot reloads lose in-memory state about active sessions
3. **Missed Callbacks**: Session completion callbacks might be lost during restarts
4. **No Session Heartbeat**: No way to detect if Claude Code sessions are actually still alive
5. **Race Conditions**: Multiple orchestrator cycles might assign same task/agent
6. **No Recovery**: No mechanism to recover from orphaned sessions

## Solution Categories

### 1. Database-First State Management

#### 1.1 Session Registry Table
**Concept**: Create a dedicated `agent_sessions` table to track all active sessions.

```sql
CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL,
  repo_id UUID NOT NULL,
  task_id UUID,
  claude_session_id TEXT,
  status TEXT NOT NULL, -- 'starting', 'active', 'completed', 'failed', 'orphaned'
  started_at TIMESTAMP NOT NULL,
  last_heartbeat TIMESTAMP,
  ended_at TIMESTAMP,
  metadata JSONB
);
```

**Pros**:
- Survives hot reloads and server restarts
- Central source of truth for all session state
- Can track session lifecycle precisely
- Easy to query for available agents/repos
- Can implement session recovery logic

**Cons**:
- Requires database migration
- More complex state management
- Need to handle orphaned records cleanup

**Implementation**:
- Create session record when task is assigned
- Update heartbeat via periodic callback from Claude Code UI
- Mark as completed via MCP callback
- Cleanup orphaned sessions older than X minutes

#### 1.2 Enhanced Task State Machine
**Concept**: Use task table with more granular states and session tracking.

```sql
ALTER TABLE tasks ADD COLUMN session_state TEXT; -- 'queued', 'assigned', 'starting', 'active', 'completing', 'completed'
ALTER TABLE tasks ADD COLUMN assigned_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN session_heartbeat TIMESTAMP;
```

**Pros**:
- Minimal schema changes
- Task-centric view aligns with business logic
- Can track task progress more precisely

**Cons**:
- Still need to handle agent/repo availability separately
- Session state mixed with task business state

### 2. External State Store Solutions

#### 2.1 Redis-Based Session Manager
**Concept**: Use Redis for fast, persistent session state management.

```javascript
// Redis keys:
// "agent:{agentId}:active_sessions" -> Set of session IDs
// "repo:{repoId}:active_sessions" -> Set of session IDs
// "session:{sessionId}" -> Hash of session data
// "session_heartbeat:{sessionId}" -> TTL key for health check
```

**Pros**:
- Very fast read/write operations
- Built-in TTL for automatic cleanup
- Atomic operations prevent race conditions
- Can scale beyond single server
- Rich data structures (sets, hashes)

**Cons**:
- External dependency (Redis)
- Need to handle Redis connection failures
- Additional complexity

#### 2.2 SQLite State Database
**Concept**: Separate SQLite database just for session state management.

**Pros**:
- Local file-based, no external dependencies
- ACID transactions prevent race conditions
- Lightweight and fast
- Can persist across restarts

**Cons**:
- Another database to manage
- SQLite limitations for concurrent writes

### 3. Process-Based Solutions

#### 3.1 Claude Code Session Manager Service
**Concept**: Dedicated service that manages all Claude Code sessions.

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Solo Unicorn      │───▶│  Session Manager    │───▶│   Claude Code UI    │
│   Orchestrator      │    │  Service            │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                      │
                                      ▼
                              ┌─────────────────────┐
                              │   Session State DB  │
                              │   (SQLite/Redis)    │
                              └─────────────────────┘
```

**Pros**:
- Single responsibility for session management
- Can implement sophisticated health checking
- Clear separation of concerns
- Could manage multiple coding agents in future

**Cons**:
- Additional service to maintain
- More complex deployment
- Service-to-service communication overhead

#### 3.2 Claude Code Hook-Based Monitoring
**Concept**: Use Claude Code hooks to report session lifecycle events.

```json
{
  "hooks": {
    "SessionStart": [{
      "type": "command",
      "command": "curl -X POST solo-unicorn:8500/hooks/session-start"
    }],
    "Stop": [{
      "type": "command",
      "command": "curl -X POST solo-unicorn:8500/hooks/session-end"
    }]
  }
}
```

**Pros**:
- Leverages Claude Code's built-in hook system
- Real-time session lifecycle events
- Minimal changes to current architecture

**Cons**:
- Depends on Claude Code hook reliability
- Network calls from hooks might fail
- Hook configuration needs to be managed per agent

### 4. Heartbeat & Health Check Solutions

#### 4.1 WebSocket Heartbeat System
**Concept**: Use WebSocket connections for real-time session health monitoring.

**Implementation**:
- Claude Code UI sends periodic heartbeats via WebSocket
- Solo Unicorn tracks last heartbeat per session
- Sessions without heartbeat for >30s marked as stale

**Pros**:
- Real-time detection of dead sessions
- Uses existing WebSocket infrastructure
- Low overhead

**Cons**:
- WebSocket connection reliability issues
- Need to handle connection drops gracefully

#### 4.2 Session Ping API
**Concept**: Periodic HTTP pings from Claude Code UI to report session status.

```javascript
// Claude Code UI sends every 10 seconds:
POST /api/claude-code-ui/session-ping
{
  sessionId: "uuid",
  agentType: "CLAUDE_CODE",
  status: "active",
  taskIds: ["task1", "task2"]
}
```

**Pros**:
- Simple HTTP-based approach
- Can batch multiple session statuses
- Easy to implement and debug

**Cons**:
- Periodic overhead
- Might miss rapid session changes

### 5. Event-Driven Architecture

#### 5.1 Message Queue Based Orchestration
**Concept**: Use message queue (BullMQ/Agenda) for task assignment and completion.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Task Created    │───▶│ Task Queue      │───▶│ Assign Worker   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │ Complete Queue  │◀───│ Session End     │
                       └─────────────────┘    └─────────────────┘
```

**Pros**:
- Reliable job processing with retries
- Natural queuing and priority handling
- Can handle complex workflows
- Built-in failure recovery

**Cons**:
- Significant architecture change
- Queue system dependency
- More complex error handling

#### 5.2 Database Triggers & NOTIFY
**Concept**: Use PostgreSQL triggers and LISTEN/NOTIFY for real-time updates.

```sql
-- Trigger on task state changes
CREATE OR REPLACE FUNCTION notify_task_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('task_updates', json_build_object(
    'task_id', NEW.id,
    'status', NEW.status,
    'action', TG_OP
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Pros**:
- Real-time database-driven events
- No polling overhead
- Uses existing PostgreSQL features

**Cons**:
- Database-specific solution
- Need persistent connections for LISTEN
- Limited to single database instance

### 6. Hybrid Approaches

#### 6.1 Multi-Layer State Management
**Concept**: Combine multiple approaches for redundancy and reliability.

**Layers**:
1. **Fast Layer**: In-memory/Redis for quick availability checks
2. **Persistent Layer**: Database for authoritative state
3. **Recovery Layer**: Periodic reconciliation between layers

**Pros**:
- Best of both worlds (speed + reliability)
- Graceful degradation if one layer fails
- Can optimize for different access patterns

**Cons**:
- Most complex solution
- Potential consistency issues between layers
- Higher maintenance overhead

#### 6.2 Session Lease System
**Concept**: Agents "lease" repos for specific time periods.

```javascript
// Agent requests 30-minute lease on repo
const lease = await leaseRepo(repoId, agentId, 30 * 60 * 1000);

// Must renew lease every 10 minutes or lose it
setInterval(() => renewLease(lease.id), 10 * 60 * 1000);
```

**Pros**:
- Automatic cleanup of stale sessions
- Clear ownership semantics
- Prevents indefinite resource locking

**Cons**:
- Need to handle lease renewal failures
- Complexity in lease time management

## Ranking & Recommendations

### Tier 1: Recommended Solutions

1. **Session Registry Table + Heartbeat API** (Score: 9/10)
   - **Why**: Combines persistence with real-time health checking
   - **Implementation**: Add `agent_sessions` table + periodic ping endpoint
   - **Timeline**: 1-2 days to implement
   - **Risk**: Low - uses existing patterns

2. **Enhanced Task State Machine** (Score: 8/10)
   - **Why**: Minimal changes, aligns with existing data model
   - **Implementation**: Add session tracking fields to tasks table
   - **Timeline**: 1 day to implement
   - **Risk**: Very low - small incremental change

### Tier 2: Strong Candidates

3. **Claude Code Hook-Based Monitoring** (Score: 7/10)
   - **Why**: Leverages Claude Code's native capabilities
   - **Concerns**: Depends on hook reliability
   - **Timeline**: 2-3 days (hook setup + endpoint implementation)

4. **Redis Session Manager** (Score: 7/10)
   - **Why**: Fast, reliable, atomic operations
   - **Concerns**: External dependency
   - **Timeline**: 3-4 days (Redis setup + implementation)

### Tier 3: Future Considerations

5. **Session Manager Service** (Score: 6/10)
   - **Why**: Clean separation, could scale to multiple agent types
   - **Concerns**: Significant architecture change
   - **Timeline**: 1-2 weeks

6. **Message Queue Orchestration** (Score: 6/10)
   - **Why**: Robust job processing
   - **Concerns**: Major architecture overhaul
   - **Timeline**: 2-3 weeks

### Tier 4: Experimental

7. **Database NOTIFY System** (Score: 5/10)
   - **Why**: Interesting PostgreSQL-native approach
   - **Concerns**: Complex connection management
   - **Timeline**: 1 week (experimental)

8. **Multi-Layer State Management** (Score: 4/10)
   - **Why**: Ultimate reliability
   - **Concerns**: Very complex, potential consistency issues
   - **Timeline**: 3-4 weeks

## Quick Win: Immediate Improvements

While designing the long-term solution, these quick fixes could help immediately:

1. **Add Session Timeout**: Mark sessions as stale after 10 minutes of no activity
2. **Orphan Cleanup**: Background job to detect and clean orphaned sessions
3. **Idempotent Assignment**: Check if task is already assigned before creating new session
4. **Better Logging**: Add structured logging for all session lifecycle events
5. **Health Check Endpoint**: Simple endpoint to verify Claude Code UI connectivity

## Implementation Recommendation

**Phase 1 (Quick Fix - 1 day)**:
- Add session timeout and orphan cleanup
- Improve orchestrator logging
- Add idempotent assignment checks

**Phase 2 (Core Solution - 2-3 days)**:
- Implement Session Registry Table approach
- Add heartbeat API endpoint
- Update orchestrator to use session registry

**Phase 3 (Enhancement - 1 week)**:
- Add Claude Code hooks for session lifecycle events
- Implement session lease system for automatic cleanup
- Add monitoring and alerting for session health

This approach balances immediate improvements with a robust long-term solution while minimizing risk and development time.

## User's Preferred Hybrid Approach

After reviewing the options, the user prefers combining:
- **Option 1.2**: Enhanced Task State Machine  
- **Option 3.2**: Claude Code Hook-Based Monitoring

Plus two additional ideas:
1. **Session Status Check**: On server restart, verify if previously ongoing sessions are actually finished
2. **Direct Claude Code CLI**: Remove Claude Code UI dependency and spawn Claude CLI directly as child processes

### Refined Hybrid Solution: File-Based Session Tracking + Enhanced Task States

**Core Concept**: Use Claude Code hooks to maintain a local file-based session registry, combined with enhanced task state management to prevent race conditions.

#### Architecture Overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ Solo Unicorn        │    │ Local File System   │    │ Claude Code CLI     │
│ Orchestrator        │    │ Session Registry    │    │ (Child Process)     │
│                     │    │                     │    │                     │
│ Enhanced Task       │───▶│ completed_sessions  │◀───│ Hook: Stop          │
│ State Machine       │    │ .json               │    │                     │
│                     │    │                     │    │ Hook: SessionStart  │
│ Race Condition      │    │ active_sessions     │───▶│                     │
│ Prevention          │    │ .json               │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

#### Enhanced Task States

```sql
-- Add new fields to tasks table
ALTER TABLE tasks ADD COLUMN agentSessionStatus TEXT DEFAULT 'waiting'; 
-- 'waiting', 'pushing', 'active', 'completed'

ALTER TABLE tasks RENAME COLUMN lastAgentSessionId TO agentSessionId;
ALTER TABLE tasks ADD COLUMN sessionPushedAt TIMESTAMP;
ALTER TABLE tasks ADD COLUMN sessionStartedAt TIMESTAMP;
ALTER TABLE tasks ADD COLUMN sessionCompletedAt TIMESTAMP;
```

**State Transitions**:
1. `waiting` → `pushing`: Orchestrator assigns task to agent
2. `pushing` → `active`: Claude Code session actually started (hook file write)
3. `active` → `completed`: Session fully ended (hook file write)

#### File-Based Session Registry

**Location**: `~/.solo-unicorn/sessions/`

**Files**:
- `active_sessions.json`: Currently running sessions
- `completed_sessions.json`: Recently completed sessions (last 7 days)

**Structure**:
```json
// active_sessions.json
{
  "sessions": {
    "session-uuid-1": {
      "taskId": "task-uuid",
      "agentId": "agent-uuid", 
      "repoId": "repo-uuid",
      "startedAt": "2024-01-01T12:00:00Z",
      "pid": 12345,
      "workingDir": "/home/repos/project"
    }
  },
  "lastUpdated": "2024-01-01T12:05:00Z"
}

// completed_sessions.json  
{
  "sessions": {
    "session-uuid-2": {
      "taskId": "task-uuid",
      "completedAt": "2024-01-01T12:30:00Z",
      "success": true
    }
  }
}
```

#### Claude Code Hook Implementation

**Hook Configuration** (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "SessionStart": [{
      "type": "command",
      "command": "curl -s -X POST http://localhost:8500/api/hooks/session-started -H 'Content-Type: application/json' -d '{\"sessionId\": \"$CLAUDE_SESSION_ID\", \"taskId\": \"$SOLO_UNICORN_TASK_ID\"}'"
    }],
    "Stop": [{
      "type": "command", 
      "command": "curl -s -X POST http://localhost:8500/api/hooks/session-ended -H 'Content-Type: application/json' -d '{\"sessionId\": \"$CLAUDE_SESSION_ID\", \"taskId\": \"$SOLO_UNICORN_TASK_ID\", \"success\": true}'"
    }]
  }
}
```

**Hook Endpoints**:
```javascript
// apps/server/src/routes/hooks.ts
app.post('/api/hooks/session-started', async (c) => {
  const { sessionId, taskId } = await c.req.json();
  
  // Update task state: starting → active
  await updateTaskSessionState(taskId, 'active', { sessionId });
  
  // Add to active sessions file
  await addActiveSession(sessionId, { taskId, startedAt: new Date() });
  
  return c.json({ success: true });
});

app.post('/api/hooks/session-ended', async (c) => {
  const { sessionId, taskId, success } = await c.req.json();
  
  // Update task state: active → completed
  await updateTaskSessionState(taskId, 'completed');
  
  // Move from active to completed sessions
  await moveToCompletedSessions(sessionId, { success });
  
  return c.json({ success: true });
});
```

#### Server Startup Session Recovery

**Recovery Process**:
```javascript
// apps/server/src/agents/session-recovery.ts
async function recoverOrphanedSessions() {
  // 1. Read active sessions file
  const activeSessions = await readActiveSessionsFile();
  
  // 2. Get all tasks marked as active/starting
  const potentiallyActiveTasks = await db.query.tasks.findMany({
    where: inArray(tasks.sessionState, ['starting', 'active'])
  });
  
  // 3. Read completed sessions file 
  const completedSessions = await readCompletedSessionsFile();
  
  // 4. Cross-reference and clean up
  for (const task of potentiallyActiveTasks) {
    const sessionId = task.lastAgentSessionId;
    
    if (completedSessions.sessions[sessionId]) {
      // Session completed while server was down
      await updateTaskSessionState(task.id, 'completed');
      console.log(`✅ Recovered completed task: ${task.id}`);
      
    } else if (!activeSessions.sessions[sessionId]) {
      // Session not in active file, likely crashed
      await updateTaskSessionState(task.id, 'failed');
      console.log(`❌ Marked orphaned task as failed: ${task.id}`);
      
    } else {
      // Check if process is actually running
      const session = activeSessions.sessions[sessionId];
      if (!isProcessRunning(session.pid)) {
        await updateTaskSessionState(task.id, 'failed');
        await removeActiveSession(sessionId);
        console.log(`💀 Process ${session.pid} dead, marked task failed: ${task.id}`);
      }
    }
  }
}
```

#### Race Condition Prevention

**Orchestrator Logic**:
```javascript
// apps/server/src/agents/orchestrator.ts
async function assignTaskToAgent() {
  // 1. Find available repo and agent
  const availableCapacity = await getAvailableCapacity();
  if (!availableCapacity) return;
  
  // 2. Get highest priority ready task
  const task = await db.query.tasks.findFirst({
    where: and(
      eq(tasks.sessionState, 'ready'),
      eq(tasks.isReady, true)
    ),
    orderBy: [desc(tasks.priority), asc(tasks.createdAt)]
  });
  
  if (!task) return;
  
  // 3. ATOMIC: Mark task as pushing (prevents double assignment)
  const updated = await db.update(tasks)
    .set({ 
      sessionState: 'pushing',
      sessionPushedAt: new Date(),
      assignedAgentId: availableCapacity.agentId,
      assignedRepoId: availableCapacity.repoId
    })
    .where(and(
      eq(tasks.id, task.id),
      eq(tasks.sessionState, 'ready') // Only update if still ready
    ));
    
  if (updated.rowCount === 0) {
    // Another orchestrator cycle got this task
    console.log('Task already assigned by another cycle');
    return;
  }
  
  // 4. Spawn Claude CLI process
  try {
    const sessionId = await spawnClaudeCodeCLI(task, availableCapacity);
    
    // 5. Update to starting state
    await db.update(tasks)
      .set({ 
        sessionState: 'starting',
        lastAgentSessionId: sessionId 
      })
      .where(eq(tasks.id, task.id));
      
  } catch (error) {
    // 6. Failed to spawn, reset to ready
    await db.update(tasks)
      .set({ sessionState: 'ready' })
      .where(eq(tasks.id, task.id));
  }
}
```

#### Capacity Calculation

```javascript
async function getAvailableCapacity() {
  // Count tasks by state per agent/repo
  const activeTaskCounts = await db
    .select({
      agentId: tasks.assignedAgentId,
      repoId: tasks.assignedRepoId,
      count: sql`count(*)`
    })
    .from(tasks)
    .where(inArray(tasks.sessionState, ['pushing', 'starting', 'active']))
    .groupBy(tasks.assignedAgentId, tasks.assignedRepoId);
  
  // Find agents and repos under their concurrency limits
  const availableAgents = await findAgentsUnderLimit(activeTaskCounts);
  const availableRepos = await findReposUnderLimit(activeTaskCounts);
  
  // Return first available combination
  return findCompatiblePair(availableAgents, availableRepos);
}
```

#### Direct Claude CLI Spawning

**Remove Claude Code UI dependency**:
```javascript
// apps/server/src/agents/claude-spawner.ts
async function spawnClaudeCodeCLI(task, { agent, repo, actor }) {
  const sessionId = generateUUID();
  
  // Build Claude CLI command
  const claudeArgs = [
    'claude',
    '--model', 'claude-3-5-sonnet-20241022',
    '--add-dir', repo.repoPath,
    ...(task.lastAgentSessionId ? ['-r', task.lastAgentSessionId] : []),
    '--verbose'
  ];
  
  // Set environment variables for hooks
  const env = {
    ...process.env,
    CLAUDE_CONFIG_DIR: agent.agentSettings.CLAUDE_CONFIG_DIR || '~/.claude',
    SOLO_UNICORN_TASK_ID: task.id,
    CLAUDE_SESSION_ID: sessionId
  };
  
  // Spawn process
  const child = spawn(claudeArgs[0], claudeArgs.slice(1), {
    env,
    cwd: repo.repoPath,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Send task prompt
  const prompt = generatePrompt(task.stage, { task, actor, project });
  child.stdin.write(prompt);
  child.stdin.end();
  
  // Add to active sessions file
  await addActiveSession(sessionId, {
    taskId: task.id,
    agentId: agent.id,
    repoId: repo.id,
    pid: child.pid,
    startedAt: new Date()
  });
  
  return sessionId;
}
```

### Advantages of This Hybrid Approach

1. **Survives Server Restarts**: File-based session registry persists across hot reloads
2. **Race Condition Prevention**: Atomic task state updates prevent double assignment  
3. **Reliable Recovery**: Cross-reference completed sessions file with active tasks
4. **Process Health Checking**: Can verify if Claude CLI processes are actually running
5. **No External Dependencies**: Uses local files instead of Redis/external services
6. **Real-time Updates**: Hook-based callbacks provide immediate session lifecycle events
7. **Simple Architecture**: Removes Claude Code UI dependency, direct CLI control

### Implementation Timeline

**Week 1: Core Infrastructure**
- Add enhanced task state fields
- Implement file-based session registry
- Create session recovery logic

**Week 2: Claude Integration** 
- Set up Claude Code hooks
- Implement direct CLI spawning
- Add hook endpoint handlers

**Week 3: Orchestrator Enhancement**
- Update orchestrator with atomic state management
- Implement proper capacity calculation
- Add process health checking

**Week 4: Testing & Refinement**
- Test hot reload scenarios
- Validate session recovery
- Performance optimization

This approach addresses all the original concerns while providing a robust, dependency-free solution for session management.

## Critical Implementation Details & Edge Cases

### Hook Environment Variable Issue

**Problem**: Claude Code hooks don't have access to `$SOLO_UNICORN_TASK_ID` environment variable.

**Claude Code Hook Input**:
```json
// SessionStart
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "hook_event_name": "SessionStart",
  "source": "startup"
}

// Stop  
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "hook_event_name": "Stop",
  "stop_hook_active": true
}
```

**Solution**: Remove task ID dependency from hooks. Use session ID lookup instead.

**Revised Hook Configuration**:
```json
{
  "hooks": {
    "SessionStart": [{
      "type": "command",
      "command": "echo \"{\\\"event\\\": \\\"session_started\\\", \\\"sessionId\\\": \\\"$session_id\\\", \\\"timestamp\\\": \\\"$(date -Iseconds)\\\"}\" >> ~/.solo-unicorn/sessions/session_events.jsonl"
    }],
    "Stop": [{
      "type": "command", 
      "command": "echo \"{\\\"event\\\": \\\"session_ended\\\", \\\"sessionId\\\": \\\"$session_id\\\", \\\"timestamp\\\": \\\"$(date -Iseconds)\\\"}\" >> ~/.solo-unicorn/sessions/session_events.jsonl"
    }]
  }
}
```

**Session Event Processing**:
```javascript
// apps/server/src/agents/session-events.ts
import { watch } from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

// Watch for new session events
function watchSessionEvents() {
  const eventFile = '~/.solo-unicorn/sessions/session_events.jsonl';
  
  let lastPosition = 0;
  
  watch(eventFile, async (eventType) => {
    if (eventType === 'change') {
      await processNewSessionEvents(eventFile, lastPosition);
    }
  });
}

async function processNewSessionEvents(filePath: string, fromPosition: number) {
  const stream = createReadStream(filePath, { start: fromPosition });
  const reader = createInterface({ input: stream });
  
  for await (const line of reader) {
    try {
      const event = JSON.parse(line);
      await handleSessionEvent(event);
    } catch (error) {
      console.error('Invalid session event JSON:', line);
    }
  }
}

async function handleSessionEvent(event: { event: string, sessionId: string, timestamp: string }) {
  const { event: eventType, sessionId } = event;
  
  // Find task by agentSessionId
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.agentSessionId, sessionId)
  });
  
  if (!task) return;
  
  if (eventType === 'session_started') {
    await updateTaskSessionStatus(task.id, 'active');
    await addActiveSession(sessionId, { taskId: task.id, startedAt: new Date() });
  } else if (eventType === 'session_ended') {
    await updateTaskSessionStatus(task.id, 'completed');
    await moveToCompletedSessions(sessionId, { taskId: task.id });
  }
}
```

### Resume Session Edge Case

**Edge Case**: 
1. Session 123 completes and gets added to `completed_sessions.json`
2. Task gets re-fed to resume session 123 (new work on same task)
3. API server reboots while session 123 is active
4. Session recovery sees session 123 in completed list and incorrectly marks task as completed

**Resolution**: Track session lifecycle more precisely in both files.

**Enhanced File Structure**:
```json
// active_sessions.json
{
  "sessions": {
    "session-123": {
      "taskId": "task-uuid",
      "resumeCount": 2,  // How many times this session was resumed
      "currentlyActive": true,
      "lastResumedAt": "2024-01-01T12:30:00Z"
    }
  }
}

// completed_sessions.json  
{
  "sessions": {
    "session-123": [
      {
        "taskId": "task-uuid", 
        "completedAt": "2024-01-01T12:00:00Z",
        "resumeCount": 1,
        "wasResumed": true
      },
      {
        "taskId": "task-uuid",
        "completedAt": "2024-01-01T12:45:00Z", 
        "resumeCount": 2,
        "wasResumed": false
      }
    ]
  }
}
```

**Updated Hook Logic**:
```javascript
async function moveToCompletedSessions(sessionId, { taskId }) {
  // Remove from active
  const activeSessions = await readActiveSessionsFile();
  const sessionData = activeSessions.sessions[sessionId];
  delete activeSessions.sessions[sessionId];
  await writeActiveSessionsFile(activeSessions);
  
  // Add to completed with resume count
  const completedSessions = await readCompletedSessionsFile();
  if (!completedSessions.sessions[sessionId]) {
    completedSessions.sessions[sessionId] = [];
  }
  
  completedSessions.sessions[sessionId].push({
    taskId,
    completedAt: new Date().toISOString(),
    resumeCount: sessionData?.resumeCount || 1,
    wasResumed: false // This completion is final for this resume cycle
  });
  
  await writeCompletedSessionsFile(completedSessions);
}

async function addActiveSession(sessionId, data) {
  const activeSessions = await readActiveSessionsFile();
  const existingResumeCount = getLatestResumeCount(sessionId); // Check completed sessions
  
  activeSessions.sessions[sessionId] = {
    ...data,
    resumeCount: existingResumeCount + 1,
    currentlyActive: true,
    lastResumedAt: new Date().toISOString()
  };
  
  await writeActiveSessionsFile(activeSessions);
}
```

**Updated Recovery Logic**:
```javascript
async function recoverOrphanedSessions() {
  const activeSessions = await readActiveSessionsFile();
  const completedSessions = await readCompletedSessionsFile();
  
  const potentiallyActiveTasks = await db.query.tasks.findMany({
    where: inArray(tasks.sessionState, ['starting', 'active'])
  });
  
  for (const task of potentiallyActiveTasks) {
    const sessionId = task.lastAgentSessionId;
    
    // Check if currently marked as active
    if (activeSessions.sessions[sessionId]?.currentlyActive) {
      // Verify process is actually running
      const session = activeSessions.sessions[sessionId];
      if (!isProcessRunning(session.pid)) {
        await updateTaskSessionState(task.id, 'failed');
        await removeActiveSession(sessionId);
      }
      // Otherwise, session is legitimately active
      
    } else {
      // Check latest completion status
      const latestCompletion = getLatestCompletion(sessionId, completedSessions);
      if (latestCompletion && !latestCompletion.wasResumed) {
        // Session genuinely completed
        await updateTaskSessionState(task.id, 'completed');
      } else {
        // Session crashed or orphaned
        await updateTaskSessionState(task.id, 'failed');
      }
    }
  }
}
```

## Efficient Task Selection Query Options

### Current Implementation Analysis

The existing `getTopReadyTaskWithDetails()` at line 109 does well to avoid N+1 queries by joining all necessary tables. However, with our new session state approach, we need to modify the selection criteria.

### Option 1: Single Query with Subqueries (Truly Single Query)

**Concept**: Embed capacity checks directly in the WHERE clause to avoid separate queries.

```javascript
async function getTopReadyTaskWithCapacityCheck(): Promise<TaskWithDetails | null> {
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
        eq(schema.tasks.agentSessionStatus, 'waiting'), // New field name
        ne(schema.tasks.status, 'done'),
        // Agent capacity check (embedded subquery)
        sql`(
          SELECT COUNT(*) FROM ${schema.tasks} t2 
          WHERE t2.assigned_agent_id = ${schema.tasks.assignedAgentId}
          AND t2.agent_session_status IN ('pushing', 'active')
        ) < ${schema.agents.concurrencyLimit}`,
        // Repo capacity check (embedded subquery)
        sql`(
          SELECT COUNT(*) FROM ${schema.tasks} t3
          WHERE t3.main_repository_id = ${schema.tasks.mainRepositoryId}
          AND t3.agent_session_status IN ('pushing', 'active') 
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
      asc(sql`CAST(${schema.tasks.columnOrder} AS DECIMAL)`),
      asc(schema.tasks.createdAt)
    )
    .limit(1);
    
  return readyTasks[0] || null;
}
```

**Pros**: 
- Truly single database query
- No N+1 problems
- Database optimizes subqueries with indexes
- Maintains existing priority logic

**Cons**:
- More complex WHERE clause
- Subqueries repeated for each row (but database should optimize)

### Option 1B: Pre-calculate Capacity (Two Queries but Optimized)

**Concept**: Get available capacity first, then filter tasks efficiently.

```javascript
async function getTopReadyTaskWithPreCalculatedCapacity(): Promise<TaskWithDetails | null> {
  // Query 1: Get all agent/repo pairs with available capacity
  const availableCapacity = await db
    .select({
      agentId: schema.agents.id,
      repoId: schema.repositories.id,
      agentSlots: sql<number>`${schema.agents.concurrencyLimit} - COALESCE(agent_usage.active_count, 0)`.as('agentSlots'),
      repoSlots: sql<number>`${schema.repositories.concurrencyLimit} - COALESCE(repo_usage.active_count, 0)`.as('repoSlots')
    })
    .from(schema.agents)
    .crossJoin(schema.repositories)
    .leftJoin(
      db.select({
        assignedAgentId: schema.tasks.assignedAgentId,
        activeCount: sql<number>`count(*)`.as('active_count')
      }).from(schema.tasks)
       .where(inArray(schema.tasks.agentSessionStatus, ['pushing', 'active']))
       .groupBy(schema.tasks.assignedAgentId)
       .as('agent_usage'),
      eq(schema.agents.id, sql`agent_usage.assigned_agent_id`)
    )
    .leftJoin(
      db.select({
        mainRepositoryId: schema.tasks.mainRepositoryId,
        activeCount: sql<number>`count(*)`.as('active_count')
      }).from(schema.tasks)
       .where(inArray(schema.tasks.agentSessionStatus, ['pushing', 'active']))
       .groupBy(schema.tasks.mainRepositoryId)
       .as('repo_usage'),
      eq(schema.repositories.id, sql`repo_usage.main_repository_id`)
    )
    .where(
      and(
        sql`agent_slots > 0`,
        sql`repo_slots > 0`
      )
    );
    
  if (availableCapacity.length === 0) return null;
  
  // Query 2: Get highest priority task that can use available capacity
  return await db
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
        eq(schema.tasks.agentSessionStatus, 'waiting'),
        ne(schema.tasks.status, 'done'),
        // Use pre-calculated capacity
        or(...availableCapacity.map(cap => 
          and(
            eq(schema.tasks.assignedAgentId, cap.agentId),
            eq(schema.tasks.mainRepositoryId, cap.repoId)
          )
        )),
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
      asc(sql`CAST(${schema.tasks.columnOrder} AS DECIMAL)`),
      asc(schema.tasks.createdAt)
    )
    .limit(1)
    .then(results => results[0] || null);
}
```

**Pros**:
- Clear separation of capacity calculation vs task selection
- Complex capacity logic isolated in first query
- Second query optimized for task selection
- Easy to debug and understand

**Cons**: 
- Two database queries instead of one
- OR clause with many conditions in second query

### Option 2: Two-Phase Query

**Concept**: First get available capacity, then query for tasks.

```javascript
async function getTopReadyTaskTwoPhase(): Promise<TaskWithDetails | null> {
  // Phase 1: Get capacity in single query
  const capacity = await db
    .select({
      agentId: schema.agents.id,
      repoId: schema.repositories.id,
      agentLimit: schema.agents.concurrencyLimit,
      repoLimit: schema.repositories.concurrencyLimit,
      activeTasks: sql<number>`(
        SELECT COUNT(*) FROM ${schema.tasks} 
        WHERE ${schema.tasks.assignedAgentId} = ${schema.agents.id}
        AND ${schema.tasks.sessionState} IN ('pushing', 'starting', 'active')
      )`.as('activeTasks'),
      activeRepoTasks: sql<number>`(
        SELECT COUNT(*) FROM ${schema.tasks}
        WHERE ${schema.tasks.mainRepositoryId} = ${schema.repositories.id} 
        AND ${schema.tasks.sessionState} IN ('pushing', 'starting', 'active')
      )`.as('activeRepoTasks')
    })
    .from(schema.agents)
    .crossJoin(schema.repositories)
    .having(
      and(
        sql`activeTasks < ${schema.agents.concurrencyLimit}`,
        sql`activeRepoTasks < ${schema.repositories.concurrencyLimit}`
      )
    )
    .limit(1);
    
  if (capacity.length === 0) return null;
  
  // Phase 2: Get task for this capacity
  return await getTaskForCapacity(capacity[0]);
}
```

**Pros**:
- Clear separation of capacity vs task logic
- Easy to understand and debug
- Flexible for different capacity strategies

**Cons**: 
- Two database queries
- Potentially less efficient

### Option 3: Materialized View Approach

**Concept**: Pre-calculate capacity availability in a materialized view.

```sql
CREATE MATERIALIZED VIEW available_capacity AS
SELECT 
  a.id as agent_id,
  r.id as repo_id,
  (a.concurrency_limit - COALESCE(active_agent.count, 0)) as agent_slots,
  (r.concurrency_limit - COALESCE(active_repo.count, 0)) as repo_slots
FROM agents a
CROSS JOIN repositories r  
LEFT JOIN (
  SELECT assigned_agent_id, COUNT(*) as count
  FROM tasks 
  WHERE session_state IN ('pushing', 'starting', 'active')
  GROUP BY assigned_agent_id
) active_agent ON a.id = active_agent.assigned_agent_id
LEFT JOIN (
  SELECT main_repository_id, COUNT(*) as count  
  FROM tasks
  WHERE session_state IN ('pushing', 'starting', 'active')
  GROUP BY main_repository_id
) active_repo ON r.id = active_repo.main_repository_id
WHERE agent_slots > 0 AND repo_slots > 0;
```

**Pros**:
- Very fast queries
- Pre-computed capacity
- Scales well

**Cons**:
- Need to refresh materialized view
- Additional complexity
- May have stale data

### Option 4: Indexed Subquery

**Concept**: Use correlated subqueries with proper indexing.

```javascript
async function getTopReadyTaskWithSubqueries(): Promise<TaskWithDetails | null> {
  return await db
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
        eq(schema.tasks.sessionState, 'ready'),
        ne(schema.tasks.status, 'done'),
        // Agent capacity check
        sql`(
          SELECT COUNT(*) FROM ${schema.tasks} t2 
          WHERE t2.assigned_agent_id = ${schema.tasks.assignedAgentId}
          AND t2.session_state IN ('pushing', 'starting', 'active')
        ) < ${schema.agents.concurrencyLimit}`,
        // Repo capacity check  
        sql`(
          SELECT COUNT(*) FROM ${schema.tasks} t3
          WHERE t3.main_repository_id = ${schema.tasks.mainRepositoryId}
          AND t3.session_state IN ('pushing', 'starting', 'active') 
        ) < ${schema.repositories.concurrencyLimit}`
      )
    )
    .orderBy(
      desc(schema.tasks.priority),
      asc(schema.tasks.createdAt)
    )
    .limit(1);
}
```

**Pros**:
- Single query
- Clear capacity logic
- Uses database indexes effectively

**Cons**:
- Complex subqueries
- May be slower than pre-computed approaches

## Ranking: Task Selection Efficiency

1. **Option 1: Single Query with Subqueries** (Score: 9/10)
   - Truly single database query
   - PostgreSQL optimizes subqueries well with proper indexes
   - No N+1 problems
   - Straightforward logic

2. **Option 1B: Pre-calculate Capacity** (Score: 8/10)  
   - Clear separation of capacity vs task logic
   - Two optimized queries
   - Easy to debug and understand
   - Good balance of performance and clarity

3. **Option 2: Two-Phase Query** (Score: 7/10)
   - Original approach, well-tested pattern
   - Clear separation of concerns
   - Acceptable performance for most use cases

4. **Option 3: Materialized View** (Score: 6/10)
   - Excellent query performance
   - Additional complexity in maintenance
   - Potential data freshness issues

## Reactive vs Scheduled Orchestration

### Current: Scheduled Every Second

**Problems**:
- Unnecessary CPU usage when no work available
- Fixed 1-second delay regardless of priority
- Polling overhead

### Application-Level Reactive Orchestration Options

#### Option A: EventEmitter-Based Orchestration

**Concept**: Use Node.js EventEmitter throughout the application to trigger orchestration.

**Implementation**:
```javascript
// apps/server/src/agents/orchestration-events.ts
import { EventEmitter } from 'events';

class OrchestrationEventBus extends EventEmitter {
  private debounceMap = new Map<string, NodeJS.Timeout>();
  
  triggerOrchestration(reason: string, debounceMs = 100) {
    // Debounce rapid events
    const existingTimeout = this.debounceMap.get(reason);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    const timeout = setTimeout(async () => {
      console.log(`🎯 Orchestration triggered: ${reason}`);
      await tryAssignTasks();
      this.debounceMap.delete(reason);
    }, debounceMs);
    
    this.debounceMap.set(reason, timeout);
  }
}

export const orchestrationBus = new OrchestrationEventBus();

// Usage throughout application:
// apps/server/src/routes/tasks.ts
app.post('/tasks', async (c) => {
  const task = await createTask(data);
  orchestrationBus.triggerOrchestration('task_created');
  return c.json(task);
});

app.patch('/tasks/:id/ready', async (c) => {
  await markTaskReady(id);
  orchestrationBus.triggerOrchestration('task_ready');
  return c.json({ success: true });
});

// apps/server/src/agents/session-events.ts
async function handleSessionEvent(event) {
  if (event.event === 'session_ended') {
    await updateTaskSessionStatus(task.id, 'completed');
    orchestrationBus.triggerOrchestration('session_ended');
  }
}
```

**Pros**:
- Simple Node.js native approach
- No external dependencies
- Built-in debouncing prevents event storms
- Easy to add triggers anywhere in codebase

**Cons**:
- In-memory only (lost on restart)
- Need to manually add triggers to all relevant code paths
- No persistence across hot reloads

#### Option B: Observable Pattern with RxJS

**Concept**: Use reactive streams to manage orchestration events.

**Implementation**:
```javascript
// apps/server/src/agents/orchestration-streams.ts
import { Subject, debounceTime, distinctUntilChanged, merge } from 'rxjs';

const taskEvents$ = new Subject<{ type: string, taskId: string }>();
const sessionEvents$ = new Subject<{ type: string, sessionId: string }>();
const systemEvents$ = new Subject<{ type: string, data?: any }>();

// Merge all streams and debounce
const orchestrationTrigger$ = merge(
  taskEvents$.pipe(map(() => 'task_change')),
  sessionEvents$.pipe(map(() => 'session_change')), 
  systemEvents$.pipe(map(() => 'system_change'))
).pipe(
  debounceTime(100),
  distinctUntilChanged()
);

// Subscribe to orchestration triggers
orchestrationTrigger$.subscribe(async (reason) => {
  console.log(`🎯 Orchestration triggered: ${reason}`);
  await tryAssignTasks();
});

// Helper functions to emit events
export function emitTaskEvent(type: string, taskId: string) {
  taskEvents$.next({ type, taskId });
}

export function emitSessionEvent(type: string, sessionId: string) {
  sessionEvents$.next({ type, sessionId });
}

export function emitSystemEvent(type: string, data?: any) {
  systemEvents$.next({ type, data });
}
```

**Pros**:
- Powerful reactive programming features
- Built-in operators for debouncing, filtering, combining
- Type-safe event streams
- Composable event handling

**Cons**:
- Additional dependency (RxJS)
- Learning curve for reactive programming
- Overkill for simple use case

#### Option C: Custom Event Queue with Persistence

**Concept**: Build a simple persistent event queue using database or files.

**Implementation**:
```javascript
// apps/server/src/agents/persistent-events.ts
interface OrchestrationEvent {
  id: string;
  type: string;
  reason: string;
  timestamp: number;
  processed: boolean;
}

class PersistentEventQueue {
  private queueFile = '~/.solo-unicorn/orchestration_queue.jsonl';
  private processing = false;
  
  async enqueue(type: string, reason: string) {
    const event: OrchestrationEvent = {
      id: generateUUID(),
      type,
      reason,
      timestamp: Date.now(),
      processed: false
    };
    
    // Append to file
    await appendFile(this.queueFile, JSON.stringify(event) + '\n');
    
    // Trigger processing (debounced)
    this.scheduleProcessing();
  }
  
  private scheduleProcessing() {
    if (this.processing) return;
    
    setTimeout(async () => {
      await this.processQueue();
    }, 100);
  }
  
  private async processQueue() {
    this.processing = true;
    
    try {
      const events = await this.readUnprocessedEvents();
      
      if (events.length > 0) {
        console.log(`🎯 Processing ${events.length} orchestration events`);
        await tryAssignTasks();
        await this.markEventsProcessed(events.map(e => e.id));
      }
      
    } finally {
      this.processing = false;
    }
  }
  
  async recoverFromFile() {
    // On startup, process any unprocessed events
    const unprocessed = await this.readUnprocessedEvents();
    if (unprocessed.length > 0) {
      console.log(`📬 Recovered ${unprocessed.length} unprocessed orchestration events`);
      await this.processQueue();
    }
  }
}

export const persistentQueue = new PersistentEventQueue();

// Usage:
await persistentQueue.enqueue('task_ready', `Task ${taskId} marked ready`);
await persistentQueue.enqueue('session_ended', `Session ${sessionId} completed`);
```

**Pros**:
- Survives server restarts and hot reloads
- Simple file-based persistence
- Built-in event deduplication
- Can replay missed events

**Cons**:
- File I/O overhead
- Need to manage file cleanup
- More complex than in-memory approaches

#### Option D: Database-Based Event Store

**Concept**: Use database table to store orchestration events.

**Implementation**:
```sql
CREATE TABLE orchestration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP NULL
);

CREATE INDEX idx_orchestration_events_unprocessed ON orchestration_events (created_at) WHERE processed_at IS NULL;
```

```javascript
// apps/server/src/agents/db-orchestration.ts
class DatabaseOrchestrationQueue {
  async enqueue(eventType: string, reason: string, metadata?: any) {
    await db.insert(orchestrationEvents).values({
      eventType,
      reason,
      metadata,
    });
    
    // Trigger processing (debounced)
    this.scheduleProcessing();
  }
  
  private async processUnprocessedEvents() {
    const unprocessedEvents = await db
      .select()
      .from(orchestrationEvents)
      .where(isNull(orchestrationEvents.processedAt))
      .orderBy(asc(orchestrationEvents.createdAt));
      
    if (unprocessedEvents.length > 0) {
      console.log(`🎯 Processing ${unprocessedEvents.length} orchestration events`);
      await tryAssignTasks();
      
      // Mark all as processed
      await db
        .update(orchestrationEvents)
        .set({ processedAt: new Date() })
        .where(
          inArray(orchestrationEvents.id, unprocessedEvents.map(e => e.id))
        );
    }
  }
  
  async cleanupOldEvents(olderThanDays = 7) {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    await db
      .delete(orchestrationEvents)
      .where(
        and(
          isNotNull(orchestrationEvents.processedAt),
          lt(orchestrationEvents.createdAt, cutoff)
        )
      );
  }
}
```

**Pros**:
- Leverages existing database infrastructure
- ACID properties for event processing
- Easy querying and analytics
- Built-in timestamps and metadata

**Cons**:
- Database overhead for simple events
- Need periodic cleanup
- More complex than file-based approach

## Ranking: Application-Level Reactive Orchestration

1. **Option A: EventEmitter-Based** (Score: 9/10)
   - Native Node.js, no dependencies
   - Simple and straightforward
   - Built-in debouncing prevents storms
   - Easy to implement and debug

2. **Option C: Persistent Event Queue** (Score: 8/10)
   - Survives restarts and hot reloads
   - File-based simplicity
   - Good for your dev workflow with frequent restarts
   - Lightweight persistence

3. **Option D: Database Event Store** (Score: 7/10)
   - Leverages existing infrastructure
   - ACID properties
   - Good for analytics and debugging
   - More overhead than needed

4. **Option B: RxJS Observable** (Score: 6/10)
   - Powerful reactive features
   - Type-safe streams
   - Overkill for this use case
   - Additional learning curve

#### Option B: Hybrid Approach

**Concept**: Reactive for most events, minimal scheduled backup.

```javascript
// Immediate triggers
await tryAssignTasks(); // On task ready, session end, etc.

// Backup scheduled job every 30 seconds (instead of 1 second)
setInterval(async () => {
  await tryAssignTasks(); // Catch any missed events
  await cleanupStaleSessions(); // Periodic maintenance
}, 30000);
```

**Pros**:
- Best of both worlds
- Resilient to missed events  
- Much less polling overhead

**Cons**:
- Still some scheduled overhead
- Slightly more complex

#### Option C: Pure Reactive with Heartbeat

**Concept**: No scheduled jobs, rely entirely on events plus session heartbeats.

**Implementation**:
- Task/agent/repo changes trigger orchestration
- Session heartbeats detect stale sessions
- Manual recovery endpoints for emergency

**Pros**:
- Zero polling overhead
- Most efficient resource usage
- Truly event-driven

**Cons**:
- Relies heavily on event reliability
- Need manual recovery mechanisms
- More complex debugging

## Final Recommendations

### Immediate Implementation (Week 1)

**Task State Management**:
- Use `agentSessionStatus: waiting > pushing > active > completed`
- Rename `lastAgentSessionId` to `agentSessionId`
- Add timestamp fields for session lifecycle tracking

**Claude Hook Implementation**:
- Write session events directly to `~/.solo-unicorn/sessions/session_events.jsonl`
- Use file watching to process events without API dependency
- No HTTP calls from hooks - pure file-based approach

**Task Selection Query**:
- Implement "Option 1: Single Query with Subqueries" for truly single query
- Embed capacity checks in WHERE clause subqueries
- Use `agentSessionStatus IN ('pushing', 'active')` for capacity counting

### Progressive Enhancement (Week 2-3)

**Reactive Orchestration**:
- Start with "Option A: EventEmitter-Based" for simplicity
- Add triggers for task ready, session ended, system startup
- Built-in debouncing to prevent orchestration storms

**Session Recovery**:
- Enhanced file structure with resume count tracking
- Process health checking via PID verification
- Startup recovery cross-referencing active vs completed sessions

### Long-term Optimization (Week 4+)

**Persistence Upgrade**:
- Consider "Option C: Persistent Event Queue" if hot reload issues persist
- Keeps orchestration events across server restarts
- Perfect for your bun dev workflow

**Query Optimization**:
- Monitor single query performance
- Fall back to "Option 1B: Pre-calculate Capacity" if subqueries become slow
- Add database indexes on session status fields

## Architecture Summary

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ Application Events  │    │ File System         │    │ Claude Code CLI     │
│ (EventEmitter)      │    │ Session Registry    │    │ (Direct Spawn)      │
│                     │    │                     │    │                     │
│ task_ready         │───▶│ session_events.jsonl│◀───│ Hook: echo >> file  │
│ session_ended       │    │ active_sessions.json│    │                     │
│ system_startup      │    │ completed_sessions  │    │                     │
│                     │    │ .json               │    │                     │
│ Debounced          │    │                     │    │                     │
│ tryAssignTasks()    │    │ File Watcher        │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

This approach provides:
- ✅ No API dependencies for hooks (file-based)
- ✅ Single optimized query for task selection  
- ✅ Reactive orchestration without polling
- ✅ Survives hot reloads via file persistence
- ✅ Direct Claude CLI control
- ✅ Race condition prevention via atomic updates
