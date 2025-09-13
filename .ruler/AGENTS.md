# AGENTS.md

Centralised AI agent instructions. Add coding guidelines, style guides, and project context here.

Ruler concatenates all .md files in this directory (and subdirectories), starting with AGENTS.md (if present), then remaining files in sorted order.

# v0-bun-hono-tanstack-router Template

This document serves as comprehensive instructions for developers working with this template.

## Tech Stack & Architecture

### Core Technologies
- **Runtime**: Bun (v1.2+)
- **Backend**: Hono + oRPC (both /rpc and /api)
- **Frontend**: React 19 + TanStack Router
- **Database**: PostgreSQL + Drizzle ORM + drizzle-migrations (to support migration rollback)
- **MCP**: stateless HTTP server (@modelcontextprotocol/sdk/server/mcp)
- **Type Safety**: TypeScript
- **Auth**: Monster Auth. Read more at [Monster Auth](/monster-wiki/shared-services/monster-auth.md).
- **Websocket**: Monster Realtime. Read more at [Monster Realtime](/monster-wiki/shared-services/monster-realtime.md).
- **User uploads**: Monster Upload. Read more at [Monster Upload](/monster-wiki/shared-services/monster-upload.md).
- **Styling**: TailwindCSS v4 + shadcn/ui components. Use [Monster Theme](/monster-wiki/theme/monster-theme.md).
- **Build Tools**: Vite (frontend), Bun (backend)
- **CLI**: Bun single-file executable + yargs
- **Deployment**: SST V3

### Project Structure

Monorepo layout (top-level)
```
solo-unicorn/
├─ apps/
│  ├─ web/                         # React + Vite app (UI, PWA)
│  │  ├─ src/
│  │  │  ├─ shared/               # App-shared UI primitives, hooks, utils, constants, theme
│  │  │  │  ├─ components/        # Button, Input, Modal, Toast, Badge, Skeleton
│  │  │  │  ├─ hooks/             # useAuth, useSession, useRPC, useRealtime, useToast
│  │  │  │  ├─ services/          # rpcClient.ts (oRPC client), errorToToast.ts, queryKeys.ts
│  │  │  │  ├─ theme/             # tokens, CSS vars, dark/light mode helpers
│  │  │  │  └─ utils/             # pure utils (ids, formatters)
│  │  │  ├─ features/             # Feature folders combine UI + data glue
│  │  │  │  ├─ mission/           # MissionCard, MissionBoard, MissionModal shell, service fns
│  │  │  │  ├─ project/           # ProjectSettingsModal, forms, service fns
│  │  │  │  └─ workstation/       # WorkstationView, status badges, service fns
│  │  │  ├─ routes/               # TanStack Router routes
│  │  │  ├─ main.tsx, index.css
│  │  │  └─ lib/                  # Presentation-only helpers (no domain)
│  │  ├─ public/
│  │  ├─ env.ts, vite.config.ts, tsconfig.json
│  │  └─ sst-env.d.ts (if used)
│  ├─ server/                      # Bun + Hono app (oRPC + /api)
│  │  ├─ src/
│  │  │  ├─ index.ts              # Server bootstrap (Hono, CORS, route mounts)
│  │  │  ├─ lib/
│  │  │  │  ├─ context.ts         # Request context (session/org/project)
│  │  │  │  ├─ orpc.ts            # oRPC server setup (publicProcedure, guards glue)
│  │  │  │  └─ openauth.ts        # Monster Auth client
│  │  │  ├─ routers/
│  │  │  │  ├─ rpc.ts             # oRPC router mount (/rpc)
│  │  │  │  ├─ api.ts             # API-format mount (/api) (REST-like or verbs), OpenAPI emit
│  │  │  │  ├─ rpc/
│  │  │  │  │  ├─ auth.ts
│  │  │  │  │  ├─ mission.ts      # RPC procedures for mission
│  │  │  │  │  └─ project.ts      # RPC procedures for project
│  │  │  │  └─ others/
│  │  │  │     └─ oauth-callback.ts
│  │  │  ├─ services/             # Domain services (auth, missions, flows, projects)
│  │  │  ├─ validators/           # Zod schemas used on server side
│  │  │  ├─ db/
│  │  │  │  ├─ db.ts
│  │  │  │  ├─ schema/            # Drizzle table definitions
│  │  │  │  └─ migrations/
│  │  │  └─ utils/                # Server-only helpers (intervals, adapters)
│  │  ├─ env.ts, drizzle.config.ts, tsconfig.json
│  │  └─ sst-env.d.ts (if used)
│  ├─ cli/                         # Bun-based CLI (single-file/binary target)
│  │  ├─ src/
│  │  │  ├─ commands/
│  │  │  │  ├─ auth.ts            # login/logout/whoami
│  │  │  │  ├─ workstation.ts     # register/start/stop/status
│  │  │  │  ├─ repo.ts            # repo add/list/remove
│  │  │  │  ├─ agent.ts           # agent scan/list/add
│  │  │  │  └─ status.ts          # combined status output
│  │  │  ├─ services/
│  │  │  │  ├─ configStore.ts     # ~/.solo-unicorn/config.json read/write
│  │  │  │  ├─ mcpClient.ts       # HTTP client to /api (PAT/org key)
│  │  │  │  ├─ realtimeClient.ts  # Monster Realtime wrapper
│  │  │  │  └─ worktree.ts        # git worktree helpers
│  │  │  ├─ bin.ts                # CLI entry (bun build target)
│  │  │  └─ index.ts              # program setup, command registration
│  │  └─ tsconfig.json
│  │
├─ docs/                           # Design/architecture/spec documents
│  ├─ foundation/                  # Source foundational docs (001–006)
│  ├─ architecture.md              # This architecture (authoritative)
│  └─ front-end-spec.md            # UI/UX spec and component inventory
│
├─ solo-unicorn-docs/              # Mission solution/tasks filesystem storage
│  └─ missions/{mission-id}/
│
├─ scripts/                        # Dev/build/release scripts
├─ .bmad-core/                     # BMAD configs/templates
├─ package.json                    # Workspaces (apps/*)
├─ bunfig.toml
└─ tsconfig.json                   # Base TS config
```

