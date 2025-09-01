# CLI, Websocket and Auth

## First prompt

Please help me brainstorm a new plan. Return your response in either update or
append of this document. Feel super welcome to challenge my idea, give me suggestions,
think-out-of-the-box thoughts.

### CLI

On top of existing Solo Unicorn. I am going to introduce new app "Solo Unicorn CLI".
It will be a Bun compiled single file cli app, that gets installed on user machine side.
It's main job so far:

1. `login`:
  a. register user's machine as their workstation, where ai code agent will run at. It
can be all sorts of machines - pc, mac, linux, docker container, etc.
  b. auth. default to --web that open web and auth via monster auth personal access
token and refresh token. Storing the token locally somewhere. Optionally can use
--api-key API key (not yet existing, need your help to design how to generate and works
with monster auth or other solutions).
  c. connect websocket for receiving push notifications. e.g. WS message of task
assignment.
2. `init` register a repo from pwd. init step is optional. user may also provide `solo
config set WORKSPACE_PATH ~/solo-unicorn-workspace/` (may also default a value without
forcing user to set at setup), github access and github repo link, then cli can handle
git clone and setup the repo at workspace.
3. `start`: signal server this workstation is ready to receive new tasks.
4. `stop`: signal server to stop assigning new tasks.

Concerns:

1. How will database entities be like? Should we remove agent entities?
1. Repo entity also may not make sense anymore. Maybe we should have workstation entity link to project. And then, repo path will be saved at workstation's file ~/.solo-unicorn/config.json similar to Claude Code's settings. Repo entity maybe need to replace both repo_path and repo.name with a new field 'github_repo_link' as both a gihub url and repo uuid.

New database entities brainstorming:
            users
              |
  ------------|
  |
 Org -> WorkStations(project to workstations = 1:n )
  |
  |
  |-------------------> Repos
  |
  |
  |-------------------> Projects (broad)
  |
  |
  |
  AgentAccounts(optional. Only useful when user want to use multiple Claude Code accounts to rotate between rate limit period)

In workstation ~/.solo-unicorn/config.json, we will store:
{
  repos: Array<{
    "githubRepoLink": "<https://github.com/monstermake/solo-unicorn>",
    "repoId": "123",
    "localPath": "/Users/user/solo-unicorn" // optional. If not provided, we will use github_repo_link to clone the repo at WORKSPACE_PATH
  }>
}

### WebSocket server

Is it possible to add a long running websocket service that use Elixir. However, I want
this ws server to be shared across the company powering multiple apps, meanwhile it is a
generic websocket gateway infrastructure that have at least business logic as possible.

My idea of this Elixir shared service

