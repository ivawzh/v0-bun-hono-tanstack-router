# Solo Unicorn 🦄

A powerful web-based, agent-tasked workflow application with a Kanban-like GUI for creating and dispatching coding tasks to AI agents. Built for solo developers who want to leverage AI to accelerate their development workflow.

## 🚀 Features

### Core Functionality

- **Project & Board Management**: Organize work across multiple projects with Kanban boards
- **Task Lifecycle Management**: Full task tracking from kickoff → spec → design → dev → qa → done
- **AI Agent Integration**: Connect Windows PC or cloud-based AI agents to execute tasks
- **Real-time Collaboration**: Human-in-the-loop controls with pause/resume and Q&A
- **Voice Input**: Speech-to-text using OpenAI Whisper API for hands-free input
- **Requirements Management**: Database-stored requirements with version control and future vector search support

### Technical Features

- **Day-1 Security**: All endpoints protected with authentication from the start
- **Agent Orchestration**: Secure WebSocket connection for agent-to-server communication
- **MCP Stateless Server**: Model Context Protocol servers for standardized AI agent communication
- **Multi-model Support**: multiple code agents, supporting Claude Code, Cursor CLI, etc.

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + TanStack Router + TailwindCSS + shadcn/ui
- **Backend**: Hono + oRPC + Drizzle ORM
- **Database**: PostgreSQL
- **Runtime**: Bun
- **Auth**: Monster Auth with Google OAuth
- **AI**: Claude Code, Cursor CLI

## Dev URLs

1. Solo Unicorn web: <http://localhost:8302>
1. Claude Code UI web: <http://localhost:8303>
1. Solo Unicorn API: <http://localhost:8500>
1. Claude Code UI WS (for AI to server comm): <ws://localhost:8501>
1. Solo Unicorn WS (for server to frontend realtime comm): <ws://localhost:8500>
1. Solo Unicorn stateless MCP (for AI to server comm): <http://localhost:8500/mcp>

## 📋 Prerequisites

