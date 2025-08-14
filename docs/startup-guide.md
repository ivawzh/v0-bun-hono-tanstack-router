# Solo Unicorn Startup Guide

This guide explains how to start the Solo Unicorn system with agent integration.

## Prerequisites

- **Node.js/Bun**: Runtime environment
- **PostgreSQL**: Local database running
- **Claude CLI**: Installed and configured on your system

## Environment Configuration

### 1. Claude Code UI Environment

Create `/home/iw/repos/solo-unicorn/apps/claudecode-ui/.env`:

```bash
# Basic server configuration
VITE_PORT=8303
PORT=8501

# Agent Authentication Token (must match Solo Unicorn server)
AGENT_AUTH_TOKEN=your-secure-agent-token-here

# Optional: OpenAI API Key for transcription features
OPENAI_API_KEY=your-openai-api-key-here
```

### 2. Solo Unicorn Server Environment

Create `/home/iw/repos/solo-unicorn/apps/server/.env`:

```bash
# Basic server configuration
PORT=8500

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/solo_unicorn

# Claude Code Integration (must match Claude Code UI token)
CLAUDE_CODE_WS_URL=ws://localhost:8501
AGENT_AUTH_TOKEN=your-secure-agent-token-here

# CORS Configuration
CORS_ORIGIN=http://localhost:8302
```

**Important**: Use the same `AGENT_AUTH_TOKEN` value in both environments.

## Startup Sequence

### 1. Start PostgreSQL Database

Ensure PostgreSQL is running:
```bash
# On macOS with Homebrew
brew services start postgresql

# On Linux with systemd
sudo systemctl start postgresql

# Or using Docker
docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

### 2. Start Claude Code UI Server (Port 8303 and 8501)

```bash
cd /home/iw/repos/solo-unicorn/apps/claudecode-ui
bun install
bun run server
```

You should see:
```
✅ WebSocket authenticated for user: <username>
Claude Code UI Server
➜ Local: http://localhost:8303/
```

### 3. Start Solo Unicorn Server (Port 8500)

```bash
cd /home/iw/repos/solo-unicorn/apps/server
bun install
bun dev
```

You should see:
```
🤖 Initializing Agent Orchestrator...
   Claude Code URL: ws://localhost:8501
   Agent Token: f9488f43...
🤖 Connected to Claude Code UI WebSocket
🤖 Agent Orchestrator initialized successfully
Started development server: http://localhost:8500
```

### 4. Start Solo Unicorn Web UI (Port 8302)

```bash
cd /home/iw/repos/solo-unicorn/apps/web
bun install
bun dev
```

## Troubleshooting

### ❌ WebSocket Connection Failed

**Error**: `WebSocket connection to 'ws://localhost:8501/ws/agent?token=...' failed`

**Solution**:
1. Verify Claude Code UI is running on port 8501
2. Check that both servers have the same `AGENT_AUTH_TOKEN`
3. Test Claude Code UI accessibility: `curl http://localhost:8501/`

**Expected Behavior**: If Claude Code UI isn't available, Solo Unicorn will:
- Log connection failures with exponential backoff
- Stop trying after 10 attempts
- Continue running but skip task processing
- Automatically reconnect when Claude Code UI becomes available

### ❌ Database Connection Issues

**Error**: Database connection failures

**Solution**:
1. Ensure PostgreSQL is running
2. Check `DATABASE_URL` in your `.env` file
3. Create database if it doesn't exist:
   ```bash
   createdb solo_unicorn
   ```

### ❌ Authentication Failures

**Error**: `❌ Agent WebSocket authentication failed`

**Solution**:
1. Verify `AGENT_AUTH_TOKEN` matches in both `.env` files
2. Restart both servers after changing tokens
3. Check for typos or extra whitespace in environment files

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Solo Unicorn  │    │   Claude Code UI │    │   Claude CLI    │
│   Web UI        │    │   Server         │    │   Process       │
│   (Port 8302)   │    │   (Port 8501)    │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │ HTTP API               │ WebSocket              │ Process
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Solo Unicorn  │◄──►│   Agent          │◄──►│   Repository    │
│   Server        │    │   Orchestrator   │    │   Files         │
│   (Port 8500)   │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │
         │ SQL
         ▼
┌─────────────────┐
│   PostgreSQL    │
│   Database      │
│                 │
└─────────────────┘
```

## Testing the Integration

1. **Create a Project**: Use the web UI to create a project
2. **Configure Repo Agent**: Add a repository path and select Claude Code
3. **Create a Task**: Add a task with raw title and description
4. **Mark Ready**: Check the "Ready" checkbox
5. **Watch Automation**: Agent should automatically pick up and process the task

**Expected Logs in Solo Unicorn Server**:
```
🚀 Starting task processing: <task title>
📝 Started refine session for task: <task title>
📝 Task <task-id> updated: { refinedTitle: "...", refinedDescription: "..." }
📝 Started kickoff session for task: <refined title>
📝 Task <task-id> updated: { plan: {...} }
📝 Started execute session for task: <refined title>
✅ Task <task-id> completed
```

This startup sequence ensures all components are properly connected and ready for autonomous task processing.