1. Stateful with Elixir clustering. <https://hexdocs.pm/phoenix/releases.html#clustering>
1. Deploy to OCI via SST V3.
1. no database.
1. shared by multiple apps at different endpoints.
1. configable. store whitelist of allowed apps (i.e. client_id), message enpoint, message-schema endpoint, auth endpoint, API keys (i am not familiar how Elixir deal with secrets, pleaes help me) and their allowed domain names in config (??? I don't know if this is possible to support hot deploy in the future while we are running the service in production and want to add new client apps? Please help me).
1. no business logic (except maybe needs heartbeat check for "presence" state? I am not familiar with this. Please help me).
1. business logic and auth is handled by client apps via ws-message to http-endpoint routing. E.g. Elixir server received ws message at endpoint /solo-unicorn, channel "workstation:<id>", type "task-started", payload { taskId: "123", sessionId: '456', workstationId: '789' } Bun server; then the corresponding ws-message will be forwarded to Bun server at endpoint POST `api.solounicorn.lol/messages` with body `{ channel: "workstation:<id>", type: "task-started", payload: { taskId: "123", sessionId: '456', workstationId: '789' } }` and also forward its auth header.
1. on start, Elixir server fetch message schema from client apps' configurable schema endpoint with auth. This will determine the ws routing.
1. Elixir server also has endpoint to allow trigger to refetch the message schema in case of client app updated.
1. on user creating connection, Elixir server will also forward request to client app's configurable auth endpoint to determine if the connection is allowed.

Use case examples:

1. Workstation CLI received task assignment push notification from server.
2. Workstation CLI informs server if workstation is online.
3. Solo Unicorn web app receives push notification for task updates.

Concerns in my mind:

1. How does it fit into Monster Auth? Ideally CLI will have either service account or API key to support auth.
1. Will CORS work? Assuming Elixir server is at `realtime.monstermake.limited`.
1. Which elixir library or framework to use for websocket?
1. How to work with React Query?

### Background context

Solo Unicorn's server runs Bun on AWS lambda.
Solo Unicorn is a product under my company Monster Make.
Monster Make has a centralised auth system Monster Auth.
Monster Auth is basically a consumer of SST's libary OpenAuth
I don't know if Openauth has solution for supporting service account instead of personal
account. I will need something like service account or API key to support CLI i assume
(other ideas are very welcome).
Solo Unicorn web production domain is solounicorn.lol.
Solo Unicorn server is at api.solounicorn.lol.
Monster Auth is at auth.monstermake.limited

Currently the CORS are working fine.

-----

## AI response

### Comprehensive Analysis & Recommendations

Based on my analysis of your Solo Unicorn architecture, existing codebase, and authentication system, here are my recommendations:

## **Options Ranked by Priority**

### **1. Database Entity Redesign (Score: 9/10)** ⭐ RECOMMENDED
**Approach**: Transform from Agent-centric to Workstation-centric model

```typescript
// New entities structure
Workstations (replaces Agents) {
  id, projectId, name, machineId (unique identifier)
  type: 'SELF_HOSTED' | 'CLOUD'
  status: 'ONLINE' | 'OFFLINE'
  capabilities: { claudeCode: true, cursor: false, ... }
  config: { workspacePath, defaultAgent, ... }
  lastHeartbeat, rateLimitResetAt
}

Repositories {
  id, projectId, githubUrl (primary identifier)
  localPathTemplate: '{{WORKSPACE}}/{{REPO_NAME}}'
  defaultBranch, accessToken (encrypted)
}

WorkstationRepositories {
  workstationId, repositoryId
  localPath (actual path on that workstation)
  status: 'CLONED' | 'NOT_CLONED' | 'SYNCING'
}

AgentAccounts (optional, for rotation) {
  id, projectId, type: 'CLAUDE_CODE'
  credentials: { CLAUDE_CONFIG_DIR, ... }
  rateLimitResetAt, priority
}
```

**Why this wins**: Aligns perfectly with CLI model where workstations are first-class citizens. GitHub URLs become the universal identifier for repos across workstations.

### **2. Authentication Strategy (Score: 8/10)** ⭐ RECOMMENDED
**Hybrid approach with Machine Tokens**

```typescript
// Extend Monster Auth with machine tokens
MachineTokens {
  id, userId, workstationId
  token: string (JWT with long TTL)
  type: 'WORKSTATION' | 'SERVICE'
  permissions: ['task:read', 'task:execute', ...]
  expiresAt: timestamp (90 days default)
  lastUsedAt, createdAt
}

// CLI auth flow
1. `solo login --web`: OAuth flow → get user token
2. Exchange user token for machine token (automatic)
3. Store machine token in ~/.solo-unicorn/auth.json
4. Use machine token for all CLI operations
```

**Alternative**: API Keys for CI/CD scenarios
```typescript
ApiKeys {
  id, projectId, name, hashedKey
  permissions: jsonb
  rateLimitPerHour: 100
  validUntil, lastUsedAt
}
```

### **3. WebSocket Architecture (Score: 7/10)** ⚠️ CONSIDER CAREFULLY
**Bun-native WebSocket over Elixir**

Instead of adding Elixir complexity, leverage Bun's excellent WebSocket support:

```typescript
// apps/websocket/src/index.ts
Bun.serve({
  port: 8600,
  fetch(req, server) {
    // Handle auth via Bearer token from Monster Auth
    const success = server.upgrade(req, {
      data: { workstationId, projectId }
    });
  },
  websocket: {
    message(ws, message) {
      // Route to business logic endpoints
      await fetch('https://api.solounicorn.lol/ws-message', {
        method: 'POST',
        headers: { Authorization: ws.data.token },
        body: JSON.stringify(message)
      });
    },
    open(ws) {
      // Register workstation presence
      workstations.set(ws.data.workstationId, ws);
    }
  }
});
```

**Why not Elixir**:
- Adds significant complexity (new language, deployment, monitoring)
- Bun WebSockets are performant enough for your scale
- Easier to maintain with existing TypeScript team
- Can scale horizontally with Redis pub/sub if needed

### **4. CLI Architecture (Score: 10/10)** ⭐ MUST HAVE
**Bun-compiled single binary with modular commands**

```typescript
// CLI structure
solo-unicorn/
├── login    # Auth + workstation registration
├── init     # Repo setup
├── start    # Begin accepting tasks
├── stop     # Pause task acceptance
├── status   # Show workstation/task status
├── config   # Manage local settings
└── daemon   # Background process for WebSocket

// Configuration at ~/.solo-unicorn/config.json
{
  "workstationId": "uuid",
  "workspacePath": "~/solo-workspace",
  "defaultAgent": "CLAUDE_CODE",
  "repositories": [{
    "githubUrl": "https://github.com/org/repo",
    "localPath": "/absolute/path/to/repo",
    "repoId": "uuid"
  }],
  "auth": {
    "machineToken": "jwt...",
    "refreshToken": "jwt...",
    "expiresAt": "2025-11-01T00:00:00Z"
  }
}
```

### **5. Service Account Alternative (Score: 6/10)**
**OpenAuth doesn't natively support service accounts, but you can extend:**

```typescript
// Custom service account provider for OpenAuth
ServiceAccountProvider({
  verify: async (clientId, clientSecret) => {
    // Validate against database
    const account = await db.serviceAccounts.findFirst({
      where: { clientId, hashedSecret: hash(clientSecret) }
    });
    return account ? { id: account.id, scope: account.scope } : null;
  }
})
```

## **Challenges & Solutions**

### **CORS with WebSocket server**
- If at `realtime.monstermake.limited`, configure:
```typescript
{
  origin: ['https://solounicorn.lol', 'https://api.solounicorn.lol'],
  credentials: true
}
```

### **React Query + WebSocket Integration**
```typescript
// Use mutation for real-time updates
const queryClient = useQueryClient();
ws.onmessage = (event) => {
  const { type, taskId, data } = JSON.parse(event.data);
  if (type === 'task:updated') {
    queryClient.setQueryData(['task', taskId], data);
  }
};
```

### **Rate Limit Rotation**
With workstation model, intelligently rotate between available Claude Code accounts:
```typescript
function selectBestAgent(workstation: Workstation, accounts: AgentAccount[]) {
  return accounts
    .filter(a => !a.rateLimitResetAt || a.rateLimitResetAt < new Date())
    .sort((a, b) => a.priority - b.priority)[0];
}
```

## **Migration Path**

1. **Phase 1**: Keep existing system, add Workstation entity alongside Agents
2. **Phase 2**: Implement CLI with machine tokens
3. **Phase 3**: Migrate from Agents to Workstations gradually
4. **Phase 4**: Add WebSocket for real-time updates
5. **Phase 5**: Deprecate old Agent system

## **Critical Decisions**

- **Don't remove Agents immediately** - migrate gradually
- **GitHub URLs as repo identifiers** - enables cross-workstation consistency
- **Machine tokens over API keys** - better security with JWT expiry
- **Bun WebSocket over Elixir** - simpler stack, easier maintenance
- **Workstation heartbeat** - detect offline machines via WebSocket pings

This architecture supports your vision of distributed AI task orchestration while maintaining simplicity and leveraging your existing stack effectively.

## **Follow-up Q&A**

### **Bun WebSocket + AWS Lambda Compatibility Issue**
**Problem**: AWS Lambda doesn't support persistent WebSocket connections (stateless, max 15min execution)

**Revised Solution**: Hybrid approach
```typescript
// Option A: Serverless WebSocket via AWS API Gateway WebSocket
- Use AWS API Gateway WebSocket API
- Lambda handles connect/disconnect/message events
- DynamoDB stores connection mappings
- No persistent Bun server needed

// Option B: ECS Fargate for WebSocket, Lambda for business logic
- Single ECS Fargate container with Bun WebSocket server
- Forwards messages to existing Lambda API endpoints
- Auto-scaling when needed, but persistent connections
```

**Recommendation**: Start with **Option A** (API Gateway WebSocket) for consistency with existing serverless architecture.

### **Revised Database Entities**

```typescript
// Updated based on feedback
Workstations {
  id, projectId, name
  type: 'SELF_HOSTED' | 'CLOUD'
  status: 'ONLINE' | 'OFFLINE' | 'ERROR'
  lastHeartbeat
  errorDetails: jsonb // Store installation/config issues
}

Repositories {
  id, projectId, githubUrl (primary identifier)
  defaultBranch
  // Removed: localPathTemplate, accessToken
}

// Removed: WorkstationRepositories (not needed - store in CLI config only)

AgentAccounts {
  id, projectId, workstationId // Link to specific workstation
  type: 'CLAUDE_CODE'
  credentials: { CLAUDE_CONFIG_DIR, ... }
  rateLimitResetAt
  priority: number // 1=highest, 999=lowest
  isActive: boolean
}
```

### **Agent Capability Detection - Optimistic Approach**
You're right - tracking capabilities is complex. **Optimistic approach**:

```typescript
// CLI reports back on execution failure
POST /api/tasks/{taskId}/agent-error
{
  "error": "CLAUDE_CODE_NOT_FOUND",
  "agentType": "CLAUDE_CODE",
  "workstationId": "uuid"
}

// Server response includes auto-remediation
{
  "blockReason": "Claude Code not installed",
  "installGuide": "Run: curl -fsSL https://claude.ai/cli | sh",
  "autoInstall": true // Future: auto-install via CLI
}
```

### **Heartbeat Optimization**
**Problem**: Frequent heartbeats = expensive Lambda invocations

**Solution**: Smart heartbeat strategy
```typescript
// Only heartbeat on state changes + periodic check
- On task start/complete: immediate heartbeat
- When idle: heartbeat every 5 minutes
- Use WebSocket ping/pong for connection health
- Server marks offline after 10 minutes no heartbeat
```

### **Agent Account Priority Rotation**
```typescript
// Better rotation algorithm
function selectBestAgent(accounts: AgentAccount[]) {
  const available = accounts
    .filter(a => a.isActive && (!a.rateLimitResetAt || a.rateLimitResetAt < new Date()))
    .sort((a, b) => a.priority - b.priority);
  
  if (available.length === 0) return null;
  
  // Round-robin among same priority level
  const topPriority = available[0].priority;
  const samePriority = available.filter(a => a.priority === topPriority);
  
  // Use lastUsedAt to rotate fairly
  return samePriority.sort((a, b) => 
    (a.lastUsedAt?.getTime() || 0) - (b.lastUsedAt?.getTime() || 0)
  )[0];
}
```

### **CLI Daemon vs Background Process**
**Daemon** = background process that starts automatically and runs persistently

**Instead of daemon**:
```bash
# Auto-start via shell profile (better UX)
echo 'solo start-background' >> ~/.bashrc

# CLI manages its own background process
solo login    # Starts background service
solo status   # Shows if background service running
solo stop     # Stops background service

# Background service handles:
# - WebSocket connection to server
# - Polling for new tasks
# - Executing agent sessions
```

### **CLI Config Simplification**
```json
// Simplified ~/.solo-unicorn/config.json
{
  "workstationId": "uuid",
  "workspacePath": "~/solo-workspace",
  "repositories": [{
    "githubUrl": "https://github.com/org/repo",
    "localPath": "/absolute/path/to/repo",
    "repoId": "uuid"
  }],
  "auth": {
    "machineToken": "jwt...",
    "refreshToken": "jwt...",
    "expiresAt": "2025-11-01T00:00:00Z"
  }
}
```

### **React Query + WebSocket Scoping**
```typescript
// Channel-scoped updates
ws.onmessage = (event) => {
  const { type, projectId, taskId, data } = JSON.parse(event.data);
  
  // Only update queries for current project
  if (projectId === currentProject.id) {
    switch (type) {
      case 'task:updated':
        queryClient.setQueryData(['task', taskId], data);
        queryClient.invalidateQueries(['tasks', projectId]);
        break;
      case 'workstation:status':
        queryClient.invalidateQueries(['workstations', projectId]);
        break;
    }
  }
};

// WebSocket connection includes project scope
ws = new WebSocket(`wss://realtime.monstermake.limited/projects/${projectId}`);
```

### **GitHub Repository Identification**
Industry standards for Git repositories:
```typescript
// Git URL formats (standardized)
"https://github.com/owner/repo"           // HTTPS (most common)
"git@github.com:owner/repo.git"           // SSH
"github.com/owner/repo"                   // Normalized form

// Our approach: normalize to HTTPS format
function normalizeGitUrl(url: string): string {
  // Convert git@github.com:owner/repo.git → https://github.com/owner/repo
  // Remove .git suffix, convert SSH to HTTPS
  return url.replace(/^git@github\.com:/, 'https://github.com/')
            .replace(/\.git$/, '');
}
```

### **WebSocket Heartbeat Mechanism**
```typescript
// Client (CLI) side
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.ping(); // Built-in WebSocket ping
  }
}, 30000); // Every 30 seconds

