# Solo Unicorn CLI Design

## Overview

Solo Unicorn CLI is a Bun-compiled single-file application that runs on user machines (workstations) to orchestrate AI coding tasks. It bridges the gap between the Solo Unicorn web platform and local development environments.

## Architecture

```
┌─────────────────────┐                  ┌─────────────────────┐
│   Solo Unicorn      │                  │   Workstation       │
│   Server            │                  │   (CLI)             │
│                     │                  │                     │
│ - Task Queue        │    Monster       │ - Agent Spawner     │
│ - Project Mgmt      │    Realtime      │ - Repo Manager      │
│ - Auth Server       │    WebSocket     │ - Config Store      │
└─────────────────────┘                  └─────────────────────┘
           |                                        |
           |              ┌─────────────────────┐   |
           └──────────────│  Monster Realtime   │───┘
                          │  Gateway            │
                          │                     │
                          │ - Channel routing   │
                          │ - Presence system   │
                          │ - Auth validation   │
                          └─────────────────────┘
                                     |
                          ┌─────────────────────┐
                          │   Local Workspace   │
                          │ ~/.solo-unicorn/    │
                          │ ~/workspace/ (git   │
                          │   worktrees)        │
                          └─────────────────────┘
```

**Key Integration Points:**
- **Monster Realtime**: WebSocket gateway for real-time communication
- **Monster Auth**: Personal access token authentication (no service accounts yet)
- **Git Worktrees**: Support for multiple working directories from same repo
- **Local Dev Server**: Optional web app hosting with channel tunneling

## CLI Command Structure

### Core Commands

```bash
# Authentication & Setup
solo-unicorn login [--web|--api-key KEY] [--org ORG_NAME]
solo-unicorn logout
solo-unicorn whoami

# Workstation Management
solo-unicorn start [--background] [--port PORT]
solo-unicorn stop [--force]
solo-unicorn status
solo-unicorn restart

# Repository Management (Git Worktree Support)
solo-unicorn init [REPO_URL] [--path PATH] [--worktree BRANCH]
solo-unicorn repo add REPO_URL [--path PATH] [--worktree BRANCH]
solo-unicorn repo remove REPO_ID
solo-unicorn repo list
solo-unicorn worktree create REPO_ID BRANCH [--path PATH]
solo-unicorn worktree list [REPO_ID]
solo-unicorn worktree remove WORKTREE_PATH

# Configuration
solo-unicorn config get [KEY]
solo-unicorn config set KEY VALUE
solo-unicorn config list
solo-unicorn config reset

# Development Server (Channel Tunneling)
solo-unicorn serve [--port PORT] [--public]
solo-unicorn tunnel status

# Utilities
solo-unicorn logs [--follow] [--lines N]
solo-unicorn update
solo-unicorn doctor
solo-unicorn help [COMMAND]
```

## Detailed Command Design

### 1. Authentication Commands

#### `solo-unicorn login`

**Purpose**: Authenticate user and register workstation using Monster Auth

```bash
# Interactive web authentication (default)
solo-unicorn login
solo-unicorn login --org my-company

# Personal access token (temporary until API keys supported)
solo-unicorn login --api-key pat_123abc...
solo-unicorn login --api-key pat_123abc... --org my-company

# Advanced options
solo-unicorn login --web --port 3000 --timeout 300
solo-unicorn login --config-dir ~/.solo-unicorn-dev
```

**Monster Auth Integration Flow**:
1. **Web Auth (default)**:
   - Start local HTTP server on random port
   - Open browser to `https://auth.monstermake.limited/authorize?client_id=solo-unicorn-cli&redirect_uri=http://localhost:{port}&response_type=code`
   - User completes Monster Auth OAuth flow
   - Receive authorization code via callback
   - Exchange code for access/refresh tokens
   - Store tokens in OS keychain

2. **Personal Access Token**:
   - Validate token format (pat_xxxxx)
   - Exchange token for workstation credentials
   - Store credentials securely

3. **Workstation Registration**:
   - Gather system info (OS, arch, hostname, user)
   - Generate unique workstation ID
   - Register with Solo Unicorn API
   - Configure Monster Realtime connection

**Error Handling**:
- Invalid token → Clear error message with token format help
- Network issues → Retry logic with exponential backoff
- Browser not available → Fallback to manual URL copy/paste
- Port conflicts → Auto-retry with different ports

### 2. Workstation Management with Monster Realtime

#### `solo-unicorn start`

**Purpose**: Connect to Monster Realtime and signal readiness for task assignments

```bash
solo-unicorn start
solo-unicorn start --background         # Run in background
solo-unicorn start --port 8500          # Custom local port
solo-unicorn start --agents claude,cursor  # Limit available agents
```

