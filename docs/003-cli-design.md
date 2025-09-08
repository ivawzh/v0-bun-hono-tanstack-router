# Solo Unicorn CLI Design

## Overview

Solo Unicorn CLI is a Bun-compiled single-file application that runs on user machines (workstations) to orchestrate AI coding missions. It bridges the gap between the Solo Unicorn web platform and local development environments.

Majority of prompt command is provided by Solo Unicorn server. However, CLI might append extra information sourced from `~/.solo-unicorn/config.json`, e.g. workspace directory path.

## Communication Protocol Architecture

**Protocol Hierarchy** (use least powerful approach):
- **oRPC**: Internal communication (web ↔ server) when breaking changes acceptable
- **REST API**: External communication (CLI ↔ server, third-party integrations) when backward compatibility required
- **WebSocket**: Real-time push notifications only (mission assignments, status updates)
- **MCP**: AI agent communication only (mission updates, project memory access)

## Architecture

```ascii
                          ┌──────────────────────┐
           ┌───────────── │  Solo Unicorn MCP    │───┐
           |              │                      │   |
           |              │ - Code agent create missions │   |
           |              │ - Code agent update missions │   |
           |              └──────────────────────┘   |
┌─────────────────────┐                  ┌─────────────────────┐
│   Solo Unicorn      │                  │   Workstation       │
│   Server            │                  │   (CLI)             │
│                     │                  │                     │
│ - Mission Queue     │    Monster       │ - Run Code Agents   │
│ - Project Mgmt      │    Realtime      │ - Repo Manager      │
│ - Prompt generation │    WebSocket     │ - Config Store      │
│ - Public URL        │    Tunnel        │ - Dev server @ Port │
└─────────────────────┘                  └─────────────────────┘
           |                                        |
           |              ┌─────────────────────┐   |
           └──────────────│  Monster Realtime   │───┘
                          │  Gateway            │
                          │                     │
                          │ - Server pushes missions to CLI│
                          │ - Channel routing   │
                          │ - Presence system   │
                          │ - Auth validation   │
                          └─────────────────────┘
```

**Key Integration Points:**

Repository Identification:
- repository_id is standardized to GitHub numeric repository ID (BIGINT)
- Code agents receive one main repository_id and optional additionalRepositoryIds[]

- **Monster Realtime**: WebSocket gateway for real-time communication
- **Monster Auth**: Personal access token authentication (no service accounts yet)
- **Git Worktrees**: Support for multiple working directories from same repo
- **Local Dev Server**: Optional web app hosting with channel tunneling

## CLI Command Structure

### Core Commands (MVP)

```bash
# Authentication
solo-unicorn auth login [--web|--api-key KEY] [--org ORG_NAME]
solo-unicorn auth logout
solo-unicorn auth whoami

# Workstation lifecycle
solo-unicorn workstation register [--name NAME] [--force]
solo-unicorn workstation start [--background]
solo-unicorn workstation stop [--force]
solo-unicorn workstation status [--json]
solo-unicorn workstation restart

# Aliases (ergonomic)
solo-unicorn start        # alias of workstation start
solo-unicorn stop         # alias of workstation stop
solo-unicorn status       # alias of workstation status
solo-unicorn restart      # alias of workstation restart

# Repositories (GitHub linking)
solo-unicorn repo add GITHUB_URL [--path PATH]
solo-unicorn repo list
solo-unicorn repo remove REPO_ID

# Worktrees
# MVP: Auto-managed by CLI on first mission for a repo/branch (no user-facing commands)

# Configuration
solo-unicorn config get [KEY]
solo-unicorn config set KEY VALUE
solo-unicorn config list
solo-unicorn config reset [KEY]

# (Not in MVP) Development server
solo-unicorn dev-server start [--port PORT] [--project PROJECT_ID]
solo-unicorn dev-server stop
solo-unicorn dev-server status [--json]

# (Not in MVP) Public tunneling
solo-unicorn tunnel open [--target-port PORT] [--project PROJECT_ID]
solo-unicorn tunnel close
solo-unicorn tunnel status [--json]

# Agents (MVP)
solo-unicorn agent scan
solo-unicorn agent list
solo-unicorn agent add TYPE [--version VERSION]

# CLI self-management
solo-unicorn self update
solo-unicorn self version

# Help
solo-unicorn help [COMMAND]
```

## Detailed Command Design

### 1. Authentication Commands