// Server side (API Gateway WebSocket)
exports.ping = async (event) => {
  const connectionId = event.requestContext.connectionId;
  // Update lastHeartbeat in database
  await updateWorkstationHeartbeat(connectionId);
  return { statusCode: 200 };
};

// Offline detection (background job)
setInterval(async () => {
  const staleWorkstations = await db.workstations.findMany({
    where: {
      lastHeartbeat: { lt: new Date(Date.now() - 10 * 60 * 1000) } // 10 minutes
    }
  });
  
  for (const ws of staleWorkstations) {
    await db.workstations.update({
      where: { id: ws.id },
      data: { status: 'OFFLINE' }
    });
  }
}, 60000); // Check every minute
```

### **WebSocket Hosting Architecture**
**Recommendation**: AWS API Gateway WebSocket (serverless)

```typescript
// No EC2/ECS needed - pure serverless
API Gateway WebSocket API
├── $connect    → Lambda (authenticate, store connection)
├── $disconnect → Lambda (cleanup connection)
├── ping        → Lambda (update heartbeat)
├── task-update → Lambda (forward to business logic)
└── $default    → Lambda (handle unknown messages)

// Connection storage in DynamoDB
ConnectionTable {
  connectionId (PK)
  workstationId
  projectId
  userId
  connectedAt
}
```

**Benefits**:
- No server management
- Auto-scales with connections
- Integrates with existing Lambda API
- Pay per message/connection

**Alternative**: If you prefer long-running Bun server later, use ECS Fargate with Application Load Balancer.

## **Cost Analysis & Authentication Deep Dive**

### **AWS API Gateway WebSocket Costs**

```typescript
// Pricing breakdown (US East 1, as of 2025)
Connection minutes: $0.25 per million connection minutes
Messages: $1.00 per million messages

