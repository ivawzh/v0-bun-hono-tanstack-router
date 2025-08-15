# Solo Unicorn MCP Setup for Claude Code

This document explains how to set up and use Solo Unicorn's MCP (Model Context Protocol) tools with Claude Code.

## Overview

Solo Unicorn provides MCP tools that allow Claude Code agents to:
- Authenticate with the Solo Unicorn system
- Request and manage tasks
- Update task status and content during workflows
- Read project context and memory
- Report agent health and rate limiting

## Prerequisites

1. **Solo Unicorn server** - Development server running on port 8500
2. **Claude Code** - Anthropic's CLI tool installed and configured
3. **Node.js/Bun** - For running the Solo Unicorn server
4. **PostgreSQL** - Database for Solo Unicorn (local instance)

## Setup Instructions

### 1. Configure Authentication Token

The `AGENT_AUTH_TOKEN` is a shared secret that allows Claude Code to securely communicate with Solo Unicorn's MCP server.

#### Step 1.1: Generate a Secure Token

Generate a secure random token (or use any secure string):

```bash
# Option 1: Use openssl to generate a random token
openssl rand -hex 32

# Option 2: Use uuidgen (if available)
uuidgen

# Option 3: Use any secure string you prefer
# Example: "solo-unicorn-mcp-token-2024"
```

#### Step 1.2: Configure Solo Unicorn Server

Set the token in Solo Unicorn's server environment:

**Option A: Using .env file (Recommended)**
```bash
cd /path/to/solo-unicorn/apps/server
cp .env.example .env
# Edit .env file and set:
AGENT_AUTH_TOKEN=your-generated-token-here
```

**Option B: Using environment variable**
```bash
export AGENT_AUTH_TOKEN="your-generated-token-here"
```

#### Step 1.3: Configure Claude Code Environment

Claude Code needs the same token to authenticate with Solo Unicorn:

**Option A: Set in your shell profile (Recommended)**
```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.profile
echo 'export AGENT_AUTH_TOKEN="your-generated-token-here"' >> ~/.bashrc
source ~/.bashrc
```

**Option B: Set temporarily in current session**
```bash
export AGENT_AUTH_TOKEN="your-generated-token-here"
```

**Option C: Create a .env file in your home directory**
```bash
echo 'AGENT_AUTH_TOKEN="your-generated-token-here"' >> ~/.env
```

#### Step 1.4: Update MCP Configuration

The `.mcp.json` file uses the environment variable automatically, but verify it's correct:

```json
{
  "mcpHttpServers": {
    "solo-unicorn": {
      "url": "http://localhost:8500/mcp",
      "headers": {
        "Authorization": "Bearer ${AGENT_AUTH_TOKEN}"
      }
    }
  }
}
```

⚠️ **Important**: Both Solo Unicorn server and Claude Code must use the **exact same** `AGENT_AUTH_TOKEN` value.

### 2. MCP Configuration

The `.mcp.json` file in the repository root is already configured for Claude Code. It includes:

- HTTP MCP server connection to `http://localhost:8500/mcp`
- Bearer token authentication using the `AGENT_AUTH_TOKEN` environment variable
- Complete tool definitions with parameter descriptions

### 3. Start Solo Unicorn Server

Ensure the Solo Unicorn server is running:

```bash
cd apps/server
bun dev
```

The server should be accessible at `http://localhost:8500` with MCP endpoint at `/mcp`.

### 4. Verify Setup

#### Step 4.1: Check Environment Variables

Verify that both environments have the same token:

```bash
# Check Solo Unicorn server token
cd apps/server
cat .env | grep AGENT_AUTH_TOKEN

# Check Claude Code environment token
echo $AGENT_AUTH_TOKEN
```

Both should show the same value.

#### Step 4.2: Test Solo Unicorn Server

Ensure the server is running and responsive:

```bash
# Start the server
cd apps/server
bun dev

# In another terminal, test basic connectivity
curl http://localhost:8500/api/health
```

#### Step 4.3: Test MCP Connection

Test the MCP connection using the health check tool:

```bash
# Replace with your actual token
curl -X POST http://localhost:8500/mcp \
  -H "Authorization: Bearer $AGENT_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "server.health",
      "arguments": {}
    }
  }'
```

Expected response:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"status\":\"ok\",\"service\":\"Solo Unicorn MCP Server\"}"
      }
    ]
  }
}
```

#### Step 4.4: Test Claude Code MCP Integration

Start Claude Code in the Solo Unicorn repository:

```bash
cd /path/to/solo-unicorn
claude-code
```

Claude Code should automatically detect the `.mcp.json` file and connect to Solo Unicorn's MCP server.

## Available MCP Tools

### Agent Management Tools

- **`agent.auth`**: Authenticate and activate an agent
- **`agent.requestTask`**: Get the highest priority ready task
- **`agent.health`**: Report agent status (available, busy, rate_limited, error)
- **`agent.rateLimit`**: Mark agent as rate limited
- **`agent.sessionComplete`**: Complete or fail a session

### Task & Context Tools

- **`context.read`**: Read project and task context
- **`cards.update`**: Update task fields during workflow stages
- **`memory.update`**: Update project memory with learnings

### System Tools

- **`server.health`**: Check MCP server status

## Usage Examples

### Authenticate an Agent

```javascript
// Use in Claude Code to authenticate
await mcp.call("agent.auth", {
  clientType: "claude_code",
  repoPath: "/home/user/repos/my-project"
});
```

### Request a Task

```javascript
// Request the highest priority task (requires x-agent-id header)
await mcp.call("agent.requestTask", {});
```

### Update Task During Refinement

```javascript
// Update task with refined information
await mcp.call("cards.update", {
  taskId: "task-uuid-here",
  updates: {
    refinedTitle: "Implement user authentication system",
    refinedDescription: "Create login/logout functionality with JWT tokens",
    status: "doing",
    stage: "refine"
  }
});
```

### Read Project Context

```javascript
// Get task and project context
const context = await mcp.call("context.read", {
  taskId: "task-uuid-here"
});
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors

**Problem**: `401 Unauthorized` or `unauthorized: missing token` errors

**Solutions**:
```bash
# Check if tokens match
echo "Server token:" && cat apps/server/.env | grep AGENT_AUTH_TOKEN
echo "Claude Code token:" && echo $AGENT_AUTH_TOKEN

# If they don't match, update them to use the same value
# Generate a new token if needed:
openssl rand -hex 32
```

#### 2. Connection Refused

**Problem**: `Connection refused` or `ECONNREFUSED` errors

**Solutions**:
```bash
# Check if Solo Unicorn server is running
curl http://localhost:8500/api/health

# If not running, start it:
cd apps/server && bun dev

# Check if port 8500 is in use:
lsof -i :8500
```

#### 3. MCP Tools Not Available

**Problem**: Claude Code can't find Solo Unicorn MCP tools

**Solutions**:
```bash
# Verify .mcp.json exists in the repository root
ls -la .mcp.json

# Check JSON syntax
cat .mcp.json | jq .

# Start Claude Code from the repository root
cd /path/to/solo-unicorn
claude-code
```

#### 4. Environment Variable Not Found

**Problem**: `${AGENT_AUTH_TOKEN}` not being replaced in configuration

**Solutions**:
```bash
# Check if variable is set in current shell
echo $AGENT_AUTH_TOKEN

# If empty, set it:
export AGENT_AUTH_TOKEN="your-token-here"

# Or add to shell profile permanently:
echo 'export AGENT_AUTH_TOKEN="your-token-here"' >> ~/.bashrc
source ~/.bashrc
```

### Debug Mode

Enable debug logging to see detailed MCP communication:

```bash
# For Claude Code debug logging
export DEBUG=mcp:*
claude-code --debug

# For more verbose logging
export DEBUG=*
claude-code --verbose
```

### Verification Commands

Use these commands to verify each component:

```bash
# 1. Check Solo Unicorn server health
curl http://localhost:8500/api/health

# 2. Check MCP server health
curl -X POST http://localhost:8500/mcp \
  -H "Authorization: Bearer $AGENT_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"server.health","arguments":{}}}'

# 3. Check environment variables
echo "AGENT_AUTH_TOKEN: $AGENT_AUTH_TOKEN"

# 4. Validate MCP configuration
jq . .mcp.json

# 5. Check if Claude Code can access MCP tools
claude-code --list-tools | grep solo-unicorn
```

## Security Notes

- Keep the `AGENT_AUTH_TOKEN` secure and don't commit it to version control
- The MCP server validates all requests with Bearer token authentication
- Agent operations require additional `x-agent-id` header for security

## Complete Workflow Example

Here's a complete example of using Claude Code with Solo Unicorn:

### 1. Setup Solo Unicorn Project

```bash
# Start Solo Unicorn server
cd apps/server && bun dev

# In another terminal, start Solo Unicorn web app
cd apps/web && bun dev

# Open http://localhost:8302 and create a project
```

### 2. Configure Repo Agent

In the Solo Unicorn web interface:
1. Go to your project settings
2. Add a repo agent:
   - **Name**: "Main Repo (Claude Code)"
   - **Repo Path**: `/path/to/your/project`
   - **Client Type**: `claude_code`
3. Save the configuration

### 3. Create a Task

1. Create a new task in the "Todo" column
2. Set the raw title: "Add user authentication"
3. Set raw description: "Need login/logout functionality"
4. Select the repo agent: "Main Repo (Claude Code)"
5. Set priority to P2
6. Mark as "Ready" ✅

### 4. Use Claude Code

```bash
# Navigate to your project directory
cd /path/to/your/project

# Start Claude Code
claude-code

# Claude Code will automatically detect .mcp.json and connect
# You can now use MCP tools to work with Solo Unicorn
```

### 5. Agent Workflow

The agent will automatically:

1. **Authenticate** with Solo Unicorn:
   ```javascript
   await mcp.call("agent.auth", {
     clientType: "claude_code",
     repoPath: "/path/to/your/project"
   });
   ```

2. **Request a task**:
   ```javascript
   const task = await mcp.call("agent.requestTask", {});
   // Returns the highest priority ready task
   ```

3. **Refine the task**:
   ```javascript
   await mcp.call("cards.update", {
     taskId: task.id,
     updates: {
       refinedTitle: "Implement JWT-based user authentication system",
       refinedDescription: "Create login/logout endpoints with JWT token management...",
       status: "doing",
       stage: "refine"
     }
   });
   ```

4. **Complete the work** and mark as done:
   ```javascript
   await mcp.call("agent.sessionComplete", {
     sessionId: task.sessionId,
     success: true
   });
   ```

## Next Steps

1. **Start Solo Unicorn server**: `cd apps/server && bun dev`
2. **Configure your project** with repo agents in the web interface
3. **Create tasks** and mark them as ready
4. **Start Claude Code** from your project directory
5. **Use MCP tools** to authenticate and work with tasks

For more information about Solo Unicorn's task workflow, see the main project documentation.