Notes on “shared” approach
- Keep it simple: prefer intra-app shared modules (apps/web/src/shared, apps/server/src/validators, etc.).
- Avoid complicated packages/* unless two or more apps truly need the same code.
- Cross-app imports: allowed via relative paths when needed. Example (already used):
  - apps/web/src/utils/orpc.ts imports types from apps/server/src/routers/rpc

Intra-app shared modules
- Web (apps/web/src/shared):
  - components/: consistent primitives (Modal, Toast, Buttons, Inputs, Badge, Skeleton)
  - hooks/: common hooks (useAuth, useSession, useRPC, useRealtime, useToast)
  - services/: rpcClient.ts (oRPC client), errorToToast.ts, queryKeys.ts
  - theme/: tokens, mode toggle helpers
  - utils/: pure helpers
- Server (apps/server/src/services, /validators, /lib):
  - services/: domain logic; keep routers thin
  - validators/: zod schemas
  - lib/orpc.ts: centralize procedure/guard wiring
  - lib/context.ts: session/org/project derivation
- CLI (apps/cli/src/services):
  - configStore.ts for ~/.solo-unicorn/config.json
  - mcpClient.ts (/api HTTP)
  - realtimeClient.ts (presence & push)
  - worktree.ts for git worktree ops

AuthZ patterns (server)
- Guards used in RPC/API handlers:
  - requireUser
  - requireOrgMember(orgId)
  - requireProjectRole(projectId, role)

oRPC usage
- /rpc: RPC-format for internal web; typed client; cache via TanStack Query
- /api: API-format (REST-like or verbs) with OpenAPI generation; consumed by CLI/agents/third parties

Testing strategy
- Web: MSW for /rpc and /api; render helpers under apps/web/src/shared
- Server: import schema/types directly from apps/server/src/db/schema; unit test services
- CLI: integration-style command tests with mocked HTTP and realtime layers

Logo at docs/assets/logo.jpg

## Developer Guidelines

### Environment Variables
- **MUST** use `apps/{appName}/env.ts` for environment variables
- **NEVER** use `process.env` directly in application code
- Environment files are staged-based: development, test, alpha, production

### API Communication Patterns
- **Internal APIs** (`/rpc`): Use oRPC for bundled deployments (web + server deploy together)
- **External APIs** (`/api`): Use oRPC + OpenAPI for backward compatibility (CLI, SDK, external services)
- **WebSocket**: Use Monster Realtime for real-time communication
- **Authentication**: Use OpenAuth with Monster Auth integration

### Code Standards
- Use TypeScript throughout the stack
- Prefer composition over inheritance
- Follow existing code patterns and conventions
- Use Drizzle ORM for all database operations
- Implement proper error handling with Result types

### Database Operations
```bash
# Development workflow
bun db:push          # Push schema changes
bun db:studio        # Open database studio
bun db:migrate       # Run migrations (production)
```

### Development Workflow
```bash
# Start development servers
bun dev              # Start both web and server
bun dev:web          # Web only
bun dev:server       # Server only

# Type checking and linting
bun typecheck        # Check all apps
bun lint             # Lint all code
bun lint:fix         # Auto-fix linting issues

# Building
bun build            # Build all apps
```

### Authentication Integration
- Uses OpenAuth client with configurable OAuth providers
- Implements session management via secure cookies
- Auto-creates user records on first login
- Supports both OAuth (Google) and password authentication

### Project Conventions
- Use kebab-case for file/folder names
- Use PascalCase for React components
- Use camelCase for functions and variables
- Prefer explicit imports over barrel exports
- Always handle error cases with proper typing

### Deployment
- **Alpha**: `bun sst:alpha` (staging environment)
- **Production**: `bun sst:prod` (production environment)
- Uses AWS infrastructure via SST v3
- Automatic database migrations on deployment

## File Organization

### Backend (`apps/server/`)
- `src/index.ts` - Application entry point
- `src/routers/` - API route definitions (rpc/, api/, others/)
- `src/lib/` - Shared utilities and configurations
- `src/db/` - Database schema and connection
- `src/services/` - Business logic services

### Frontend (`apps/web/`)
- `src/routes/` - TanStack Router route definitions
- `src/components/` - React components
- `src/hooks/` - Custom React hooks
- `src/lib/` - Frontend utilities
- `src/utils/` - oRPC client configuration

## Important Notes

### Security
- Never commit secrets to repository
- Use environment variables for all configuration
- Implement proper CORS policies
- Validate all inputs with Zod schemas

### Performance
- Use React 19 features (Suspense, concurrent rendering)
- Implement proper loading states
- Use TanStack Query for data fetching
- Optimize bundle size with proper tree-shaking

### Monitoring & Debugging
- Use structured logging in backend
- Implement proper error boundaries in React
- Use TypeScript strict mode
- Leverage oRPC's built-in type safety

## Commands Reference

### Root Level
```bash
bun dev              # Start all services
bun build            # Build all apps
bun typecheck        # Type check all apps
bun lint             # Lint all code
```

### Database
```bash
bun db:push          # Push schema to database
bun db:studio        # Open Drizzle Studio
bun db:migrate       # Run migrations
```

### Deployment
```bash
bun sst:alpha        # Deploy to alpha stage
bun sst:prod         # Deploy to production
```

This template provides a modern, type-safe, full-stack foundation for building web applications with excellent developer experience and production-ready architecture.



<!-- Source: .ruler/AGENTS.md -->

# AGENTS.md

Centralised AI agent instructions. Add coding guidelines, style guides, and project context here.

Ruler concatenates all .md files in this directory (and subdirectories), starting with AGENTS.md (if present), then remaining files in sorted order.