// Example calculation for Solo Unicorn scale:
Assumptions:
- 100 active workstations
- Average 8 hours connected per day
- 1 heartbeat every 30 seconds = 120 messages/hour
- 10 task updates per day per workstation

Monthly costs:
Connection minutes: 100 workstations × 8 hours × 30 days × 60 min = 1,440,000 minutes
Cost: 1.44 × $0.25 = $0.36/month

Messages: 
- Heartbeats: 100 × 8 × 30 × 120 = 2,880,000 messages
- Task updates: 100 × 10 × 30 = 30,000 messages
- Total: ~2.9 million messages
Cost: 2.9 × $1.00 = $2.90/month

Total WebSocket cost: ~$3.26/month

// Lambda invocation costs (existing)
- $connect/$disconnect: 100 workstations × 2 daily connects × 30 days = 6,000 invocations
- Message handling: 2.9M messages × 128MB × 100ms average = significant cost
- Estimated additional Lambda cost: $50-100/month depending on processing complexity

Total estimated cost: $53-103/month for WebSocket infrastructure
```

### **API Gateway WebSocket Authentication**

```typescript
// Method 1: Custom Authorizer (Recommended)
// Create Lambda authorizer for WebSocket connections

exports.authorize = async (event) => {
  try {
    const token = event.queryStringParameters.token; // from ws://...?token=jwt
    
    // Validate JWT token (same as your existing API auth)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's a machine token for workstation
    const isValidMachineToken = await validateMachineToken(decoded, event.requestContext.connectionId);
    
    if (!isValidMachineToken) {
      return { statusCode: 401 };
    }
    
    return {
      statusCode: 200,
      context: {
        workstationId: decoded.workstationId,
        projectId: decoded.projectId,
        userId: decoded.userId
      }
    };
  } catch (error) {
    return { statusCode: 401 };
  }
};

