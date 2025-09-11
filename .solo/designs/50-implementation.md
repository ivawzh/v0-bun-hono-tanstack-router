# Implementation Design & Conventions

## Repo Structure

```
solo-unicorn-v0/
├── apps/
│   ├── server/                 # Bun + Hono backend (/rpc + /api endpoints per .solo/designs/40-server-interfaces.md)
│   │   ├── src/
│   │   │   ├── routers/
│   │   │   │   ├── rpc.ts      # oRPC internal routes for web app
│   │   │   │   ├── api.ts      # REST/verb-based API for MCP/CLI/third parties
│   │   │   │   └── others/     # OAuth callbacks, health checks
│   │   │   ├── services/       # Domain logic and business rules
│   │   │   ├── db/            # Drizzle schema and migrations
│   │   │   ├── utils/         # Pure utilities (validation, formatting)
│   │   │   └── index.ts       # Bootstrap, CORS, Monster integration
│   │   └── package.json
│   └── web/                   # React + Vite frontend (TanStack Router/Query per .solo/designs/02-ui/web.md)
│       ├── src/
│       │   ├── routes/        # File-based routing via TanStack Router
│       │   ├── components/    # Reusable UI components (Kanban, Mission cards, etc.)
│       │   ├── utils/         # Client utilities and oRPC client
│       │   ├── hooks/         # React hooks and state management
│       │   └── theme/         # Design tokens, CSS vars, style system
│       └── package.json
├── packages/                  # Shared packages (minimal; prefer direct imports)
│   ├── types/                # Shared TypeScript types
│   └── config/               # Shared configuration and constants
├── monster-wiki/             # Git submodule for Monster services docs/theme
├── .solo/designs/            # This SOLO50 documentation framework
│   ├── 10-features.md
│   ├── 02-ui/web.md
│   ├── 30-data.md
│   ├── 40-server-interfaces.md
│   └── 50-implementation.md
├── docs/                     # Legacy foundation docs (migrated to .solo/designs/)
├── scripts/                  # Build, deployment, and development scripts
├── package.json              # Root workspace configuration
└── README.md                 # Project overview and quick start
```

## Principles