#### `solo-unicorn auth login`

**Purpose**: Authenticate user and register workstation using Monster Auth

```bash
# Interactive web authentication (default)
solo-unicorn auth login
solo-unicorn auth login --org my-company

# Personal access token
solo-unicorn auth login --api-key pat_123abc...
solo-unicorn auth login --api-key pat_123abc... --org my-company

# Organization API key (for service accounts)
solo-unicorn auth login --org-key org_key_123abc... --org my-company

# Advanced options
solo-unicorn auth login --web --timeout 300
solo-unicorn auth login --config-dir ~/.solo-unicorn-dev
```

**Monster Auth Integration Flow**:

1. **Web Auth (default)**:
   - Start local HTTP server on a random ephemeral port (auto-selected; no user configuration in MVP)
   - Open browser to `https://auth.monstermake.limited/authorize?client_id=solo-unicorn-cli&redirect_uri=http://localhost:{port}&response_type=code`
   - User completes Monster Auth OAuth flow
   - Receive authorization code via callback
   - Exchange code for access/refresh tokens
   - Store tokens in OS keychain

2. **Personal Access Token**:
   - Validate token format (pat_xxxxx)
   - Exchange token for workstation credentials
   - Store credentials securely

3. **Organization API Key**:
   - Validate token format (org_key_xxxxx)
   - Organization-level service account authentication
   - Ideal for automated deployments and CI/CD

4. **Workstation Registration**:
   - Gather system info (OS, arch, hostname, user)
   - Generate unique workstation ID
   - Register with Solo Unicorn API
   - Configure Monster Realtime connection
   - Also available as a dedicated command: `solo-unicorn workstation register`

**Error Handling**:

- Invalid token → Clear error message with token format help
- Network issues → Retry logic with exponential backoff
- Browser not available → Fallback to manual URL copy/paste
- Port conflicts → Auto-retry with different ports

### 2. Workstation Management with Monster Realtime

#### `solo-unicorn workstation register`

Purpose: Register or re-register the current workstation with the Solo Unicorn API. This is performed automatically during auth login, but is also available as a dedicated command for headless setups, regenerating metadata, or recovering from corrupted local state.

```bash
solo-unicorn workstation register
# Optional: set a friendly name or force re-registration
solo-unicorn workstation register --name "John's MacBook" --force
```

Notes:
- Collects system info (OS, arch, hostname), generates or refreshes workstation ID.
- Associates the workstation with the authenticated user/org.
- Safe to run multiple times; idempotent unless --force is provided.

#### `solo-unicorn workstation start`

**Purpose**: Connect to Monster Realtime and signal readiness for mission assignments

```bash
solo-unicorn workstation start
solo-unicorn workstation start --background         # Run in background
# Alias for ergonomics
solo-unicorn start
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
    availableCodeAgents: ["claude-code", "cursor"],
    activeProjects: ["proj_123"],
    devServerPort: 3000 // if running local dev server
  }
});

// Listen for mission assignments
channel.on("message", (envelope) => {
  if (envelope.type === "mission:assign") {
    handleMissionAssignment(envelope.payload);
  }
});
```

**WebSocket Channel Structure**:

- `workstation:{workstation_id}` - Direct workstation communication
- `project:{project_id}:workstations` - Project-wide workstation updates
- `mission:{mission_id}` - Mission-specific coordination

#### `solo-unicorn workstation status`

**Purpose**: Show current workstation and connection status

```bash
solo-unicorn workstation status
solo-unicorn workstation status --json    # Machine-readable output
# Alias for ergonomics
solo-unicorn status
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
   Main: /Users/john/repos/solo-unicorn (main)
   Worktrees:
   - /Users/john/workspace/solo-unicorn-feature-auth (feature/auth)
   - /Users/john/workspace/solo-unicorn-hotfix (hotfix/critical-bug)

📁 my-app (repo_456)
   Main: /Users/john/workspace/my-app (develop)
   Status: Cloning...

Code Agents (Client-Side):
🤖 Claude Code v2.1.4 - Available (1/2 slots used)
🤖 Cursor v0.42.0 - Available
🤖 OpenCode v1.3.2 - Not installed
🤖 Warp v1.3.2 - Not installed

Server Knowledge:
- Workstation reports available agent types via WebSocket presence
- Server does not store agent configurations or paths
- All agent settings stored in ~/.solo-unicorn/code-agents.json

Development Server:
🌐 Local server: http://localhost:3000
🔗 Public tunnel: https://channel.solounicorn.lol/workstation/ws_abc123def/project/proj_123

Active Missions:
📋 mission_789 - Implement auth system (claude-code, 15m ago)
   Working in: /Users/john/workspace/solo-unicorn-feature-auth
```