// Client connection (CLI)
const wsUrl = `wss://realtime.monstermake.limited?token=${machineToken}`;
const ws = new WebSocket(wsUrl);

// Method 2: IAM-based (More complex, better for service-to-service)
// Use AWS credentials to sign WebSocket connection requests
```

## **Elixir WebSocket Solutions Ranked**

### **1. Phoenix Framework (Score: 9/10)** ⭐ BEST CHOICE
**Why Phoenix wins for WebSocket**:
```elixir
# Built-in WebSocket handling via Phoenix Channels
defmodule SoloUnicornWeb.WorkstationChannel do
  use Phoenix.Channel
  
  def join("workstation:" <> workstation_id, %{"token" => token}, socket) do
    # Authenticate via HTTP call to your Bun API
    case authenticate_machine_token(token) do
      {:ok, %{workstation_id: ^workstation_id, project_id: project_id}} ->
        # Store connection mapping
        {:ok, assign(socket, :workstation_id, workstation_id)}
      {:error, _} ->
        {:error, %{reason: "unauthorized"}}
    end
  end
  
  def handle_in("task_update", payload, socket) do
    # Forward to Bun API
    HTTPoison.post("https://api.solounicorn.lol/ws-message", payload)
    {:noreply, socket}
  end
end
```

**Deployment Options**:
```yaml
# Option A: Railway (Easiest)
Cost: $5-20/month for small instances
Pros: Zero-config deployment, git-based
Cons: Less control, vendor lock-in

