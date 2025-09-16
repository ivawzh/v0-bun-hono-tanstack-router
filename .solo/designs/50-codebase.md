# Codebase Convention Design

## Mission Workflow
- Missions live in `.solo/missions/*.mission.md`. Treat each as the authoritative brief for scope, tasks, tests, and file targets.
- Track active work in `.solo/missions/current-state.md`: update **Active mission**.
- If there is any design change, ./solo/designs/ documentations must be updated before commits land; mission requirements call for Mermaid diagrams when visualising flows.

## Repo Structure
```plaintext
solo-unicorn/
├─ apps/
│  ├─ web/                         # React 19 + Vite web app (mission-first UI)
│  │  ├─ src/
│  │  │  ├─ shared/               # primitives, hooks, services, utils, theme tokens
│  │  │  ├─ features/             # feature folders (mission, chore, workstation, notifications, search)
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
- Mission backlog stays healthy via the Chore service—Todo Chore panel surfaces templates instead of loop hacks
- Favor pure functions for business rules; create adapters for I/O and side effects
- Keep files lean (<300 lines) and feature folders cohesive; extract to shared modules only after 3 usages
- Prefer named exports and direct imports; avoid barrels to keep tree-shaking predictable
- Tests and docs update alongside code; PR checklist enforces spec-to-implementation parity
- Every development step starts with an opt-in MSW API mock; UI must expose a "Mock API" toggle stored in `localStorage` so teammates can switch between real and mocked endpoints

## Testing Guidance
- Default to Bun test runner for unit/integration tests across server, web, and CLI.
- Run `bun typecheck` after structural changes; mission tasks typically specify additional suites.
- Prior to handoff or completion, annotate the mission log with test evidence (commands run, outcomes).

## Tech Stack
| Category | Technology | Version | Purpose | Notes |
| --- | --- | --- | --- | --- |
| Language | TypeScript | 5.x | Shared typing across web/server/CLI | `strict` true, no `any` without justification |
| Runtime | Bun | 1.2+ | Server + CLI runtime, bundler | Align CLI and server tooling |
| Backend Framework | Hono + oRPC | latest | HTTP routing, RPC + OpenAPI generation | Single entrypoint, typed handlers |
| Frontend Framework | React | 19 | Mission-first UI with Suspense | TanStack Router/Query |
| Data Store | PostgreSQL + Drizzle | 15 / latest | Mission + org data | Reversible migrations, typed schema |
| Realtime | Monster Realtime | latest | Presence & mission events | Push-only, offline chore resiliency |
| Auth | Monster Auth | latest | OAuth + token issuance | Cookie + PAT support |
| Styling | TailwindCSS v4 + shadcn/ui | latest | UI theming | Install via MCP tooling |

## Environment Variables
- Never read from `process.env.*` or `import.meta.env.*` in application code. Every runtime must funnel through `apps/<appname>/env.ts#getEnv` so values stay typed, validated, and stage-aware in one place.
- `.env` files are **development only**; they seed `getEnv('development' | 'test')`. Production-like stages (`alpha`, `production`) fetch configuration from provisioned infrastructure bindings instead.
- When new configuration is needed, extend the appropriate `getEnv` return value and validation guardrails in that file. Document intent inline so the contract remains obvious to teammates.
- Example usage:

```ts
// apps/server/src/lib/monster-auth.ts
import { getEnv } from '../../env'

const env = getEnv(process.env.SST_STAGE)

export function createAuthClient() {
  return new MonsterAuthClient({
    baseUrl: env.monsterAuthUrl,
  })
}
```

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
- Chore behaviour (config, templates, runs) must stay consistent across docs and code—update all relevant specs when touching it, including Todo Chore rendering and rotation hints
- Mission Modal stays source of truth for mission details; Mission Room pages should not diverge
- Keep doc diagrams in Mermaid and refresh when structural changes happen
- Always accompany behavior changes with updated acceptance criteria or tests

## Automated Tests
- Flow unit tests validate mission progression + review outcomes
- Workstation assignment integration tests ensure queue fairness
- API contract tests guard `/api/v1` responses + error codes
- CLI smoke tests cover login → mission accept → completion roundtrip
- Notification sync tests keep unread counts consistent across channels
- Chore tests cover threshold triggers, rotation weights, minimum wait enforcement, accept/discard flows, and Chore panel rendering when backlog is empty