**Monster Realtime Integration**:
```typescript
// WebSocket connection to Monster Realtime
const socket = new Socket("/ws/v1/solo-unicorn-cli", {
  params: { access_token: personalAccessToken }
});

// Connect to workstation channel
const channel = socket.channel(`workstation:${workstationId}`);
await channel.join();

// Send presence updates
channel.push("message", {
  channel: `workstation:${workstationId}`,
  type: "presence.update",
  memberKey: { workstationId, userId },
  meta: { 
    status: "online", 
    availableAgents: ["claude-code", "cursor"],
    activeProjects: ["proj_123"],
    devServerPort: 3000 // if running local dev server
  }
});

// Listen for task assignments
channel.on("message", (envelope) => {
  if (envelope.type === "task:assign") {
    handleTaskAssignment(envelope.payload);
  }
});
```

**Channel Structure**:
- `workstation:{workstation_id}` - Direct workstation communication
- `project:{project_id}:workstations` - Project-wide workstation updates
- `task:{task_id}` - Task-specific coordination

#### `solo-unicorn status`

**Purpose**: Show current workstation and connection status

```bash
solo-unicorn status
solo-unicorn status --json    # Machine-readable output
```

**Output**:
```
Solo Unicorn Workstation Status
===============================

Workstation: MacBook-Pro-2023 (ws_abc123def)
Organization: acme-corp
Status: Online (Connected 2h 34m)

Authentication:
✓ Logged in as john@acme.com
✓ Personal access token valid (expires in 30d)
✓ Monster Realtime connected

Monster Realtime:
✓ Connected to: realtime.monstermake.limited
✓ Channels: workstation:ws_abc123def, project:proj_123:workstations
✓ Latency: 45ms

Repositories (Git Worktrees):
📁 solo-unicorn (repo_123)
   Main: /Users/john/workspace/solo-unicorn (main)
   Worktrees:
   - /Users/john/workspace/solo-unicorn-feature-auth (feature/auth)
   - /Users/john/workspace/solo-unicorn-hotfix (hotfix/critical-bug)
   
📁 my-app (repo_456)  
   Main: /Users/john/workspace/my-app (develop)
   Status: Cloning...

Agents:
🤖 Claude Code v2.1.4 - Available (1/2 slots used)
🤖 Cursor v0.42.0 - Available  
🤖 OpenCode v1.3.2 - Not installed

Development Server:
🌐 Local server: http://localhost:3000
🔗 Public tunnel: https://channel.solounicorn.lol/workstation/ws_abc123def/project/proj_123

Active Tasks:
📋 task_789 - Implement auth system (claude-code, 15m ago)
   Working in: /Users/john/workspace/solo-unicorn-feature-auth
```

### 3. Git Worktree Support

#### Repository Management with Worktrees

**Purpose**: Support multiple working directories from same repository

```bash
# Initialize with main branch
solo-unicorn init https://github.com/user/repo

# Create worktree for feature branch
solo-unicorn worktree create repo_123 feature/auth --path ~/workspace/repo-feature-auth

# List all worktrees for a repo
solo-unicorn worktree list repo_123

# Remove worktree (preserves branch)
solo-unicorn worktree remove ~/workspace/repo-feature-auth
```

**Worktree Management Flow**:
1. **Main Repository**: Clone to `WORKSPACE_PATH/repo-name`
2. **Feature Worktrees**: Create in `WORKSPACE_PATH/repo-name-branch-name`
3. **Automatic Cleanup**: Remove worktrees when branches are deleted
4. **Task Assignment**: Route tasks to appropriate worktree based on target branch

**Configuration Storage**:
```json
{
  "repositories": [
    {
      "id": "repo_123",
      "githubUrl": "https://github.com/user/solo-unicorn",
      "mainPath": "/Users/john/workspace/solo-unicorn",
      "mainBranch": "main",
      "worktrees": [
        {
          "branch": "feature/auth",
          "path": "/Users/john/workspace/solo-unicorn-feature-auth",
          "createdAt": "2024-01-15T10:30:00Z"
        },
        {
          "branch": "hotfix/critical-bug", 
          "path": "/Users/john/workspace/solo-unicorn-hotfix",
          "createdAt": "2024-01-16T14:20:00Z"
        }
      ]
    }
  ]
}
```

**Benefits of Git Worktrees**:
- Multiple branches checked out simultaneously
- No need to stash/commit when switching contexts  
- Isolated working directories for different tasks
- Shared .git directory (efficient disk usage)
- Perfect for parallel AI task execution

### 4. Local Development Server with Channel Tunneling

#### `solo-unicorn serve`

**Purpose**: Host local development applications with public channel access