# Option B: Fly.io (Recommended)
Cost: $2-10/month for basic apps
Pros: Global edge deployment, Docker-based
Cons: Learning curve

# Option C: AWS ECS + Fargate
Cost: $15-50/month
Pros: Full AWS integration, auto-scaling
Cons: More complex setup
```

### **2. Bandit (Pure Elixir HTTP/WebSocket) (Score: 8/10)**
```elixir
# Lightweight alternative to Phoenix
defmodule SoloUnicornWS do
  use Bandit.WebSocket
  
  def init(options) do
    # Minimal WebSocket server without Phoenix overhead
    {:ok, %{}}
  end
  
  def handle_in({:text, message}, state) do
    # Route messages to external API
    {:reply, {:text, "ack"}, state}
  end
end
```

**Pros**: Lower resource usage, simpler
**Cons**: More manual work, less ecosystem

### **3. Cowboy WebSocket (Score: 7/10)**
```erlang
% Lower-level Erlang solution
-module(solo_unicorn_ws).
-behaviour(cowboy_websocket).

init(Req, State) ->
    {cowboy_websocket, Req, State}.

websocket_handle({text, Msg}, State) ->
    % Handle message routing
    {reply, {text, <<"ack">>}, State}.
```

**Pros**: Maximum performance, battle-tested
**Cons**: Erlang syntax, more complex

### **4. LiveView + WebSocket (Score: 6/10)**
```elixir
# If you want real-time UI + WebSocket
defmodule SoloUnicornWeb.DashboardLive do
  use Phoenix.LiveView
  
  def handle_info({:task_updated, task}, socket) do
    # Real-time UI updates
    {:noreply, assign(socket, :task, task)}
  end
