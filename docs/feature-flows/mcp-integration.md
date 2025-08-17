# MCP Server Integration

## Overview

Solo Unicorn implements a Model Context Protocol (MCP) server that enables AI agents to interact with the task management system through standardized tools. The MCP server provides secure, authenticated access for AI agents to update tasks, manage project memory, create subtasks, and report status updates in real-time.

## UX Flow

### From User Perspective
1. **AI agent receives task** through orchestrator assignment
2. **Agent connects to MCP server** with authentication token
3. **Real-time status updates** appear on Kanban board as agent works
4. **Stage progression** shows through visual indicators (Refine → Plan → Execute)
5. **Task completion** automatically moves card to Done column
6. **Project memory updates** persist learnings for future tasks

### Visible MCP Effects
- **AI Working badges** show when agents are active
- **Stage transitions** update automatically during task execution
- **Refined content** appears as agents clarify requirements
- **Plan details** populate in task drawer as agents create implementation plans
- **Real-time sync** across all connected browser tabs

## System Flow

### MCP Server Initialization
```mermaid
sequenceDiagram
    participant S as Solo Unicorn Server
    participant MCP as MCP Server
    participant DB as Database
    participant WS as WebSocket
    
    S->>MCP: Initialize MCP server on startup
    MCP->>MCP: Register available tools (task_update, task_create, etc.)
    MCP->>MCP: Setup HTTP transport with bearer auth
    MCP->>MCP: Configure logging and error handling
    Note over MCP: MCP server ready for agent connections
```

### Agent Connection Flow
```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant MCP as MCP Server
    participant Auth as Auth Guard
    participant DB as Database
    
    AI->>MCP: Connect with Bearer token
    MCP->>Auth: Validate AGENT_AUTH_TOKEN
    alt Valid token
        Auth->>MCP: Authentication successful
        MCP->>AI: Connection established
        AI->>MCP: Available tools request
        MCP->>AI: Return tool schemas and descriptions
    else Invalid token
        Auth->>AI: 401 Unauthorized error
        Note over AI: Connection rejected
    end
```

### Task Update Flow
```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant MCP as MCP Server
    participant DB as Database
    participant WS as WebSocket
    participant UI as Frontend
    
    AI->>MCP: task_update(taskId, refinedTitle, stage="plan")
    MCP->>MCP: Validate bearer token
    MCP->>DB: SELECT task for existence check
    alt Task exists
        MCP->>DB: UPDATE task with new values
        alt Loop task completion
            MCP->>DB: Special handling - reset to loop status
            MCP->>DB: Update column order for fair rotation
        end
        MCP->>WS: broadcastFlush(projectId)
        WS->>UI: Real-time update to all connected clients
        MCP->>AI: Success response
    else Task not found
        MCP->>AI: Error response "Task not found"
    end
```

### Task Creation Flow (for subtask splitting)
```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant MCP as MCP Server
    participant DB as Database
    participant WS as WebSocket
    
    AI->>MCP: task_create(projectId, repoAgentId, refinedTitle, etc.)
    MCP->>MCP: Validate bearer token
    MCP->>DB: Verify project ownership and repo agent
    MCP->>DB: Verify actor belongs to project (if specified)
    MCP->>DB: INSERT new task with provided details
    alt Has dependencies
        MCP->>DB: INSERT task dependencies for sequencing
    end
    MCP->>WS: broadcastFlush(projectId)
    MCP->>AI: Return new task ID and details
```

### Project Memory Flow
```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant MCP as MCP Server
    participant DB as Database
    
    %% Reading project memory
    AI->>MCP: project_memory_get(projectId)
    MCP->>DB: SELECT project.memory
    MCP->>AI: Return memory content
    
    %% Updating project memory
    AI->>MCP: project_memory_update(projectId, newMemory)
    MCP->>DB: UPDATE projects SET memory = newMemory
    MCP->>AI: Success confirmation
    
    Note over AI: Memory updates persist for future agent sessions
```

## MCP Tools

### Core Tools Overview
```typescript
interface MCPTools {
  task_update: "Update task fields during workflow stages";
  task_create: "Create new tasks (used for subtask splitting)";
  project_memory_get: "Retrieve project context and memory";
  project_memory_update: "Update project memory with learnings";
  agent_rateLimit: "Report rate limiting status to system";
}
```