### 3. Git Worktree Support

#### Repository Management with Worktrees

**MVP Purpose**: Support multiple working directories from the same repository. Worktrees are created automatically by the CLI on first mission targeting a repo/branch; there are no user-facing worktree commands in MVP.

```bash
# Add repository by GitHub URL (optionally specify local path)
solo-unicorn repo add https://github.com/user/repo --path ~/workspace/repo

# On first mission targeting this repo/branch, the CLI auto-creates a worktree
# at the default workspace path following your naming scheme.

# (Post-MVP) The following commands may be introduced:
# solo-unicorn worktree list [REPO_ID]
# solo-unicorn worktree remove WORKTREE_ID | --repo REPO_ID --branch BRANCH | --path PATH
```

**Worktree Management Flow**:

1. **Main Repository**: Clone to `WORKSPACE_PATH/repo-name`
2. **Feature Worktrees**: Auto-created by the CLI on first mission for a repo/branch (e.g., `WORKSPACE_PATH/repo-name-branch-name`)
3. **Automatic Cleanup**: Remove worktrees when branches are deleted (manual `worktree remove` is available if needed)
4. **Mission Assignment**: Route missions to appropriate worktree based on target branch

**Configuration Storage**:

```json
{
  "repositories": [
    {
      "id": "repo_123",
      "githubUrl": "https://github.com/user/solo-unicorn",
      "mainPath": "/Users/john/repos/solo-unicorn",
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
          "missionId": "mission_123",
          "createdAt": "2024-01-16T14:20:00Z"
        }
    }
  ]
}
```

**Smart Worktree Management**:

```typescript
interface WorktreePool {
  repoId: string;
  available: Array<{
    path: string;
    branch: string;
    lastUsed: Date;
  }>;
  inUse: Array<{
    path: string;
    branch: string;
    missionId: string;
  }>;
}

// Worktree allocation strategy:
// 1. Try to reuse existing worktree for same branch
// 2. If not available, use vacant worktree (clean checkout)
// 3. If none available and under maxConcurrencyLimit, create new
// 4. Keep 3 vacant worktrees per repo (efficient resource usage)
```

**Cleanup Policy**:
- Maximum worktrees per repo = `maxConcurrencyLimit + 3` (pool size)
- Remove worktrees unused for 7+ days
- Always keep at least 1 vacant worktree
- Worktree pool stored client-side in `~/.solo-unicorn/worktrees.json`

**Benefits of Git Worktrees**:

- Multiple branches checked out simultaneously
- No need to stash/commit when switching contexts
- Isolated working directories for different missions
- Shared .git directory (efficient disk usage)
- Perfect for parallel AI mission execution
- Smart reuse reduces disk space and setup time

### 4. Local Development Server with Public Tunneling

#### `solo-unicorn dev-server` and `solo-unicorn tunnel`

**Purpose**: Host local development applications with public channel access

```bash
# Start local dev server
solo-unicorn dev-server start --port 3000

# Make it publicly accessible via channel
solo-unicorn tunnel open --target-port 3000

# Serve specific project
solo-unicorn dev-server start --project proj_123 --port 3000
solo-unicorn tunnel open --project proj_123 --target-port 3000

# Check status
solo-unicorn dev-server status
solo-unicorn tunnel status
```

**Public Tunneling Architecture**:

Tunneling Options (MVP analysis):
- Cloudflare Tunnel (cloudflared): Recommended for MVP. Pros: free tier, dynamic subdomains, easy setup, fits multi-tenant. Cons: vendor dependency.
- Ngrok: Simple, but free tier limits and cost at scale.
- Tailscale Funnel: Great for teams already on Tailscale; not ideal for public internet at scale.
- Inlets/self-hosted reverse proxy: More control, more ops overhead.

MVP choice: Cloudflare Tunnel for cost and ease. Performance is not a concern for MVP.

```
User Browser
     ↓
https://channel.solounicorn.lol/workstation/{workstation_id}/project/{project_id}
     ↓
Solo Unicorn Server (Tunnel Proxy)
     ↓
Monster Realtime WebSocket
     ↓
Workstation CLI (Local Proxy)
     ↓
http://localhost:3000 (Local Dev App)
```