- **Interface Boundaries First** - Web→/rpc, MCP/CLI→/api, Realtime→push-only WebSocket (strict adherence per .solo/designs/40-server-interfaces.md)
- **MCP-First Design** - All domain operations exposed as MCP tools; REST endpoints delegate to tools where applicable
- **SOLO50 Compliance** - Update design docs when changing public behavior; reflect new screens/flows in .solo/designs/02-ui/*; update data schemas in .solo/designs/30-data.md when persisting new fields
- **Workstation-Centric Architecture** - Organizations own workstations; workstations contain agents; real-time presence drives mission assignment
- **Hybrid Storage Strategy** - PostgreSQL for operational data; filesystem for mission artifacts; Monster services for auth/realtime
- **Permission-Aware APIs** - Graceful degradation based on authentication; no errors for insufficient permissions, just filtered responses
- **Performance-First Database** - Indexes optimized for high-frequency monitoring and complex mission assignment queries

## Tech Stack

| Category | Technology | Version | Purpose | Notes |
|----------|------------|---------|---------|-------|
| Backend Runtime | Bun | ^1.1.0 | Server runtime and package manager | Fast startup, built-in bundler |
| Backend Framework | Hono | ^4.0.0 | HTTP framework with oRPC integration | Lightweight, fast routing |
| Frontend Runtime | Node.js | ^20.0.0 | Development and build tooling | LTS version for stability |
| Frontend Framework | React | ^18.3.0 | UI library with hooks and context | Mature ecosystem |
| Frontend Build | Vite | ^5.0.0 | Fast build tool and dev server | HMR, TypeScript support |
| Frontend Router | TanStack Router | ^1.0.0 | File-based routing with type safety | Replaces React Router |
| Frontend State | TanStack Query | ^5.0.0 | Server state management and caching | oRPC integration |
| Database | PostgreSQL | ^16.0.0 | Primary data store | Performance indexes |
| Database ORM | Drizzle | ^0.30.0 | Type-safe SQL and migrations | Better TypeScript than Prisma |
| Styling | Tailwind CSS | ^3.4.0 | Utility-first CSS framework | Consistent design tokens |
| Type System | TypeScript | ^5.4.0 | Static typing for both frontend and backend | Strict configuration |
| Authentication | Monster Auth | latest | OAuth and token management | External service |
| Real-time | Monster Realtime | latest | WebSocket presence and push | External service |
| Deployment (Alpha) | SST | ^3.0.0 | Infrastructure as code | AWS deployment |
| Deployment (Prod) | AWS | latest | Production infrastructure | RDS, ECS, CloudFront |

## Commands & Tools

- **Development** — `bun run dev` (starts both server and web with concurrency)
- **Web Development** — `bun run dev:web` (web app only with HMR)
- **Server Development** — `bun run dev:server` (API server only with watch)
- **Build Production** — `bun run build` (builds both apps for deployment)
- **Database Migration** — `bun run db:migrate` (apply pending Drizzle migrations)
- **Database Reset** — `bun run db:reset` (reset to clean state + seed data)
- **Type Check** — `bun run typecheck` (TypeScript validation across workspace)
- **Lint** — `bun run lint` (ESLint + Prettier across workspace)
- **Test Unit** — `bun run test` (Vitest for unit tests)
- **Test E2E** — `bun run test:e2e` (Playwright for integration tests)
- **CLI Build** — `bun run build:cli` (compile solo-unicorn CLI for distribution)
- **Deploy Alpha** — `bun run deploy:alpha` (SST deployment to alpha environment)
- **Deploy Production** — `bun run deploy:prod` (production deployment pipeline)

## Agent Rules

- **Design Doc Updates** - Update endpoint and payload field lists in .solo/designs/40-server-interfaces.md when changing public behavior
- **UI Flow Documentation** - Reflect new screens/flows in .solo/designs/02-ui/* and link from .solo/designs/10-features.md
- **Data Schema Updates** - Update data schemas in .solo/designs/30-data.md when persisting new fields
- **Interface Boundary Enforcement** - Never mix /rpc and /api patterns; maintain strict separation per architecture
- **MCP Tool Priority** - When adding new domain operations, create MCP tools first, then REST adapters if needed
- **Performance Awareness** - Consider index requirements when adding database queries; update monitoring queries if needed
- **Permission Integration** - Implement permission checks in application layer (TypeScript), not SQL; ensure graceful degradation
- **Real-time Integration** - Add Monster Realtime events for user-visible state changes; document in .solo/designs/40-server-interfaces.md
- **Type Safety** - Maintain TypeScript types across oRPC, MCP tools, and database schemas
- **Monster Services** - Use Monster Auth for authentication, Monster Realtime for presence/push; avoid duplicate implementations
- **Testing Strategy** - Write unit tests for services, integration tests for API endpoints, E2E tests for critical user flows
- **CLI Integration** - Consider workstation implications when changing mission assignment or repository management
- **Documentation Sync** - Keep .solo/designs/ docs synchronized with implementation; use as single source of truth for AI context

### Development Workflow Rules

- **Feature Development** - Start with design doc updates in .solo/designs/, then implement following interface boundaries
- **Database Changes** - Create Drizzle migration, update .solo/designs/30-data.md, verify index performance
- **API Changes** - Update .solo/designs/40-server-interfaces.md first, implement with versioning consideration
- **UI Changes** - Reference .solo/designs/02-ui/web.md for patterns, update wireframes if adding new components
- **Monster Integration** - Test auth flows in alpha environment; verify WebSocket channels match documentation
- **Performance Testing** - Monitor mission assignment query performance; database indexes critical for real-time operation
- **Security Review** - Ensure no credentials logged; verify permission boundaries; test public API rate limiting

### Code Generation Guidelines

- **oRPC Methods** - Follow TanStack Query cache key patterns; include real-time channel info in responses
- **MCP Tools** - Use semantic versioning (mission.v1.*); delegate to HTTP APIs for consistency
- **React Components** - Follow design system patterns from .solo/designs/02-ui/web.md; use Tailwind utilities
- **Database Queries** - Use Drizzle query builder; consider performance impact on monitoring queries
- **Monster Auth** - Use email as canonical identity; support multiple OAuth providers per user
- **WebSocket Events** - Follow channel naming conventions; include minimal payload for bandwidth efficiency
- **Error Handling** - Graceful degradation for permissions; structured error responses for debugging

### Autonomous Development Standards

- **Self-Documenting** - Code changes automatically reflect in .solo/designs/ documentation
- **Performance-Aware** - Database query additions consider impact on 10-second monitoring cycles
- **Permission-Compliant** - New features respect public project access control and role hierarchies
- **Real-time Integrated** - User-visible changes trigger appropriate Monster Realtime events
- **Cross-Platform** - Consider CLI, web, and mobile implications for all feature changes
- **Monster-Native** - Leverage Monster services rather than building duplicate functionality
- **Type-Safe** - Maintain TypeScript consistency across all interface boundaries
- **SOLO50-Compliant** - Design documentation drives implementation; code follows documented patterns
