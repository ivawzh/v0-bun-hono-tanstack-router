# Non-GUI Client Interface Design - CLI

## Overview

### Interface Type

**Type:** CLI
**Target Platform:** Cross-platform (Windows, macOS, Linux)
**Primary Language:** TypeScript (Bun runtime)

### Purpose

Solo Unicorn CLI enables developers to manage workstations, repositories, and AI code agent orchestration from the command line. It provides authentication, workstation lifecycle management, repository operations, and mission handling for distributed AI-assisted development workflows.

### Target Users

- **Developers**: Manage personal development environments and workstation presence
- **DevOps Engineers**: Automate workstation provisioning and configuration in CI/CD
- **System Administrators**: Deploy and manage workstations across development teams

## Installation & Setup

### Prerequisites

- Node.js 18+ or Bun 1.2+
- Git 2.20+
- Internet connection for Monster Auth authentication

### Installation Methods

#### Package Manager Installation

##### Commands

```bash
# npm
npm install -g solo-unicorn-cli

# Homebrew (macOS)
brew install solo-unicorn-cli

# Chocolatey (Windows)  
choco install solo-unicorn-cli

# APT (Ubuntu/Debian)
sudo apt install solo-unicorn-cli
```

##### Verification

```bash
solo-unicorn --version
solo-unicorn --help
```

#### Binary Download

##### Commands

```bash
# Download latest release
curl -L https://releases.solounicorn.lol/cli/latest/solo-unicorn-linux-amd64 -o solo-unicorn
chmod +x solo-unicorn
sudo mv solo-unicorn /usr/local/bin/
```

##### Verification

```bash
solo-unicorn version
which solo-unicorn
```

## Authentication

### Supported Methods

- **OAuth**: Browser-based Monster Auth flow for interactive login
- **PAT**: Personal Access Tokens for CI/CD automation  
- **API Key**: Organization-scoped keys for service accounts

### Setup

#### OAuth Authentication

##### Steps

1. Run `solo-unicorn auth login`
2. Local HTTP server starts on ephemeral port
3. Browser opens to Monster Auth OAuth page
4. Complete OAuth authentication
5. CLI receives authorization code via callback
6. Tokens exchanged and stored in OS keychain
7. Workstation automatically registered

##### Example

```bash
solo-unicorn auth login

# Output:
# 🔑 Starting authentication with Monster Auth...
# 🌐 Opening browser to: https://auth.monstermake.limited/authorize...
# ✓ Authentication successful!
# 👤 Logged in as: john@acme.com
```

#### Personal Access Token

##### Steps

1. Generate PAT in web dashboard
2. Set environment variable or config
3. Run `solo-unicorn auth whoami` to verify

##### Example

```bash
export SOLO_UNICORN_TOKEN="pat_abc123..."
solo-unicorn auth whoami

# Or via config
solo-unicorn config set auth.token "pat_abc123..."
```

## Usage Flows

### UF-CLI-001 - Initial Setup & Authentication

**User Goal:** Set up CLI and authenticate for first use  
**Trigger:** First CLI usage  
**Success Criteria:** Authenticated user with registered workstation ready for missions

#### Steps

1. Install CLI via package manager
2. Run `solo-unicorn auth login`
3. Complete OAuth flow in browser
4. Workstation automatically registered
5. Ready for workstation operations

#### Example

```bash
solo-unicorn auth login
solo-unicorn workstation start
solo-unicorn workstation status
```

### UF-CLI-002 - Repository Management

**User Goal:** Add and manage repositories for mission execution  
**Trigger:** Project setup or adding new repositories  
**Success Criteria:** Repository cloned with worktree structure ready for AI agents

#### Steps

1. Run `solo-unicorn repo add <github-url>`
2. CLI validates repository access
3. Clone to workspace with worktree structure
4. Register repository with API
5. Ready for mission assignments

#### Example

```bash
solo-unicorn repo add https://github.com/user/repo --path ~/workspace/repo
solo-unicorn repo list
```

### UF-CLI-003 - Workstation Lifecycle

**User Goal:** Start workstation and make available for missions  
**Trigger:** Beginning work session or automation startup  
**Success Criteria:** Workstation online and receiving mission assignments

#### Steps

1. Run `solo-unicorn workstation start`
2. Connect to Monster Realtime
3. Join workstation presence channel
4. Detect and report available code agents
5. Listen for mission assignments
6. Execute missions automatically

#### Example

```bash
solo-unicorn start  # alias for workstation start
solo-unicorn status # view current status
solo-unicorn stop   # graceful shutdown
```

## Interfaces

### Authentication Commands

#### Description

Manage user authentication and session tokens for Monster Auth integration.

#### Items

##### auth login

###### Syntax

```bash
solo-unicorn auth login [--force]
```

###### Description

Start OAuth authentication flow with Monster Auth using browser-based login.

###### Parameters

- `--force` (boolean): Force re-authentication even if valid tokens exist

###### Example

```bash
solo-unicorn auth login
solo-unicorn auth login --force
```

##### auth logout

###### Syntax

```bash
solo-unicorn auth logout
```

###### Description

Clear stored authentication tokens and disconnect from Monster Realtime.

###### Example

```bash
solo-unicorn auth logout
```

##### auth whoami

###### Syntax

```bash
solo-unicorn auth whoami [--json]
```

###### Description

Display current authentication status and user information.

###### Parameters

- `--json` (boolean): Output in JSON format for programmatic use

###### Example

```bash
solo-unicorn auth whoami
solo-unicorn auth whoami --json
```

### Workstation Management

#### Description

Manage workstation lifecycle, presence, and availability for mission assignment.

#### Items