**Implementation**:

1. **Local Proxy Server**: CLI starts HTTP proxy on specified port
2. **Secure Tunnel**: Establish encrypted tunnel to Solo Unicorn server
3. **Tunnel Proxy**: Solo Unicorn server proxies requests through secure connection
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

Solo Unicorn CLI uses multiple configuration files to manage workstation settings, agent configurations, and project information.

#### Main Configuration: `~/.solo-unicorn/config.json`

```typescript
interface SoloUnicornConfig {
  version: string;
  workstation: {
    id: string;                     // ws_abc123def456
    name: string;                   // MacBook-Pro-2023
    hostname: string;               // johns-macbook.local
    os: string;                     // darwin, linux, win32
    arch: string;                   // arm64, x64
  };
  auth: {
    organizationId: string;         // org_123
    organizationName: string;       // acme-corp
    userId: string;                 // user_456
    email: string;                  // john@acme.com
    personalAccessToken: string;    // encrypted_pat_here
    expiresAt: string;              // ISO timestamp
  };
  realtime: {
    gatewayUrl: string;             // wss://realtime.monstermake.limited/ws/v1/solo-unicorn-cli
    timeout: number;                // 30000ms
    reconnectAttempts: number;      // 5
  };
  server: {
    apiUrl: string;                 // https://api.solounicorn.lol
    tunnelUrl: string;              // https://tunnel.solounicorn.lol
  };
  workspace: {
    rootPath: string;               // /Users/john/solo-unicorn-workspace
    autoClone: boolean;             // true
    defaultBranch: string;          // main
    worktreeNaming: string;         // "repo-branch"
  };
  devServer: {
    enabled: boolean;
    defaultPort: number;
    autoStart: boolean;
    publicTunneling: boolean;
    tunnelDomain: string;           // tunnel.solounicorn.lol
    tunnelSecurity: {
      requireAuth: boolean;
      maxRequestsPerMinute: number;
    };
  };
  repositories: Array<{
    id: string;                     // repo_123
    githubUrl: string;              // https://github.com/user/solo-unicorn
    mainPath: string;               // /Users/john/workspace/solo-unicorn
    mainBranch: string;             // main
    worktrees: Array<{
      branch: string;               // feature/auth
      path: string;                 // /Users/john/workspace/solo-unicorn-feature-auth
      createdAt: string;            // ISO timestamp
    }>;
  }>;
}
```