end
```

**Pros**: Real-time UI included
**Cons**: Overkill for API-only WebSocket

## **Elixir Deployment Architecture**

### **Recommended: Fly.io + Phoenix** 
```dockerfile
# fly.toml
[build]
  image = "hexpm/elixir:1.15-erlang-26-alpine-3.17.2"

[env]
  PORT = "4000"
  BEAD_API_URL = "https://api.solounicorn.lol"

[http_service]
  internal_port = 4000
  force_https = true
  
[[http_service.checks]]
  grace_period = "30s"
  interval = "15s"
  method = "GET"
  timeout = "5s"
  path = "/health"

# Multi-region deployment
[regions]
  primary = "iad"  # US East
  fallback = ["lax", "fra"]  # US West, Europe
```

**Cost Breakdown**:
```typescript
// Fly.io Phoenix WebSocket costs
Basic app (256MB RAM): $1.94/month
Scaling to 2 instances: $3.88/month
Data transfer: ~$0.02/GB

Total estimated cost: $4-10/month

// Additional considerations:
- SSL certificates: Free (Let's Encrypt)
- Global deployment: Included
- Auto-scaling: Available
- Monitoring: Basic included
```

## **Authentication for Elixir WebSocket**

```elixir
# Phoenix Channel authentication
defmodule SoloUnicornWeb.UserSocket do
  use Phoenix.Socket
  
  def connect(%{"token" => token}, socket, _connect_info) do
    case authenticate_token(token) do
      {:ok, user_data} ->
        {:ok, assign(socket, :user_data, user_data)}
      {:error, _reason} ->
        :error
    end
  end
  
  defp authenticate_token(token) do
    # Call your Monster Auth API
    case HTTPoison.post("https://auth.monstermake.limited/validate", %{token: token}) do
      {:ok, %{status_code: 200, body: body}} ->
        {:ok, Jason.decode!(body)}
      _ ->
        {:error, :invalid_token}
    end
  end
end
```

## **Final Recommendation Matrix**

| Solution | Setup Complexity | Monthly Cost | Maintenance | Scalability |
|----------|-----------------|--------------|-------------|-------------|
| API Gateway WS | Low | $53-103 | Low | Excellent |
| Phoenix/Fly.io | Medium | $4-10 | Medium | Good |
| Phoenix/Railway | Low | $5-20 | Low | Good |
| Phoenix/ECS | High | $15-50 | High | Excellent |

**For your use case**: Start with **API Gateway WebSocket** for MVP, consider **Phoenix on Fly.io** if you need more WebSocket features or want to reduce Lambda costs.
