# Agent Integration Implementation

This document describes the implementation of autonomous agent integration between Solo Unicorn and Claude Code UI.

## Overview

The integration allows Solo Unicorn to autonomously manage tasks through three stages:
1. **Refine**: Agent understands and refines raw user input into clear requirements
2. **Kickoff**: Agent creates detailed implementation plans with solution options
3. **Execute**: Agent implements the solution with code changes and testing

## Architecture Components

### 1. Claude Code UI WebSocket Server Modifications
- **File**: `apps/claudecode-ui/server/index.js`
- **New Path**: `/ws/agent` - Dedicated WebSocket endpoint for Solo Unicorn
- **Authentication**: Basic token auth via `AGENT_AUTH_TOKEN` environment variable
- **API Methods**:
  - `get_active_sessions` - Returns active Claude/Cursor sessions
  - `start_session` - Starts new coding sessions with commands and options
  - `abort_session` - Terminates active sessions

### 2. Solo Unicorn Agent Client
- **File**: `apps/server/src/agents/claude-code-client.ts`
- **Purpose**: WebSocket client that connects to Claude Code UI
- **Features**:
  - Automatic reconnection on disconnect
  - Session management and tracking
  - Message handling for streaming responses

### 3. Prompt Template System
- **File**: `apps/server/src/agents/prompts/index.ts`
- **Templates**:
  - `RefinePrompt` - Task understanding and refinement
  - `KickoffPrompt` - Solution planning and specification
  - `ExecutePrompt` - Implementation with code changes
- **Context**: Each prompt includes project memory, task details, and actor description

### 4. Agent Orchestrator
- **File**: `apps/server/src/agents/agent-orchestrator.ts`
- **Responsibilities**:
  - Monitors database for ready tasks (polls every 10 seconds)
  - Orchestrates task processing through three stages
  - Manages session lifecycle and stage progression
  - Integrates with MCP tools for task updates

### 5. Enhanced MCP Server
- **File**: `apps/server/src/mcp/mcp-server.ts`
- **New Tools**:
  - `context.read` - Fetch project/task context
  - `cards.update` - Update task fields during workflow
  - `memory.update` - Update project memory with learnings

## Task Workflow

### 1. Task Creation (Human)
- User creates task with raw title and description
- Selects repo agent and actor (optional)
- Marks task as "ready" when prepared for AI pickup

### 2. Agent Pickup (Automated)
```typescript
// Agent Orchestrator monitors for ready tasks
const readyTasks = await db.select(...)
  .where(and(eq(tasks.ready, true), eq(tasks.status, 'todo')))
  .orderBy(tasks.priority, tasks.createdAt);
```

### 3. Stage 1: Refine
- Agent receives refined prompt with raw task details
- Uses MCP tools to understand project context
- Updates task with refined title and description
- Automatic progression to Kickoff stage

### 4. Stage 2: Kickoff
- Agent creates solution options and ranks them
- Selects final approach with detailed specification
- Stores implementation plan in task's `plan` field
- Automatic progression to Execute stage

### 5. Stage 3: Execute
- Agent implements solution according to plan
- Has access to all coding tools (Read, Write, Edit, Bash, etc.)
- Makes git commits as appropriate
- Marks task as complete when finished

## Environment Configuration

### Claude Code UI (.env)
```bash
VITE_PORT=8303
PORT=8501
AGENT_AUTH_TOKEN=your-secure-agent-token-here
OPENAI_API_KEY=your-openai-api-key-here
```

### Solo Unicorn Server (.env)
```bash
PORT=8500
DATABASE_URL=postgresql://postgres:password@localhost:5432/solo_unicorn
CLAUDE_CODE_WS_URL=ws://localhost:8501
AGENT_AUTH_TOKEN=your-secure-agent-token-here
CORS_ORIGIN=http://localhost:8302
```

## Key Features

### Autonomous Operation
- No manual intervention required once task is marked ready
- Agents automatically pick up highest priority tasks
- Progression through stages happens automatically based on completion criteria

### Stage-Specific Tooling
- **Refine/Kickoff**: Limited to safe tools (Read, Task, TodoWrite, MCP tools)
- **Execute**: Full access to coding tools (Write, Edit, Bash, Git, etc.)

### Project Memory Integration
- Each project has persistent memory stored in database
- Memory included in all agent prompts for context
- Agents can update memory with learnings via MCP

### Session Management
- Only one active session per client type per repo agent
- Session tracking in database with status and timing
- Graceful handling of failures and cleanup

### Priority-Based Processing
- Tasks processed in priority order (P1-P5)
- Within same priority, FIFO order by creation time
- Ready flag prevents processing until human approval

## Integration Points

### Database Schema
- `tasks` table includes `stage` field for current workflow stage
- `sessions` table tracks active coding sessions
- `projects` table includes `memory` field for context

### WebSocket Communication
- Solo Unicorn connects to Claude Code UI via `/ws/agent` endpoint
- Streaming responses for real-time feedback
- Session lifecycle events (created, completed, failed)

### MCP Protocol
- Agents use MCP tools to interact with Solo Unicorn database
- Secure authentication via bearer token
- Tools for reading context and updating task state

## Error Handling

### Connection Failures
- Automatic reconnection with exponential backoff
- Graceful degradation when Claude Code UI unavailable
- Session cleanup on unexpected disconnections

### Task Failures
- Failed tasks reset to todo status with ready=false
- Error logging for debugging
- Session marked as failed in database

### Rate Limiting
- Agents can report rate limit status via MCP
- Orchestrator respects rate limits and retries later
- Status tracking in repo agent records

## Deployment Considerations

### Dependencies
- Claude Code UI must be running on specified port (default 8303 and 8501)
- PostgreSQL database must be accessible
- Both services need same AGENT_AUTH_TOKEN value

### Security
- Agent token authentication for WebSocket connections
- MCP tools require bearer token authentication
- All database operations use parameterized queries

### Monitoring
- Extensive logging for debugging and monitoring
- Session lifecycle tracking in database
- Error reporting via console logs and database status

This implementation enables fully autonomous task processing while maintaining security and reliability through proper error handling and authentication.