**Example Configuration:**

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
    "tunnelUrl": "https://tunnel.solounicorn.lol"
  },
  "workspace": {
    "rootPath": "/Users/john/solo-unicorn-workspace",
    "autoClone": true,
    "defaultBranch": "main",
    "worktreeNaming": "repo-branch"
  },
  "devServer": {
    "enabled": false,
    "defaultPort": 3000,
    "autoStart": false,
    "publicTunneling": false,
    "tunnelDomain": "tunnel.solounicorn.lol",
    "tunnelSecurity": {
      "requireAuth": false,
      "maxRequestsPerMinute": 100
    }
  },
  "repositories": [
    {
      "id": "repo_123",
      "repositoryId": 123456789,
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

#### Code Agent Configuration: `~/.solo-unicorn/code-agents.json`

**Purpose**: Store code agent-specific configuration locally on workstation. Server tracks available agent types via workstation presence updates, while all detailed configuration stays on the client.

```typescript
interface WorkstationCodeAgentConfig {
  version: string;
  workstationId: string;
  codeAgents: {
    [codeAgentId: string]: {
      // Code Agent Identity
      id: string;
      type: 'claude-code'; // only support claude code for now
      name: string;

      // Local Configuration (not stored in database)
      configPath: string;              // ~/.claude, /Applications/Cursor.app
      executablePath?: string;         // /usr/local/bin/cursor
      environmentVars: Record<string, string>; // PATH, CLAUDE_CONFIG_DIR, etc.

      // Code Agent-Specific Settings
      customSettings: {
        claudeCode?: {
          configDir: string;           // CLAUDE_CONFIG_DIR
          defaultModel?: string;       // claude-4-sonnet
        };
      };

      // Status
      enabled: boolean;
      lastHealthCheck?: string;        // ISO timestamp
      healthStatus: 'healthy' | 'warning' | 'error' | 'unknown';

      // Statistics
      missionsCompleted: number;
      lastUsed?: string;               // ISO timestamp
      averageMissionDuration?: number;    // seconds
    };
  };

  // Global Settings
  settings: {
    autoUpdateCodeAgentStatus: boolean;
    healthCheckInterval: number;       // seconds
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    backupConfig: boolean;
  };
}
```

**Example Code Agent Configuration:**

```json
{
  "version": "1.0.0",
  "workstationId": "ws_abc123def456",
  "codeAgents": {
    "codeagent_claude_001": {
      "id": "codeagent_claude_001",
      "type": "claude-code",
      "name": "Claude Code Primary",
      "configPath": "~/.claude",
      "environmentVars": {
        "CLAUDE_CONFIG_DIR": "~/.claude",
        "PATH": "/usr/local/bin:/usr/bin:/bin"
      },
      "customSettings": {
        "claudeCode": {
          "configDir": "~/.claude",
          "defaultModel": "claude-3.5-sonnet"
        }
      },
      "enabled": true,
      "healthStatus": "healthy",
      "missionsCompleted": 42,
      "lastUsed": "2024-01-15T14:30:00Z",
      "averageMissionDuration": 1200
    },
    "codeagent_cursor_001": {
      "id": "codeagent_cursor_001",
      "type": "cursor",
      "name": "Cursor IDE",
      "configPath": "/Applications/Cursor.app",
      "executablePath": "/usr/local/bin/cursor",
      "environmentVars": {},
      "customSettings": {
        "cursor": {
          "model": "gpt-4",
          "workspaceSettings": {
            "theme": "dark",
            "fontSize": 14
          }
        }
      },
      "enabled": true,
      "healthStatus": "healthy",
      "missionsCompleted": 18,
      "lastUsed": "2024-01-14T16:45:00Z",
      "averageMissionDuration": 900
    }
  },
  "settings": {
    "autoUpdateCodeAgentStatus": true,
    "healthCheckInterval": 300,
    "logLevel": "info",
    "backupConfig": true
  }
}
```

### 6. Advanced Features

#### Code Agent Detection and Management

```bash
# Scan system for available agents
solo-unicorn agent scan

# List detected/registered agents
solo-unicorn agent list

# Add/register an agent
solo-unicorn agent add claude-code
solo-unicorn agent add cursor --version latest
```

#### Planned: Health Diagnostics (post-MVP)

```bash
# Comprehensive system check
solo-unicorn doctor

# Test specific components
solo-unicorn doctor --auth           # Test Monster Auth integration
solo-unicorn doctor --realtime       # Test Monster Realtime connection
solo-unicorn doctor --repos          # Test repository access
solo-unicorn doctor --code-agents    # Test code agent availability
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

Code Agents:
✓ Claude Code v2.1.4 available
✗ Cursor not found in PATH
✓ OpenCode installed but disabled

Development Server:
✓ Local proxy server working
✓ Public tunneling functional
✓ Public access available

Network:
✓ Internet connectivity
⚠ Corporate proxy detected
✓ Required ports accessible
```

### 7. Security and Best Practices

#### Token Management

- **Secure Storage**: Both access and refresh tokens stored in OS keychain/credential store integration. Bun supports native secret managers of some OS. See <https://bun.com/blog/bun-v1.2.21#bun-secrets-native-secrets-manager-for-cli-tools>
- **Automatic Refresh**: Monitor access token expiration and automatically refresh using refresh token
- **Server-Initiated Refresh**: Handle Monster Realtime signals for immediate token refresh
- **Refresh Token Rotation**: Update refresh token when provided by Monster Auth
- **Scope Validation**: Ensure minimum required permissions
- **Revocation**: Clean both access and refresh token cleanup on logout

#### Network Security

- **TLS Only**: All communications over HTTPS/WSS
- **Certificate Pinning**: Validate Monster Realtime certificates
- **Proxy Support**: Corporate proxy detection and configuration
- **Rate Limiting**: Respect API rate limits with backoff

#### Repository Security

- **SSH Key Management**: Secure Git credential handling
- **File Permissions**: Proper local file access controls
- **Sandboxing**: Isolated code agent execution environments
- **Audit Logging**: Track all file system operations

## Error Handling and User Experience

### Error Messages

```bash
$ solo-unicorn workstation start
❌ Error: Not logged in

Please run 'solo-unicorn auth login' first to authenticate with Monster Auth.

Need help? Visit https://docs.solounicorn.lol/cli/authentication

$ solo-unicorn worktree create repo_123 feature/new-ui
❌ Error: Branch 'feature/new-ui' does not exist

The branch 'feature/new-ui' was not found in the remote repository.

To fix this:
• Create the branch first: git checkout -b feature/new-ui && git push -u origin feature/new-ui
• Use an existing branch: check remote branches with: git branch -r
• Specify a different branch name

$ solo-unicorn dev-server start --port 3000 && solo-unicorn tunnel open --target-port 3000
❌ Error: Monster Realtime connection failed

Could not establish WebSocket connection to realtime.monstermake.limited

Possible solutions:
• Verify authentication status: solo-unicorn auth whoami
• Check workstation connection: solo-unicorn workstation status
• Check tunnel status: solo-unicorn tunnel status
• Check for corporate firewall blocking WebSocket connections
• Try reconnecting: solo-unicorn workstation restart
```

### Progress Indicators

```bash
$ solo-unicorn repo add https://github.com/user/large-repo --path ~/workspace/large-repo
🔍 Validating repository access...
✓ Repository accessible
📁 Cloning repository to workspace...
   ████████████████████▓▓▓▓ 70% (350MB/500MB)
🌲 Setting up git worktree structure...
🔗 Registering with Solo Unicorn API...
✓ Repository added successfully

Repository: user/large-repo (repo_123)
Main path: /Users/john/workspace/large-repo
Branch: main
Ready for mission assignments!

$ solo-unicorn workstation start --background
🔌 Connecting to Monster Realtime...
✓ WebSocket connection established
🏠 Joining workstation channel...
✓ Presence registered
🤖 Scanning for available agents...
   - Claude Code v2.1.4 ✓
   - Cursor v0.42.0 ✓
   - OpenCode (not installed)
🚀 Workstation ready for missions

Background process started (PID: 12345)
Use 'solo-unicorn workstation status' to monitor
Use 'solo-unicorn workstation stop' to shutdown
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

1. **Multi-Code Agent Orchestration**: Coordinate multiple code agents on single missions
2. **Mission Templates**: Pre-configured mission types with flow templates
3. **Remote Development**: Full VS Code server integration with tunneling
4. **Team Workspaces**: Shared workstation pools for organizations
5. **CI/CD Integration**: GitHub Actions and other CI/CD platform support
6. **Metrics and Analytics**: Workstation performance and usage tracking
7. **Plugin System**: Extensible code agent and tool integration
8. **Loop Mission Scheduling**: Advanced scheduling for loop missions (max per day/hour)

This comprehensive CLI design integrates seamlessly with Monster Auth and Monster Realtime while providing robust git worktree support and innovative development server tunneling. The system is designed for production use with excellent error handling, security practices, and cross-platform compatibility.

## PR support

MVP Review Flow:
- Human reviews occur in GitHub; leave comments in GitHub
- Solo Unicorn links to the PR and shows status in the Review/Done columns
- When the mission is rejected in Solo Unicorn with feedback, the agent is instructed to read GitHub PR comments via `gh` and iterate

Service will provide information if user has chosen to use PRs or not (YOLO, push straight to default branch).

### Why optional PRs?

#### YOLO For Early-Stage Projects

- **Fast Iteration**: Direct commits to main branch
- **Zero Overhead**: No PR creation or review delays
- **Solo Development**: Perfect for single developer workflows
- **Quick Prototyping**: Immediate code deployment

#### PRs for Production Projects

- **Code Quality**: Mandatory review process
- **Team Collaboration**: Multiple reviewers and stakeholders
- **Audit Trail**: Complete PR history and discussions
- **AI Enhancement**: Code agents respond to feedback and improve code
- **Branch Management**: Automatic branch creation and cleanup
- **GitHub Integration**: Native GitHub flow experience

### PR Features

#### Smart Branch Management

- **Auto-naming**: `solo-unicorn/mission-{id}-{slug}` format
- **Conflict Resolution**: AI handles merge conflicts when possible
- **Branch Cleanup**: Automatic deletion after successful merge

#### Review Flow Automation

- **Merge Strategies**: Support for merge, squash, and rebase

#### Integration & Extensibility

- Read PR comments and change requests via Github CLI/MCP

This comprehensive PR support system bridges the gap between fast iteration and controlled development, providing the perfect solution for projects at any stage of maturity while maintaining Solo Unicorn's focus on AI-powered mission orchestration.