```bash
# Start local dev server
solo-unicorn serve --port 3000

# Make it publicly accessible via channel
solo-unicorn serve --port 3000 --public

# Serve specific project
solo-unicorn serve --project proj_123 --port 3000 --public
```

**Channel Tunneling Architecture**:
```
User Browser
     ↓
https://channel.solounicorn.lol/workstation/{workstation_id}/project/{project_id}
     ↓
Solo Unicorn Server (Channel Proxy)
     ↓  
Monster Realtime WebSocket
     ↓
Workstation CLI (Local Proxy)
     ↓
http://localhost:3000 (Local Dev App)
```

**Implementation**:
1. **Local Proxy Server**: CLI starts HTTP proxy on specified port
2. **Monster Realtime Channel**: Register dev server in workstation presence
3. **Channel Proxy**: Solo Unicorn server proxies requests through WebSocket
4. **Public Access**: Users access via `channel.solounicorn.lol` subdomain

**WebSocket Protocol for Tunneling**:
```typescript
interface TunnelRequest {
  type: "http:request";
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
}

interface TunnelResponse {
  type: "http:response";  
  requestId: string;
  status: number;
  headers: Record<string, string>;
  body?: string;
}
```

**Use Cases**:
- Live preview of web applications during development
- Share work-in-progress with team members
- Remote debugging and testing
- Demo development versions to stakeholders

### 5. Configuration System

#### Configuration Storage

**Location**: `~/.solo-unicorn/config.json`

```json
{
  "version": "1.0.0",
  "workstation": {
    "id": "ws_abc123def456",
    "name": "MacBook-Pro-2023", 
    "hostname": "johns-macbook.local",
    "os": "darwin",
    "arch": "arm64"
  },
  "auth": {
    "organizationId": "org_123",
    "organizationName": "acme-corp",
    "userId": "user_456",
    "email": "john@acme.com",
    "personalAccessToken": "encrypted_pat_here",
    "expiresAt": "2024-02-15T10:30:00Z"
  },
  "realtime": {
    "gatewayUrl": "wss://realtime.monstermake.limited/ws/v1/solo-unicorn-cli",
    "timeout": 30000,
    "reconnectAttempts": 5
  },
  "server": {
    "apiUrl": "https://api.solounicorn.lol",
    "channelUrl": "https://channel.solounicorn.lol"
  },
  "workspace": {
    "rootPath": "/Users/john/solo-unicorn-workspace",
    "autoClone": true,
    "defaultBranch": "main",
    "worktreeNaming": "repo-branch"
  },
  "agents": {
    "claudeCode": {
      "enabled": true,
      "configDir": "~/.claude",
      "maxConcurrency": 2
    },
    "cursor": {
      "enabled": true,
      "path": "/usr/local/bin/cursor",
      "maxConcurrency": 1
    }
  },
  "devServer": {
    "enabled": false,
    "defaultPort": 3000,
    "autoStart": false,
    "publicTunneling": false
  },
  "repositories": [
    {
      "id": "repo_123",
      "githubUrl": "https://github.com/user/solo-unicorn",
      "mainPath": "/Users/john/workspace/solo-unicorn",
      "mainBranch": "main",
      "worktrees": [
        {
          "branch": "feature/auth",
          "path": "/Users/john/workspace/solo-unicorn-feature-auth",
          "createdAt": "2024-01-15T10:30:00Z"
        }
      ]
    }
  ]
}
```

### 6. Advanced Features

#### Agent Detection and Management

```bash
# Scan system for available agents
solo-unicorn agent scan

# Install missing agents  
solo-unicorn agent install claude-code
solo-unicorn agent install cursor --version latest

# Configure agent settings
solo-unicorn agent config claude-code --config-dir ~/.claude-dev
solo-unicorn agent config cursor --max-concurrency 1
```

#### Health Diagnostics

```bash
# Comprehensive system check
solo-unicorn doctor

# Test specific components
solo-unicorn doctor --auth           # Test Monster Auth integration
solo-unicorn doctor --realtime       # Test Monster Realtime connection  
solo-unicorn doctor --repos          # Test repository access
solo-unicorn doctor --agents         # Test agent availability
solo-unicorn doctor --tunneling      # Test dev server tunneling
```

**Example Doctor Output**:
```
Solo Unicorn Health Check
========================

Authentication:
✓ Personal access token valid
✓ Monster Auth reachable
✓ Workstation registered

Monster Realtime:
✓ Gateway connection established
✓ Channels joined successfully
✓ Presence updates working
⚠ High latency detected (250ms avg)

Repositories:
✓ All repos accessible
✓ Git worktrees functional
⚠ repo_456 has uncommitted changes

Agents:
✓ Claude Code v2.1.4 available
✗ Cursor not found in PATH
✓ OpenCode installed but disabled

Development Server:
✓ Local proxy server working
✓ Channel tunneling functional
✓ Public access available

Network:
✓ Internet connectivity
⚠ Corporate proxy detected
✓ Required ports accessible
```

