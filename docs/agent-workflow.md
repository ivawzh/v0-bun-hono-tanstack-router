# Agent Workflow Documentation

## Overview

Solo Unicorn uses an improved agent orchestration system that implements push-based task assignment with clear MCP workflow instructions. This document describes how agents should interact with the system.

## Agent Workflow

### 1. Agent Availability

Agents signal their availability using the MCP protocol:

```javascript
// When agent becomes available (e.g., on startup or after completing work)
await callMCP("agent.setAvailable", {});
```

This:
- Marks the agent as `idle` in the database
- Clears any stale active sessions
- Triggers the orchestrator to check for available tasks
- Potentially results in immediate task assignment

### 2. Task Assignment (Push-based)

The system automatically pushes tasks to available agents:

1. **Orchestrator monitors** for idle agents with recent heartbeats
2. **Tasks are prioritized** by priority (P5 → P1) then creation date
3. **Tasks are assigned** to agents by matching `repoAgentId`
4. **Claude session starts** with comprehensive MCP workflow instructions

### 3. Task Execution Workflow

#### Stage 1: Start Task
Every agent **MUST** start by registering work on the task:

```javascript
// FIRST ACTION - Register task start
const result = await callMCP("task.start", {
  taskId: "uuid-of-task",
  stage: "refine" // or "kickoff" or "execute"
});
```

This updates the task status and creates/updates the session.

#### Stage 2: Perform Work

**Refine Stage:**
- Understand and clarify task requirements
- Update task with refined title/description:
```javascript
await callMCP("cards.update", {
  taskId: "uuid-of-task", 
  updates: {
    refinedTitle: "Clear, specific title",
    refinedDescription: "Detailed requirements"
  }
});
```

**Kickoff Stage:**
- Analyze solution options
- Create implementation plan:
```javascript
await callMCP("cards.update", {
  taskId: "uuid-of-task",
  updates: {
    plan: {
      approach: "Selected solution approach",
      steps: ["Step 1", "Step 2", "Step 3"],
      considerations: ["Important notes"]
    }
  }
});
```

**Execute Stage:**
- Implement the solution
- Make code changes, run tests
- Update project memory if needed:
```javascript
await callMCP("memory.update", {
  projectId: "uuid-of-project",
  memory: "Updated project context and learnings"
});
```

#### Stage 3: Complete Stage

**FINAL ACTION** - Signal stage completion:

```javascript
// Option 1: Advance to next stage
await callMCP("task.complete", {
  taskId: "uuid-of-task",
  stageComplete: true,
  nextStage: "kickoff" // or "execute"
});

// Option 2: Mark task as completely done
await callMCP("task.complete", {
  taskId: "uuid-of-task", 
  markDone: true
});

// Option 3: Just complete current stage
await callMCP("task.complete", {
  taskId: "uuid-of-task",
  stageComplete: true
});
```

#### Stage 4: Signal Availability

After completing work, signal availability for new tasks:

```javascript
await callMCP("agent.setAvailable", {});
```

## MCP Tools Reference

### Task Management

- **`task.start`** - Register start of work on a task
  - `taskId`: UUID of the task
  - `stage`: "refine" | "kickoff" | "execute"

- **`task.complete`** - Complete current stage or entire task
  - `taskId`: UUID of the task  
  - `stageComplete`: boolean
  - `nextStage?`: "refine" | "kickoff" | "execute"
  - `markDone?`: boolean

- **`cards.update`** - Update task fields during work
  - `taskId`: UUID of the task
  - `updates`: Object with fields to update

### Context and Memory

- **`context.read`** - Read task/project context
  - `taskId?`: UUID of task to read
  - `projectId?`: UUID of project to read

- **`memory.update`** - Update project memory
  - `projectId`: UUID of the project
  - `memory`: Updated memory string

### Agent Status

- **`agent.setAvailable`** - Mark agent as available for new work
- **`agent.health`** - Report agent health status
- **`agent.requestTask`** - Manually request a task (fallback)

## Workflow Examples

### Complete Task Example

```javascript
// 1. Start refine stage
await callMCP("task.start", { taskId: "task-123", stage: "refine" });

// 2. Do refine work
const context = await callMCP("context.read", { taskId: "task-123" });
// ... analyze requirements ...

await callMCP("cards.update", {
  taskId: "task-123",
  updates: {
    refinedTitle: "Implement user authentication with JWT",
    refinedDescription: "Create login endpoint, JWT middleware, and protected routes"
  }
});

// 3. Advance to kickoff
await callMCP("task.complete", {
  taskId: "task-123", 
  stageComplete: true,
  nextStage: "kickoff"
});

// 4. Start kickoff stage  
await callMCP("task.start", { taskId: "task-123", stage: "kickoff" });

// 5. Do kickoff work
// ... create implementation plan ...

await callMCP("cards.update", {
  taskId: "task-123",
  updates: {
    plan: {
      approach: "Express.js with JWT tokens",
      steps: ["Create auth routes", "Add JWT middleware", "Protect endpoints"],
      libraries: ["jsonwebtoken", "bcrypt"]
    }
  }
});

// 6. Advance to execute
await callMCP("task.complete", {
  taskId: "task-123",
  stageComplete: true, 
  nextStage: "execute"
});

// 7. Start execute stage
await callMCP("task.start", { taskId: "task-123", stage: "execute" });

// 8. Do execute work
// ... implement code changes ...

// 9. Mark task done
await callMCP("task.complete", {
  taskId: "task-123",
  markDone: true
});

// 10. Signal availability
await callMCP("agent.setAvailable", {});
```

## Benefits

1. **Clear State Management**: Tasks and agents have explicit states
2. **Automatic Task Push**: No polling - tasks are pushed when agents are free  
3. **Better Logging**: All interactions are logged for debugging
4. **Stage Progression**: Clear workflow through refine → kickoff → execute
5. **Error Recovery**: Stale sessions are automatically cleaned up
6. **Availability Detection**: Agents explicitly signal when ready for work

## Environment Variables

- `DEBUG_ORCHESTRATOR=true` - Enable detailed orchestrator logging
- `DEBUG_MCP=true` - Enable detailed MCP logging
- `AGENT_AUTH_TOKEN` - Token for agent authentication
- `CLAUDE_CODE_WS_URL` - Claude Code WebSocket URL (default: ws://localhost:8501)