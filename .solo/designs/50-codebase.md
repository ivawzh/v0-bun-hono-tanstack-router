# Codebase Convention Design

## Repo Structure
```plaintext
solo-unicorn/
├─ apps/
│  ├─ web/                         # React 19 + Vite web app (mission-first UI)
│  │  ├─ src/
│  │  │  ├─ shared/               # primitives, hooks, services, utils, theme tokens
│  │  │  ├─ features/             # feature folders (mission, mission-fallback, workstation, notifications, search)
│  │  │  ├─ routes/               # TanStack Router routes per shell (launchpad, project, public)
│  │  │  └─ lib/                  # presentation helpers (formatters, charts)
│  │  ├─ public/
│  │  ├─ env.ts                   # typed env reader
│  │  └─ vite.config.ts
│  ├─ server/                     # Bun + Hono server (oRPC + /api + MCP tools)
│  │  ├─ src/
│  │  │  ├─ index.ts              # bootstrap, middlewares, routes mount
│  │  │  ├─ lib/                  # context, orpc setup, auth adapters, telemetry helpers
│  │  │  ├─ routers/              # rpc.ts, api.ts, resource routers, webhook handlers
│  │  │  ├─ services/             # domain logic (missions, projects, notifications, access)
│  │  │  ├─ validators/           # zod schemas per boundary
│  │  │  ├─ db/                   # drizzle client, schema definitions, migrations
│  │  │  └─ utils/                # server-only helpers (idempotency, background jobs)
│  │  ├─ env.ts                   # typed env loader
│  │  └─ drizzle.config.ts
│  ├─ cli/                        # Bun CLI (single-file build target)
│  │  ├─ src/
│  │  │  ├─ commands/            # auth, workstation, mission, repo, notifications, access
│  │  │  ├─ services/            # configStore, mcpClient, realtimeClient, worktree, tunnel
│  │  │  ├─ instrumentation/     # logging, metrics stubs, tracing hooks
│  │  │  └─ index.ts             # command registration + yargs setup
│  │  └─ tsconfig.json
├─ .solo/designs/                 # SOLO50 design specifications (keep current)
├─ scripts/                       # helper scripts (db, lint, release)
├─ package.json                   # workspace definitions, scripts
├─ bunfig.toml
└─ tsconfig.json                  # base TS config
```

## Principles
- Ship trust: every change surfaces human-friendly copy, context, and undo clues
- Mission-first mindset: code gravitates toward mission/workstation flows and shared services
- Mission backlog stays healthy via Mission Fallback—Todo Fallback panel surfaces templates instead of loop hacks
- Favor pure functions for business rules; create adapters for I/O and side effects
- Keep files lean (<300 lines) and feature folders cohesive; extract to shared modules only after 3 usages
- Prefer named exports and direct imports; avoid barrels to keep tree-shaking predictable
- Tests and docs update alongside code; PR checklist enforces spec-to-implementation parity
- Every development step starts with an opt-in MSW API mock; UI must expose a "Mock API" toggle stored in `localStorage` so teammates can switch between real and mocked endpoints

## Tech Stack
| Category | Technology | Version | Purpose | Notes |
| --- | --- | --- | --- | --- |
| Language | TypeScript | 5.x | Shared typing across web/server/CLI | `strict` true, no `any` without justification |
| Runtime | Bun | 1.2+ | Server + CLI runtime, bundler | Align CLI and server tooling |
| Backend Framework | Hono + oRPC | latest | HTTP routing, RPC + OpenAPI generation | Single entrypoint, typed handlers |
| Frontend Framework | React | 19 | Mission-first UI with Suspense | TanStack Router/Query |
| Data Store | PostgreSQL + Drizzle | 15 / latest | Mission + org data | Reversible migrations, typed schema |
| Realtime | Monster Realtime | latest | Presence & mission events | Push-only, offline fallback |
| Auth | Monster Auth | latest | OAuth + token issuance | Cookie + PAT support |
| Styling | TailwindCSS v4 + shadcn/ui | latest | UI theming | Install via MCP tooling |

## Commands & Tools
- Install deps — `bun install`
- Start all apps — `bun dev`
- Web only — `bun dev:web`
- Server only — `bun dev:server`
- Type check — `bun typecheck`
- Lint — `bun lint`
- Lint (fix) — `bun lint:fix`
- Tests (all) — `bun test`
- DB push (dev) — `bun db:push`
- DB migrate (prod) — `bun db:migrate`
- Build — `bun build`

## Agent Rules
- Update `.solo/designs/20-gui/web.md` whenever UI flows, surfaces, or navigation change
- Reflect new CLI commands or flags in `.solo/designs/25-non-graphical-client-interfaces/cli.md`
- Document new features, flows, or scope adjustments in `.solo/designs/10-features.md`
- Persist schema updates, new tables, or payload changes in `.solo/designs/30-data.md`
- When adding or altering endpoints/events, sync `.solo/designs/40-server-interfaces.md`
- Mission Fallback behaviour (config, templates, runs) must stay consistent across docs and code—update all relevant specs when touching it, including Todo Fallback rendering
- Mission Modal stays source of truth for mission details; Mission Room pages should not diverge
- Keep doc diagrams in Mermaid and refresh when structural changes happen
- Always accompany behavior changes with updated acceptance criteria or tests

## Automated Tests
- Flow unit tests validate mission progression + review outcomes
- Workstation assignment integration tests ensure queue fairness
- API contract tests guard `/api/v1` responses + error codes
- CLI smoke tests cover login → mission accept → completion roundtrip
- Notification sync tests keep unread counts consistent across channels
- Mission Fallback tests cover threshold triggers, template selection, accept/discard flows, and Fallback panel rendering when backlog is empty