### 7. Security and Best Practices

#### Token Management
- **Secure Storage**: OS keychain/credential store integration
- **Automatic Refresh**: Monitor token expiration and refresh
- **Scope Validation**: Ensure minimum required permissions
- **Revocation**: Clean token cleanup on logout

#### Network Security
- **TLS Only**: All communications over HTTPS/WSS
- **Certificate Pinning**: Validate Monster Realtime certificates
- **Proxy Support**: Corporate proxy detection and configuration
- **Rate Limiting**: Respect API rate limits with backoff

#### Repository Security
- **SSH Key Management**: Secure Git credential handling
- **File Permissions**: Proper local file access controls
- **Sandboxing**: Isolated agent execution environments
- **Audit Logging**: Track all file system operations

## Error Handling and User Experience

### Error Messages

```bash
$ solo-unicorn start
❌ Error: Not logged in

Please run 'solo-unicorn login' first to authenticate with Monster Auth.

Need help? Visit https://docs.solounicorn.lol/cli/authentication

$ solo-unicorn worktree create repo_123 feature/new-ui
❌ Error: Branch 'feature/new-ui' does not exist

The branch 'feature/new-ui' was not found in the remote repository.

To fix this:
• Create the branch first: git checkout -b feature/new-ui && git push -u origin feature/new-ui
• Use an existing branch: solo-unicorn worktree list-branches repo_123
• Specify a different branch name

$ solo-unicorn serve --public
❌ Error: Monster Realtime connection failed

Could not establish WebSocket connection to realtime.monstermake.limited

Possible solutions:
• Check internet connectivity: solo-unicorn doctor --realtime
• Verify authentication status: solo-unicorn whoami  
• Check for corporate firewall blocking WebSocket connections
• Try reconnecting: solo-unicorn restart
```

### Progress Indicators

```bash
$ solo-unicorn init https://github.com/user/large-repo
🔍 Validating repository access...
✓ Repository accessible
📁 Cloning repository to workspace...
   ████████████████████▓▓▓▓ 70% (350MB/500MB)
🌲 Setting up git worktree structure...
🔗 Registering with Solo Unicorn API...
✓ Repository initialized successfully

Repository: user/large-repo (repo_123)
Main path: /Users/john/workspace/large-repo
Branch: main
Ready for task assignments!

$ solo-unicorn start --background
🔌 Connecting to Monster Realtime...
✓ WebSocket connection established  
🏠 Joining workstation channel...
✓ Presence registered
🤖 Scanning for available agents...
   - Claude Code v2.1.4 ✓
   - Cursor v0.42.0 ✓  
   - OpenCode (not installed)
🚀 Workstation ready for tasks

Background process started (PID: 12345)
Use 'solo-unicorn status' to monitor
Use 'solo-unicorn stop' to shutdown
```

## Installation and Distribution

### Installation Methods

```bash
# NPM/Bun global install
npm install -g @solo-unicorn/cli
bun install -g @solo-unicorn/cli

# Direct binary download  
curl -fsSL https://install.solounicorn.lol | bash
wget -qO- https://install.solounicorn.lol | bash

# Package managers
brew install solo-unicorn/tap/cli      # macOS
scoop install solo-unicorn-cli         # Windows  
snap install solo-unicorn-cli          # Linux
```

### Cross-Platform Support

**Windows**:
- Windows Terminal integration
- PowerShell compatibility  
- Windows Service option for background mode
- Windows Defender exclusions guidance

**macOS**:
- Keychain integration for secure storage
- launchd service integration
- Homebrew distribution
- macOS notarization

**Linux**:
- systemd service integration  
- Various distribution packages (.deb, .rpm, .tar.gz)
- AppImage support
- Container/Docker support

## Future Enhancements

### Planned Features

1. **API Key Authentication**: Replace personal access tokens with proper service accounts
2. **Multi-Agent Orchestration**: Coordinate multiple agents on single tasks
3. **Task Templates**: Pre-configured task types with workflow templates
4. **Remote Development**: Full VS Code server integration with tunneling
5. **Team Workspaces**: Shared workstation pools for organizations
6. **CI/CD Integration**: GitHub Actions and other CI/CD platform support
7. **Metrics and Analytics**: Workstation performance and usage tracking
8. **Plugin System**: Extensible agent and tool integration

This comprehensive CLI design integrates seamlessly with Monster Auth and Monster Realtime while providing robust git worktree support and innovative development server tunneling. The system is designed for production use with excellent error handling, security practices, and cross-platform compatibility.