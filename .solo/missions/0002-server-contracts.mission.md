# Mission 0002 - Server Contracts & Mock Services

## Mission Goal
Implement ORPC and REST handlers that expose the domain contracts from Mission 0001 with deterministic in-memory data so web missions can build UX without waiting for persistence.

## Why This Matters
- Frontend missions (0003–0008) rely on predictable APIs; mocks let them iterate quickly.
- Early contract validation flushes gaps before we invest in database migrations.
- CLI and automation will consume the OpenAPI endpoints, so we must publish a consistent spec.

## Current Context
- **Previous mission**: `0001-domain-architecture` delivered `packages/domain-schema` and documentation describing entities and invariants.
- **Next mission**: `0003-client-shell` will consume these endpoints to build the application shell and data hooks.

## Deliverables
- ORPC router modules exposing read/write operations for organizations, projects, missions, mission templates, workstations, repositories, notifications, and access requests.
- OpenAPI routes mirroring the ORPC operations needed by CLI/automation.
- In-memory data stores seeded from JSON fixtures with deterministic ids stored in `apps/server/src/mocks/`.
- Contract tests proving ORPC → mock store returns shapes matching `packages/domain-schema` interfaces.
- Updated API documentation referencing endpoint paths and behaviours.

## Out of Scope
- Talking to any real database, queue, or external API.
- Implementing authentication logic beyond trusting `context.session`.
- Realtime events or web socket integrations.

## Dependencies
- `packages/domain-schema` created in Mission 0001.
- Hono + ORPC setup already present in `apps/server/src/index.ts`.

## Constraints & Guardrails
- Keep mock state idempotent between requests (reset store each request or expose debug reset route behind `NODE_ENV=development`).
- Ensure write operations validate payloads using the shared schema; reject invalid stage transitions with descriptive errors.
- Structure routers per domain area (e.g. `apps/server/src/routers/rpc/organizations.ts`).

## Kickoff Checklist
Create `kickoffs/0002-server-contracts.kickoff.md` and follow the four standard steps with human confirmation before proceeding.

## Tasks
- [ ] Task 1: Seeded Mock Data Layer
  - Description: Create deterministic JSON fixtures and an in-memory repository abstraction to load them.
  - Acceptance Criteria: `apps/server/src/mocks/data/*.json` covering organizations, projects, missions, workstations, repositories, templates, notifications, accessRequests. `apps/server/src/mocks/store.ts` provides typed getters/mutators with simple locking to prevent concurrent writes in dev.
  - Implementation Notes: Use `packages/domain-schema` factories to generate ids; maintain relationships (project ids on missions, org ids on projects). Include helper to clone deep objects so responses remain immutable.
  - File Targets: `apps/server/src/mocks/data/*.json`, `apps/server/src/mocks/store.ts`, `apps/server/src/mocks/index.ts`.
  - Validation: Bun unit tests at `apps/server/test/mocks.test.ts` confirm referential integrity (mission.projectId exists, etc.).
  - Log:
- [ ] Task 2: ORPC Routers
  - Description: Build typed routers for each domain area with read/write operations that delegate to the mock store.
  - Acceptance Criteria: New router modules under `apps/server/src/routers/rpc/` (e.g. `organizations.ts`, `projects.ts`, `missions.ts`, `workstations.ts`, `agents.ts`, `notifications.ts`, `config.ts`). `rpcRouter` composes them. Each handler enforces domain invariants (e.g. mission stage transitions, fallback template acceptance) via helper functions.
  - Implementation Notes: Use ts-pattern to branch on mission stage updates, ensure updates return fresh snapshots. Include pagination support for discovery endpoints even if data is small.
  - File Targets: `apps/server/src/routers/rpc/*.ts`, updated `apps/server/src/routers/rpc.ts`.
  - Validation: Contract tests in `apps/server/test/rpc-contract.test.ts` hitting each route and zod-validating responses against domain schema.
  - Log:
- [ ] Task 3: REST/OpenAPI Surface
  - Description: Mirror the ORPC routers with OpenAPI definitions for CLI and external integration.
  - Acceptance Criteria: New `apps/server/src/routers/api/*.ts` modules exposing RESTful endpoints for read-only operations and queueing write requests. Update OpenAPI handler to include tag/summary metadata. Generate JSON spec stored under `apps/server/openapi.json` (git-tracked) for future distribution.
  - Implementation Notes: Use ORPC `os` builder as seen in `api.ts`. Provide error payload structure `{ error: { code, message, traceId } }` aligning with FEAT-014 requirements early.
  - File Targets: `apps/server/src/routers/api/*.ts`, `apps/server/src/routers/api.ts`, `apps/server/openapi.json`.
  - Validation: `bun test apps/server/test/api-contract.test.ts`; manual verification via `bun dev:server` hitting `/api/v1/...` endpoints.
  - Log:
- [ ] Task 4: Developer Docs
  - Description: Document the contract for frontend/CLI consumers.
  - Acceptance Criteria: `docs/api/mock-contract.md` describing available routes, query parameters, response shapes, and known limitations (mock store, no auth). Include example `curl` and ORPC client snippets.
  - Implementation Notes: Link back to domain schema definitions referencing specific interface names.
  - File Targets: `docs/api/mock-contract.md`.
  - Validation: Have human sign-off during mission review.
  - Log:

## Testing & Validation
- `bun test apps/server` covering mocks and routers.
- `bun typecheck` to ensure router signatures align with domain package.
- Manual check: `bun dev:server` + `curl http://localhost:3000/api/v1/projects` returns expected payload.

## Documentation Updates
- Update mission log per task.
- Append any unresolved contract questions to `docs/architecture/rules.md` plus `notes/` for follow-ups.

## Handoff Notes for Mission 0003
- Provide import paths (`@solo/domain-schema`) and example query payloads for the frontend agent.
- Flag operations intentionally missing (e.g. actual GitHub integration) so later missions know to replace mocks.
