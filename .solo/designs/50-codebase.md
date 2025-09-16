# Codebase Conventions

## Scope & Purpose
Defines repository-wide codebase conventions. Covers layout, boundaries, coding standards, testing, dependency rules, security, and performance practices. Not an implementation plan and not an interface or workflow spec.

## Repo Layout

- apps/web — React 19 + Vite + TanStack Router/Query
- apps/server — Bun + Hono; /rpc (oRPC), /api (OpenAPI)
- apps/cli — Bun single-file executable

Shared (intra-app)
- Web: `src/shared/{components,hooks,services,theme,utils}`
- Server: `src/{services,validators,lib}` (lib: `orpc.ts`, `context.ts`)
- CLI: `src/services/{configStore,mcpClient,realtimeClient,worktree}.ts`

```bash
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
├─ .solo/
│  └─ missions/{mission-id}/       # Mission solution/tasks filesystem storage
│
├─ scripts/                        # Dev/build/release scripts
├─ package.json                    # Workspaces (apps/*)
├─ bunfig.toml
└─ tsconfig.json                   # Base TS config
```

## Module Boundaries

- Web
  - Uses `/rpc` only; never calls `/api` directly
  - Network code lives under `src/shared/services` (typed oRPC client)
  - TanStack Query keys centralized in `queryKeys.ts`; mutate → invalidate via helpers
  - Routes under `src/routes`; features under `src/features/{feature}`

- Server
  - Routers in `src/routers/{rpc,api}`; keep handlers thin
  - Services in `src/services` hold domain logic; unit-testable; no HTTP concerns
  - Validation in `src/validators` with zod; validate at the boundary
  - `lib/orpc.ts` centralizes oRPC setup; `lib/context.ts` derives request context
  - Authn via Monster Auth; authz enforced in services (TypeScript)

- CLI
  - Commands in `src/commands`; orchestration-only code
  - HTTP in `src/services/mcpClient.ts`; realtime in `realtimeClient.ts`
  - Local state in `configStore.ts`; git helpers in `worktree.ts`

## Language & Style

- TypeScript everywhere; strict mode
- Interfaces over types; string unions over enums
- Named exports only; import from source files (avoid barrels)
- Function declarations (`function name() {}`), not arrow for top-level
- Indent 2 spaces; single quotes; no semicolons
- Variables in camelCase; React components in PascalCase; files/folders kebab-case
- Keep files ≤ ~300 lines; refactor before exceeding
- Exported functions first; small private helpers per step
- Prefer map/reduce and ts-pattern match; avoid mutations and for-loops when practical
- Comments only for logic/edge cases/trade-offs; no meta/progress comments

## Error Handling & Validation

- Validate inputs at the boundary with zod; return typed errors (no opaque any)
- Prefer Result-style returns or typed error objects across service boundaries
- Do not throw across network boundaries; map to error payloads
- In web, surface errors via shared toast utilities with friendly messages

## Logging & Observability

- Structured logs with levels; attach requestId/session when available
- Avoid logging secrets/PII; sanitize inputs in logs
- Add lightweight health checks where helpful; instrument hotspots pragmatically

## RPC/API Contracts & Cache

- /rpc is internal and breakable; align TanStack Query keys with RPC methods
- /api is versioned and stable; MCP tools call /api over HTTP
- Websocket is push-only (presence, notifications); no request/response RPC over WS

## Database Conventions

- PostgreSQL via Drizzle; migrations tracked and reversible
- IDs use ULIDs (`varchar(26)`) except GitHub repository IDs (BIGINT canonical)
- Validation and permission checks in application layer (TypeScript)
- Hybrid storage for mission artifacts: filesystem docs + DB progress fields
- Add purpose-built indexes for monitoring/assignment; follow documented names
- Use helpers table for DB locking; seed required lock rows in migrations

## Web UI Conventions

- Use shadcn/ui components; install via MCP tools; don’t handcraft equivalents
- Tailwind v4 with semantic tokens; dark/light mode supported
- Components live in `src/shared/components` for primitives; feature UI in `src/features/*`
- Accessibility: target WCAG 2.2 AA; keyboard-first; clear focus states

## CLI Code Organization

- Keep commands minimal; orchestrate via services
- All network and realtime code in services; no direct fetch/WebSocket in commands
- Persist local state under `configStore`; isolate fs interactions

## Testing Strategy

- Web: MSW for /rpc and /api; render helpers under `src/shared`
- Server: unit-test services; import schema/types from db `schema`
- CLI: integration-style tests with mocked HTTP and realtime

## Dependency Management

- Prefer native/platform capabilities; add deps only for clear value
- Avoid creating packages/* unless ≥2 apps need the code
- Apply “Rule of Three” before abstracting; compose over inherit

## Environment & Security

- Use `apps/{app}/env.ts`; never access `process.env` directly
- CORS allowlist; CSRF protection for cookie APIs
- Never commit secrets; store credentials in OS keychain (CLI)
- Sanitize user input and API responses; principle of least privilege

Environments (domains)
- Production: web `https://solounicorn.lol`, server `https://server.solounicorn.lol`, Monster Auth `https://auth.monstermake.limited`
- Alpha: web `https://alpha.solounicorn.lol`, server `https://server.alpha.solounicorn.lol`, Monster Auth `https://auth.alpha.monstermake.limited`
- Development/Test: require env vars `VITE_WEB_URL`, `VITE_SERVER_URL`, `DATABASE_URL`

## Performance Principles

- Index hot queries; serve public content with CDN + caching headers
- Web: use skeletons, optimistic updates where safe, reconcile via realtime
- Respect simplicity over micro-optimizations; revisit after MVP