- [Bun](https://bun.sh) v1.0+ (JavaScript runtime)
- Node.js 18+ (for some dependencies)
- Git

## 🏃‍♂️ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/solo-unicorn.git
cd solo-unicorn
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Set Up Environment Variables

#### Generate Secure Secrets

Before setting up your environment variables, generate secure secrets:

```bash
# Generate AGENT_AUTH_TOKEN (for agent authentication)
openssl rand -hex 32
```

#### Create Environment File

Create `.env` file in the `apps/server` directory:

```bash
# apps/server/.env

# Auth - REQUIRED
# Monster Auth configuration
MONSTER_AUTH_URL=https://auth.monstermake.limited
HOST=localhost:8500

# CORS - Update if using different port
CORS_ORIGIN=http://localhost:8302

# Agent Gateway Authentication
# This token is used to authenticate AI agents connecting to the gateway.
# Generate a secure token with: openssl rand -hex 32
# Share this token with your AI agent configuration (e.g., in Claude Code settings)
AGENT_AUTH_TOKEN=your-agent-token-here

# OpenAI (for voice transcription)
OPENAI_API_KEY=sk-your-openai-api-key

# Database URL (recommended for stability)
# For local PostgreSQL:
DATABASE_URL=postgresql://$USER@localhost:5432/solo_unicorn_dev
# For production:
# DATABASE_URL=postgresql://user:password@host:5432/database

# Optional: OpenRouter (for multi-model support)
# OPENROUTER_API_KEY=your-openrouter-key
```

### 4. Start Development Servers

```bash
bun dev
```

This will start:

- **Web App**: <http://localhost:8302>
- **API Server**: <http://localhost:8500>

> Note: If ports are in use, the web app will automatically find the next available port

## 🎯 Getting Started Guide

### Creating Your First Project

1. **Sign Up/Login**: Create an account using email and password
2. **Create a Project**: Click "New Project" and give it a name
3. **Add a Board**: Each project can have multiple boards for different workflows
4. **Create Tasks**: Add tasks to your board and organize them by status

### Working with Tasks

Tasks have two dimensions:

- **Status**: Todo → In Progress → Blocked → Paused → Done
- **Stage**: Kickoff → Spec → Design → Dev → QA → Done

Each task includes:

- Description (Markdown supported)
- Priority (0-10)
- Checklist items per stage
- Messages and conversations
- Questions (for agent-human interaction)
- Artifacts (links, files, diffs, logs)
- Activity timeline

### Connecting AI Agents

#### Understanding AGENT_AUTH_TOKEN

The `AGENT_AUTH_TOKEN` is a shared secret that authenticates AI agents (like Claude Code, Windsurf, or custom agents) when they connect to your Solo Unicorn instance. This ensures only authorized agents can:

- Retrieve tasks assigned to them
- Submit work artifacts and logs
- Ask questions and receive answers
- Update task status

#### Setting Up Claude Code with MCP

Solo Unicorn provides MCP (Model Context Protocol) integration for seamless Claude Code connectivity:

1. **Configure Server**
   Copy env var from `apps/server/.env`

   ```bash
   AGENT_AUTH_TOKEN=your-generated-token-here
   ```

2. **Add MCP Server to Claude Code**

   ```bash
   # Remove existing configuration
   claude mcp remove solo-unicorn

   # Add with proper headers and authentication to user scope (apply to all projects)
   claude mcp add-json solo-unicorn '{"type":"http","url":"http://localhost:8500/mcp","headers":{"Authorization":"Bearer <AGENT_AUTH_TOKEN>","Accept":"application/json, text/event-stream"}}' -s user

   # Verify connection
   claude mcp list
   ```

This ensures Claude Code sends the required `Accept` headers and proper authentication token that Solo Unicorn's MCP server expects.

## 🔧 Configuration

### Database Setup

#### Local PostgreSQL Setup (Recommended)

Due to stability issues with PGlite, we recommend using local PostgreSQL for development:

1. **Install PostgreSQL** (if not already installed):

   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql

   # macOS
   brew install postgresql

   # Windows WSL
   sudo apt-get install postgresql
   ```

2. **Create Development Database**:

   ```bash
   # Create development database
   bun run --filter server db:create
   # Or specify custom database name
   DB_NAME=my_db bun run --filter server db:create
   ```

3. **Set Database URL** in `apps/server/.env`:

   ```bash
   DATABASE_URL=postgresql://your_username@localhost:5432/solo_unicorn_dev
   ```

4. **Push Schema to Database**:

   ```bash
   bun run --filter server db:push
   ```

#### Test Database Setup

For running tests with a separate database:

```bash
# Create test database
bun run --filter server db:create:test

# Push schema to test database
bun run --filter server db:push:test

# Or use custom test database URL
DATABASE_TEST_URL=postgresql://user@localhost:5432/my_test_db bun run --filter server db:push:test
```

#### Database Management Scripts

```bash
# Create databases (uses current system user)
bun run --filter server db:create        # Creates solo_unicorn_dev
bun run --filter server db:create:test   # Creates solo_unicorn_test

# Drop databases (use with caution)
bun run --filter server db:drop          # Drops solo_unicorn_dev
bun run --filter server db:drop:test     # Drops solo_unicorn_test

# Push schema (applies changes without migrations)
bun run --filter server db:push          # To dev database
bun run --filter server db:push:test     # To test database

# Run migrations
bun run --filter server db:migrate       # Run on dev database
bun run --filter server db:migrate:test  # Run on test database

# Open database studio
bun run --filter server db:studio        # Visual database browser
```

#### PGlite (Embedded PostgreSQL) - Fallback Option

If you prefer not to install PostgreSQL:

- Comment out `DATABASE_URL` in `.env`
- The server will use PGlite (embedded PostgreSQL)
- Data persisted locally under `apps/server/pgdata`
- ⚠️ **Warning**: PGlite may crash with certain operations

**Production**:

- Always use a real PostgreSQL database
- Set `DATABASE_URL` in environment variables
- Recommended: Supabase, AWS RDS, or any PostgreSQL service

### Agent Configuration

Agents can be configured with different AI models:

```javascript
{
  "modelProvider": "openrouter", // or "openai", "anthropic"
  "modelName": "gpt-4",
  "modelConfig": {
    "temperature": 0.7,
    "maxTokens": 4000
  }
}
```

### Task Hooks (Automations)

Task hooks trigger actions on stage changes:

- Create checklists
- Send notifications
- Start/stop agent sessions
- Webhook calls

## 📚 API Documentation

### Main API Routes

- `/rpc/*` - Main application API (oRPC)
- `/api/auth/*` - Authentication endpoints
- `/agent/*` - Agent gateway endpoints
- `/mcp/*` - Model Context Protocol servers

### Agent Gateway Endpoints

```bash
# Register agent
POST /agent/register
Authorization: Bearer <AGENT_AUTH_TOKEN>

# Claim a task
POST /agent/tasks/claim

# Report progress
POST /agent/sessions/:sessionId/progress

# Complete task
POST /agent/sessions/:sessionId/complete
```

### MCP Server Namespaces

- `context.*` - Read project/board/task data
- `cards.*` - Manipulate tasks
- `events.*` - Subscribe to events

## 🔒 Security

- All routes protected with authentication
- Agent endpoints use bearer token authentication
- CORS configured for security
- Environment variables for sensitive data

## 🧪 Testing

### E2E Testing with Playwright

Solo Unicorn includes comprehensive end-to-end tests using Playwright.

#### Setup

1. **Install Playwright browsers**:

   ```bash
   bun test:install
   ```

2. **Create test database**:

   ```bash
   bun run --filter server db:create:test
   bun run --filter server db:push:test
   ```

3. **Verify test database connection**:

   ```bash
   # Test database uses: postgresql://$USER@localhost:5432/solo_unicorn_test
   # Override if needed by setting DATABASE_TEST_URL environment variable
   ```

#### Running Tests

```bash
# Run all E2E tests
bun test:e2e

# Run tests with UI mode (interactive)
bun test:e2e:ui

# Run tests in debug mode
bun test:e2e:debug

# Run tests in headed mode (see browser)
bun test:e2e:headed

# Run specific test file
bun test:e2e e2e/auth.spec.ts

# Run tests in specific browser
bun test:e2e --project=chromium
```

#### Test Coverage

E2E tests cover:

- **Authentication**: Login flow, OAuth callback, protected routes
- **Projects**: CRUD operations, navigation
- **Tasks**: Board management, drag-and-drop, task updates
- **Agent Gateway**: Registration, task claiming, progress reporting

#### Writing New Tests

Tests are located in the `e2e/` directory. Use the following helpers:

```typescript
// Mock authentication
async function mockAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('auth', JSON.stringify({
      user: { id: 'test-id', email: 'test@example.com' },
      token: 'mock-token'
    }));
  });
}

// Use in your tests
test('should do something', async ({ page }) => {
  await mockAuth(page);
  await page.goto('/protected-route');
  // Your test logic
});
```

## 📝 Development

### Project Structure

```
solo-unicorn/
├── apps/
│   ├── server/           # Backend API
│   │   ├── src/
│   │   │   ├── db/       # Database schema & migrations
│   │   │   ├── routers/  # API endpoints
│   │   │   ├── agents/  # Agent management
│   │   │   ├── mcp/      # MCP protocol servers
│   │   │   └── lib/      # Utilities & auth
│   │   └── package.json
│   └── web/              # Frontend application
│       ├── src/
│       │   ├── routes/   # Page components
│       │   ├── components/ # Reusable UI components
│       │   └── utils/    # Client utilities
│       └── package.json
├── docs/
│   └── requirements.md   # Detailed MVP requirements
├── package.json          # Root package file
└── bun.lockb            # Bun lock file
```

### Available Scripts

```bash
# Development
bun dev              # Start all apps in dev mode
bun dev:web          # Start only web app
bun dev:server       # Start only server

# Build
bun build            # Build all apps
bun typecheck      # TypeScript type checking

# Database
bun db:create        # Create solo_unicorn_dev database
bun db:create:test   # Create solo_unicorn_test database
bun db:drop          # Drop solo_unicorn_dev (use with caution)
bun db:drop:test     # Drop solo_unicorn_test
bun db:push          # Push schema to dev database
bun db:push:test     # Push schema to test database
bun db:studio        # Open Drizzle Studio
bun db:generate      # Generate migrations
bun db:migrate       # Run migrations on dev database
bun db:migrate:test  # Run migrations on test database

# Drizzle Migrations (with rollback support)
bun run --filter server migrations:generate   # Generate a migration (name defaults to "init")
bun run --filter server migrations:up         # Apply pending migrations
bun run --filter server migrations:down       # Roll back last batch
bun run --filter server migrations:status     # Show migration status
bun run --filter server migrations:refresh    # Roll back all and re-apply
bun run --filter server migrations:fresh      # Drop all and re-run from zero
bun run --filter server seed:create           # Create a seeder file
bun run --filter server seed:run              # Run seeders
```

### Migrations Setup & Usage

We use `@drepkovsky/drizzle-migrations` to add up/down rollback support on top of Drizzle.

1. Configure environment
   - For Postgres: set `DATABASE_URL` in `apps/server/.env`.
   - For local dev with PGlite, you can still develop without a database; the API auto-applies SQL migrations on startup. To run the CLI migrator, a real `DATABASE_URL` is required.

2. Generate SQL from schema
   - Edit schema in `apps/server/src/db/schema/`
   - Run: `bun run --filter server db:generate`

3. Commit the generated SQL
   - Files are written to `apps/server/src/db/migrations/`

4. Apply or roll back migrations (requires Postgres `DATABASE_URL`)
   - Up: `bun run --filter server migrations:up`
   - Down (last batch): `bun run --filter server migrations:down`
   - Status: `bun run --filter server migrations:status`

5. Auto-apply on startup (dev)
   - The server auto-applies SQL migrations at startup when using PGlite. This keeps dev flows simple while still producing portable SQL for production.

References:

- Drizzle migrations tool: [drepkovsky/drizzle-migrations](https://github.com/drepkovsky/drizzle-migrations)

---

Built with ❤️ for solo developers who think big and ship fast 🚀
