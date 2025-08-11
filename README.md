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
- **Local-first Development**: Uses PGlite (embedded PostgreSQL) - no external database needed for development
- **Day-1 Security**: All endpoints protected with authentication from the start
- **Agent Gateway**: Secure HTTPS/WebSocket gateway for Windows PC agents
- **MCP Protocol**: Model Context Protocol servers for standardized AI agent communication
- **Multi-model Support**: Agents can use different AI models (OpenAI, OpenRouter, Anthropic, etc.)
- **Webhook Notifications**: Support for both in-app and webhook notifications

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + TanStack Router + TailwindCSS + shadcn/ui
- **Backend**: Hono + oRPC + Drizzle ORM
- **Database**: PGlite (dev) / PostgreSQL (production)
- **Runtime**: Bun
- **Auth**: Better Auth with email/password
- **AI**: OpenAI API (voice), configurable LLM providers for agents

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
# Generate BETTER_AUTH_SECRET (minimum 32 characters)
openssl rand -base64 32

# Generate AGENT_AUTH_TOKEN (for agent authentication)
openssl rand -hex 32
```

#### Create Environment File

Create `.env` file in the `apps/server` directory:

```bash
# apps/server/.env

# Auth - REQUIRED
# Generate a secure secret with: openssl rand -base64 32
BETTER_AUTH_SECRET=your-secret-key-here-min-32-chars
BETTER_AUTH_URL=http://localhost:8500

# CORS - Update if using different port
CORS_ORIGIN=http://localhost:8302

# Agent Gateway Authentication
# This token is used to authenticate AI agents connecting to the gateway.
# Generate a secure token with: openssl rand -hex 32
# Share this token with your AI agent configuration (e.g., in Claude Code settings)
AGENT_AUTH_TOKEN=your-agent-token-here

# OpenAI (for voice transcription)
OPENAI_API_KEY=sk-your-openai-api-key

# Optional: Database URL (for production)
# DATABASE_URL=postgresql://user:password@localhost:5432/solo_unicorn

# Optional: OpenRouter (for multi-model support)
# OPENROUTER_API_KEY=your-openrouter-key
```

### 4. Start Development Servers

```bash
bun dev
```

This will start:
- **Web App**: http://localhost:8302
- **API Server**: http://localhost:8500

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

#### Setting Up Agent Authentication

1. **Generate a Secure Token** (if you haven't already):
   ```bash
   openssl rand -hex 32
   ```

2. **Add to Server Environment**:
   - Add the token to `apps/server/.env` as `AGENT_AUTH_TOKEN`

3. **Configure Your AI Agent**:
   - **For Claude Code**: Add to your project's `.claudecode/config.json` or as an environment variable
   - **For Windsurf/Cursor**: Set in the extension settings
   - **For Custom Agents**: Include in the `Authorization` header as `Bearer <token>`

4. **Create an Agent in Solo Unicorn**:
   - Go to Agents page and create a new agent
   - Choose role (PM, Designer, Architect, Engineer, QA)
   - Select runtime (Windows Runner or Cloud)
   - Note the Agent ID for configuration

5. **Agent API Endpoints**:
   - Agent Gateway: `http://localhost:8500/agent/*`
   - MCP Server: `http://localhost:8500/mcp/*`
   - WebSocket: `ws://localhost:8500/agent/ws` (for real-time updates)

### Voice Input

Voice input is available on:
- Task description fields
- Message inputs
- Any textarea with the microphone icon

Requirements:
- Microphone permissions in browser
- OpenAI API key configured

## 🔒 Security Best Practices

### Environment Variables

1. **Never commit `.env` files to version control**
   - Add `.env` to your `.gitignore`
   - Use `.env.example` for templates

2. **Use Strong Secrets**:
   ```bash
   # Generate strong BETTER_AUTH_SECRET (minimum 32 characters)
   openssl rand -base64 32
   
   # Generate strong AGENT_AUTH_TOKEN
   openssl rand -hex 32
   ```

3. **Rotate Tokens Regularly**:
   - Change `AGENT_AUTH_TOKEN` if compromised
   - Update all connected agents with new token
   - Consider using different tokens for different environments

4. **Secure Your Deployment**:
   - Always use HTTPS in production
   - Set appropriate CORS origins
   - Use environment-specific configurations
   - Enable rate limiting for API endpoints

## 🔧 Configuration

### Database Options

**Development (Default)**:
- Uses PGlite (embedded PostgreSQL in WASM)
- No configuration needed
- Data stored locally in browser

**Production**:
- Set `DATABASE_URL` in environment variables
- Supports any PostgreSQL database
- Recommended: Supabase or local PostgreSQL

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

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill all development processes
pkill -f bun
pkill -f vite

# Restart
bun dev
```

### Database Connection Issues

- For development: No configuration needed (PGlite)
- For production: Verify `DATABASE_URL` is correct
- Check PostgreSQL is running and accessible

### Voice Input Not Working

1. Check browser microphone permissions
2. Verify `OPENAI_API_KEY` is set
3. Ensure HTTPS in production (required for getUserMedia)

## 📝 Development

### Project Structure

```
solo-unicorn/
├── apps/
│   ├── server/           # Backend API
│   │   ├── src/
│   │   │   ├── db/       # Database schema & migrations
│   │   │   ├── routers/  # API endpoints
│   │   │   ├── gateway/  # Agent gateway
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
bun check-types      # TypeScript type checking

# Database
bun db:push          # Push schema to database
bun db:studio        # Open Drizzle Studio
bun db:generate      # Generate migrations
bun db:migrate       # Run migrations
```

## 🚢 Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Configure build settings:
   - Build Command: `bun build`
   - Output Directory: `apps/web/dist`
   - Install Command: `bun install`

### Docker Deployment

```dockerfile
# Dockerfile example
FROM oven/bun:1.0
WORKDIR /app
COPY . .
RUN bun install
RUN bun build
EXPOSE 3000
CMD ["bun", "run", "start"]
```

## 🤝 Contributing

This is a solo project optimized for single-user usage, but contributions are welcome!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🆘 Support

- Check the [requirements.md](docs/requirements.md) for detailed specifications
- Open an issue on GitHub for bugs or feature requests
- Review the codebase - it's self-documenting with TypeScript

## 🎯 Roadmap

- [ ] Multiple concurrent agents
- [ ] Advanced Git integration
- [ ] CI/CD pipeline orchestration
- [ ] Vector search for requirements
- [ ] Mobile app (React Native)
- [ ] Multi-user support (post-MVP)

---

Built with ❤️ for solo developers who think big and ship fast 🚀