##### workstation start

###### Syntax

```bash
solo-unicorn workstation start [--background]
```

###### Description

Start workstation presence and connect to Monster Realtime for mission assignment.

###### Parameters

- `--background` (boolean): Run as background daemon process

###### Example

```bash
solo-unicorn workstation start
solo-unicorn workstation start --background
```

##### workstation stop

###### Syntax

```bash
solo-unicorn workstation stop
```

###### Description

Gracefully stop workstation and disconnect from mission assignment.

###### Example

```bash
solo-unicorn workstation stop
```

##### workstation status

###### Syntax

```bash
solo-unicorn workstation status [--json]
```

###### Description

Display workstation status, connection state, and active missions.

###### Parameters

- `--json` (boolean): Output in JSON format

###### Example

```bash
solo-unicorn workstation status
solo-unicorn workstation status --json
```

### Repository Operations

#### Description

Manage Git repositories and worktree structures for parallel mission execution.

#### Items

##### repo add

###### Syntax

```bash
solo-unicorn repo add <github-url> [--path <path>]
```

###### Description

Clone repository and set up worktree structure for mission execution.

###### Parameters

- `github-url` (string): GitHub repository URL to clone
- `--path` (string): Custom path for repository (default: ~/workspace/<repo-name>)

###### Example

```bash
solo-unicorn repo add https://github.com/user/repo
solo-unicorn repo add https://github.com/user/repo --path ~/custom/path
```

##### repo list

###### Syntax

```bash
solo-unicorn repo list [--json]
```

###### Description

List all configured repositories and their worktree status.

###### Parameters

- `--json` (boolean): Output in JSON format

###### Example

```bash
solo-unicorn repo list
solo-unicorn repo list --json
```

##### repo remove

###### Syntax

```bash
solo-unicorn repo remove <repo-name> [--force]
```

###### Description

Remove repository and clean up associated worktrees.

###### Parameters

- `repo-name` (string): Name of repository to remove
- `--force` (boolean): Force removal without confirmation

###### Example

```bash
solo-unicorn repo remove my-repo
solo-unicorn repo remove my-repo --force
```

### Configuration Management

#### Description

Manage CLI settings, workspace paths, and preferences.

#### Items

##### config get

###### Syntax

```bash
solo-unicorn config get <key>
```

###### Description

Get configuration value for specified key.

###### Parameters

- `key` (string): Configuration key to retrieve

###### Example

```bash
solo-unicorn config get workspace.rootPath
solo-unicorn config get auth.organization
```

##### config set

###### Syntax

```bash
solo-unicorn config set <key> <value>
```

###### Description

Set configuration value for specified key.

###### Parameters

- `key` (string): Configuration key to set
- `value` (string): Value to set

###### Example

```bash
solo-unicorn config set workspace.rootPath ~/dev
solo-unicorn config set auth.organization acme-corp
```

##### config list

###### Syntax

```bash
solo-unicorn config list [--json]
```

###### Description

List all configuration settings and their current values.

###### Parameters

- `--json` (boolean): Output in JSON format

###### Example

```bash
solo-unicorn config list
solo-unicorn config list --json
```

### Code Agent Management

#### Description

Detect, configure, and manage AI code agents on the workstation.

#### Items

##### agent scan

###### Syntax

```bash
solo-unicorn agent scan
```

###### Description

Scan system for available AI code agents (Claude Code, Cursor, etc.).

###### Example

```bash
solo-unicorn agent scan
```

##### agent list

###### Syntax

```bash
solo-unicorn agent list [--json]
```

###### Description

List configured code agents and their availability status.

###### Parameters

- `--json` (boolean): Output in JSON format

###### Example

```bash
solo-unicorn agent list
solo-unicorn agent list --json
```

##### agent add

###### Syntax

```bash
solo-unicorn agent add <agent-name>
```

###### Description

Add detected code agent to configuration for mission execution.

###### Parameters

- `agent-name` (string): Name of code agent to add (claude-code, cursor, etc.)

###### Example

```bash
solo-unicorn agent add claude-code
solo-unicorn agent add cursor
```

## Configuration

### Configuration Files

#### ~/.solo-unicorn/config.json

##### Location

`~/.solo-unicorn/config.json`

##### Schema

```json
{
  "auth": {
    "organization": "string",
    "apiEndpoint": "string"
  },
  "workspace": {
    "rootPath": "string",
    "autoClone": "boolean",
    "worktreePoolSize": "number"
  },
  "realtime": {
    "gateway": "string",
    "reconnectInterval": "number"
  },
  "agents": {
    "scanInterval": "number",
    "healthCheckInterval": "number"
  }
}
```

#### ~/.solo-unicorn/code-agents.json

##### Location

`~/.solo-unicorn/code-agents.json`

##### Schema

```json
{
  "agents": [
    {
      "name": "string",
      "type": "string", 
      "path": "string",
      "version": "string",
      "enabled": "boolean",
      "config": "object"
    }
  ]
}
```

### Environment Variables

- `SOLO_UNICORN_TOKEN`: Personal access token for authentication
- `SOLO_UNICORN_ORG`: Organization identifier
- `SOLO_UNICORN_API_ENDPOINT`: Custom API endpoint URL
- `SOLO_UNICORN_CONFIG_PATH`: Custom config file path
- `SOLO_UNICORN_WORKSPACE`: Default workspace root path

## Distribution

### Packaging

**Package Manager:** npm, Homebrew, Chocolatey, APT, RPM
**Distribution:** GitHub Releases, package registries, direct binary downloads

### Versioning

**Scheme:** Semantic versioning (x.y.z)  
**Update Command:** `solo-unicorn self update`