### task_update Tool (`apps/server/src/mcp/mcp-server.ts:89-233`)
```typescript
{
  title: "Update task fields during workflow stages",
  description: "Updates task status, stage, content, and working state",
  inputSchema: {
    taskId: z.string().uuid(),
    refinedTitle: z.string().optional(),
    refinedDescription: z.string().optional(), 
    plan: z.any().optional(),
    status: z.enum(["todo", "doing", "done", "loop"]).optional(),
    stage: z.enum(["refine", "plan", "execute", "loop"]).nullable().optional(),
    isAiWorking: z.boolean().optional()
  }
}
```

### task_create Tool (`apps/server/src/mcp/mcp-server.ts:436+`)
```typescript
{
  title: "Create a new task",
  description: "Creates subtasks during plan splitting or new work items",
  inputSchema: {
    projectId: z.string().uuid(),
    repoAgentId: z.string().uuid(),
    actorId: z.string().uuid().optional(),
    rawTitle: z.string().optional(),
    rawDescription: z.string().optional(),
    refinedTitle: z.string().optional(),
    refinedDescription: z.string().optional(),
    plan: z.any().optional(),
    priority: z.number().min(1).max(5).optional(),
    stage: z.enum(["plan", "execute"]).optional(),
    dependsOn: z.array(z.string().uuid()).optional()
  }
}
```

### project_memory_get Tool
```typescript
{
  title: "Get project memory and context",
  description: "Retrieves project-specific context for agent sessions",
  inputSchema: {
    projectId: z.string().uuid()
  }
}
```

### project_memory_update Tool
```typescript
{
  title: "Update project memory with learnings",
  description: "Persists insights and context for future agent sessions",
  inputSchema: {
    projectId: z.string().uuid(),
    memory: z.string()
  }
}
```

### agent_rateLimit Tool
```typescript
{
  title: "Mark agent as rate limited",
  description: "Reports API rate limiting status with resolve time",
  inputSchema: {
    agentClientType: z.enum(["CLAUDE_CODE", "CURSOR_CLI", "OPENCODE"]),
    resolveAt: z.string().datetime()
  }
}
```

## Authentication & Security

### Bearer Token Authentication
```typescript
function assertBearer(authHeader: string | string[] | undefined) {
  const expected = process.env.AGENT_AUTH_TOKEN || "default-agent-token";
  
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  
  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    throw new Error("unauthorized: missing token");
  }
  
  const token = headerValue.slice(7);
  if (token !== expected) {
    throw new Error("unauthorized: invalid token");
  }
}
```

### Request Headers
```http
Authorization: Bearer {AGENT_AUTH_TOKEN}
X-Agent-ID: {unique-agent-identifier}
Content-Type: application/json
```

### Security Measures
- **Token validation** on every tool call
- **Request logging** for audit trails
- **Error sanitization** prevents information leakage
- **Input validation** using Zod schemas
- **SQL injection protection** through parameterized queries

## Data Validation

### Zod Schema Validation
```typescript
// Example tool input validation
const taskUpdateSchema = z.object({
  taskId: z.string().uuid(),
  refinedTitle: z.string().optional(),
  refinedDescription: z.string().optional(),
  plan: z.any().optional(),
  status: z.enum(["todo", "doing", "done", "loop"]).optional(),
  stage: z.enum(["refine", "plan", "execute", "loop"]).nullable().optional(),
  isAiWorking: z.boolean().optional()
});
```

### Business Logic Validation
```typescript
// Special handling for loop tasks
if (status === "done") {
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId)
  });
  
  if (task && task.stage === "loop") {
    // Loop tasks cycle back instead of completing
    updates.status = "loop";
    updates.stage = "loop";
    // Fair rotation: move to bottom of loop column
    updates.columnOrder = calculateNewLoopPosition();
  }
}
```

### Dependency Validation
```typescript
// Verify relationships exist and belong to correct project
const repoAgent = await db.query.repoAgents.findFirst({
  where: and(
    eq(repoAgents.id, input.repoAgentId),
    eq(repoAgents.projectId, input.projectId)
  )
});

if (!repoAgent) {
  throw new Error("Repo agent not found or doesn't belong to project");
}
```

## Real-time Broadcasting

### WebSocket Integration
```typescript
import { broadcastFlush } from "@/websocket/websocket-server";

// Broadcast changes to all connected clients
await db.update(tasks).set(updates).where(eq(tasks.id, taskId));
broadcastFlush(projectId); // Invalidate frontend queries
```

### Update Propagation Flow
```mermaid
sequenceDiagram
    participant MCP as MCP Server
    participant DB as Database
    participant WS as WebSocket Server
    participant UI1 as User 1 Browser
    participant UI2 as User 2 Browser
    
    MCP->>DB: UPDATE task SET refinedTitle = "..."
    DB->>MCP: Confirm update
    MCP->>WS: broadcastFlush(projectId)
    WS->>UI1: WebSocket message
    WS->>UI2: WebSocket message
    UI1->>UI1: Invalidate queries, re-fetch data
    UI2->>UI2: Invalidate queries, re-fetch data
    
    Note over UI1,UI2: Both users see changes instantly
```

## Error Handling

### Error Response Format
```json
{
  "content": [
    {
      "type": "text", 
      "text": JSON.stringify({
        "success": false,
        "error": "Task not found",
        "details": "No task found with ID: uuid-string"
      })
    }
  ]
}
```

### Common Error Scenarios
1. **Authentication Failures**: Invalid or missing bearer token
2. **Resource Not Found**: Task, project, or repo agent doesn't exist
3. **Validation Errors**: Invalid UUID format, enum values, or required fields
4. **Permission Errors**: Attempting to access resources outside scope
5. **Database Errors**: Connection issues or constraint violations

### Error Logging
```typescript
const logger = {
  info: (message: string, context?: Record<string, any>) => {
    console.log(`[MCP-INFO] ${new Date().toISOString()} ${message}`, 
                context ? JSON.stringify(context) : "");
  },
  error: (message: string, error?: any, context?: Record<string, any>) => {
    console.error(`[MCP-ERROR] ${new Date().toISOString()} ${message}`,
                  error?.message || error,
                  context ? JSON.stringify(context) : "");
  },
  tool: (toolName: string, action: string, context?: Record<string, any>) => {
    console.log(`[MCP-TOOL] ${new Date().toISOString()} ${toolName}.${action}`,
                context ? JSON.stringify(context) : "");
  }
};
```

## Transport Layer

### HTTP Streamable Transport
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const server = new McpServer(
  {
    name: "solo-unicorn-mcp-server",
    version: "1.0.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

const transport = new StreamableHTTPServerTransport({
  port: 8502,
  path: "/mcp"
});
```

### Connection Management
- **HTTP-based transport** for reliable communication
- **JSON message format** for structured data exchange
- **Persistent connections** during agent sessions
- **Graceful degradation** on connection failures

## Performance Considerations

### Database Optimization
```sql
-- Optimized task queries with proper indexing
CREATE INDEX idx_tasks_ready_working ON tasks(ready, isAiWorking) 
WHERE ready = true AND isAiWorking = false;

CREATE INDEX idx_tasks_project_status ON tasks(projectId, status);
CREATE INDEX idx_task_dependencies_task ON taskDependencies(taskId);
```

### Query Efficiency
- **Single-query updates** with filtered field sets
- **Batch operations** for multiple related changes  
- **Selective field updates** to avoid unnecessary writes
- **Transaction boundaries** for data consistency

### Memory Management
- **Streaming responses** for large data sets
- **Connection pooling** for database access
- **Garbage collection** of completed sessions
- **Resource cleanup** on agent disconnection

## Integration Points

### Orchestrator Integration
```typescript
// MCP server receives orchestrator instance for coordination
let orchestrator: any = null;

export function setOrchestrator(orch: any) {
  orchestrator = orch;
  logger.info("MCP server integrated with improved orchestrator");
}
```

### Claude Code Client Integration
- **Session coordination** between orchestrator and MCP
- **Task assignment** triggers MCP tool usage
- **Status synchronization** across system components
- **Error propagation** for failed operations

### Frontend Integration
- **WebSocket updates** trigger query invalidation
- **Optimistic updates** with MCP confirmation
- **Real-time status** reflects MCP changes
- **Conflict resolution** for concurrent modifications

## Configuration

### Environment Variables
```bash
# MCP Server settings
MCP_SERVER_PORT=8502
MCP_SERVER_PATH=/mcp
AGENT_AUTH_TOKEN=your-secure-token

# Logging and debugging
DEBUG_MCP=false
NODE_ENV=production

# Database connection
DATABASE_URL=postgresql://user:pass@localhost:5432/solo_unicorn
```

### Server Configuration
```typescript
interface MCPServerConfig {
  name: "solo-unicorn-mcp-server";
  version: "1.0.0";
  capabilities: {
    tools: {}; // Indicates tool support
  };
}
```

## Related Features
- [AI Agent Orchestration](./ai-orchestration.md) - Task assignment and agent coordination
- [Task Lifecycle](./task-lifecycle.md) - AI-driven task progression using MCP tools
- [Real-time Features](./realtime-features.md) - WebSocket broadcasting of MCP changes
- [Project Management](./project-management.md) - Project memory management via MCP
- [Task Management](./task-management.md) - Task CRUD operations through MCP tools