# Mission 0009 - Persistence Upgrade & Background Jobs

## Mission Goal
Replace the mock in-memory store with a real Postgres + Drizzle persistence layer, introduce background job scaffolding, and ensure existing features operate on durable data.

## Why This Matters
- All previous missions worked against mocks; production requires real persistence, migrations, and data integrity.
- Upcoming missions (workstations, realtime, notifications) need durable storage and background job queues.
- Aligning DB schema with domain contracts prevents drift and simplifies server logic.

## Current Context
- **Previous mission**: `0008-change-management` introduced richer mission state (policies, reviews).
- **Next mission**: `0010-workstation-agent` will build workstation onboarding relying on persisted data.

## Deliverables
- Drizzle schema definitions covering all domain entities (organizations, projects, missions, mission history, documents, workstations, agents, notifications, templates, access requests, repositories, config, review decisions).
- Migration scripts + seeding pipeline to populate dev data matching previous mocks.
- Repository layer replacing `apps/server/src/mocks/store.ts` with database-backed services.
- Background job scheduler (Bun or separate worker) for tasks like review sync, fallback generation, notification fan-out (stubs acceptable now but must enqueue jobs in DB).

## Out of Scope
- Real-time event delivery (Mission 0011 handles presence/notifications).
- Deployment automation (Mission 0015 covers security + API hardening).

## Dependencies
- Domain schema (Mission 0001) and API shapes (Mission 0002–0008).
- Drizzle already configured in repo (`apps/server/src/db`).

## Constraints & Guardrails
- Schema must enforce referential integrity, unique constraints, and soft-delete patterns where needed.
- Provide transaction boundaries for multi-step operations (mission stage change + timeline entry).
- Maintain API compatibility; minimal changes to response payloads.

## Kickoff Checklist
Create `kickoffs/0009-persistence-upgrade.kickoff.md` and complete all four steps with stakeholder feedback before migrations.

## Tasks
- [ ] Task 1: Database Schema Definition
  - Description: Translate domain interfaces into Drizzle schema modules.
  - Acceptance Criteria: New files under `apps/server/src/db/schema/` for each entity; migrations generated via `bun db:migrate:generate`. Include indexes for lookups (e.g. mission by project/stage, notifications by user).
  - Implementation Notes: Use naming conventions (snake_case table names). Manage JSON columns for settings where appropriate. Provide composite unique keys (e.g. `missions` unique on slug + project).
  - File Targets: `apps/server/src/db/schema/*.ts`, migrations in `apps/server/src/db/migrations`.
  - Validation: Run `bun db:push` in dev; tests verifying schema matches domain.
  - Log:
- [ ] Task 2: Repository Layer
  - Description: Build data access layer replacing mock store.
  - Acceptance Criteria: `apps/server/src/repositories/*.ts` modules for missions, projects, workstations, docs, reviews, notifications. Each repository exposes CRUD + query methods returning domain schema objects. Update routers to use repositories.
  - Implementation Notes: Use dependency injection so tests can swap to in-memory implementation. For now keep mock store available for tests (adapter pattern).
  - File Targets: `apps/server/src/repositories/*.ts`, update routers/mutations, remove direct mock dependencies.
  - Validation: Integration tests hitting ORPC endpoints verifying DB writes succeed (use transaction rollback per test).
  - Log:
- [ ] Task 3: Data Seeder
  - Description: Provide seeding pipeline replicating previous mock data for dev environment.
  - Acceptance Criteria: `apps/server/src/db/seed.ts` populates sample org/project/mission/workstation data; run via `bun run db:seed`. Ensure idempotency (truncate or upsert).
  - Implementation Notes: Pull sample data from previous JSON fixtures; use helper to ensure deterministic IDs.
  - File Targets: `apps/server/src/db/seed.ts`, scripts in root `package.json`.
  - Validation: Run seed and verify Launchpad displays data.
  - Log:
- [ ] Task 4: Background Job Scaffold
  - Description: Establish job queue for async tasks (review sync, fallback generation, notification fan-out).
  - Acceptance Criteria: Create `apps/server/src/jobs/` with queue abstraction (e.g. simple Postgres-based queue table). Provide worker entrypoint `bun run jobs:worker`. Hook change management + fallback triggers to enqueue jobs instead of synchronous work.
  - Implementation Notes: Keep implementation simple (polling). Document future scaling needs.
  - File Targets: `apps/server/src/jobs/*.ts`, `package.json` scripts, docs.
  - Validation: Tests verifying jobs enqueued on mission stage change; manual run of worker logs tasks.
  - Log:
- [ ] Task 5: Remove Mock Store & Update Tests
  - Description: Replace usage of `apps/server/src/mocks` with repository/backing store.
  - Acceptance Criteria: All routers/imports reference repositories; mock store only used in tests via adapter for deterministic fixtures. Update tests to run against DB (with transaction rollbacks) or use repository mock.
  - Implementation Notes: Provide test helpers to seed data before each test.
  - File Targets: Remove/relocate `apps/server/src/mocks`, update tests.
  - Validation: `bun test apps/server` passes using DB-backed data.
  - Log:
- [ ] Task 6: Documentation
  - Description: Document persistence architecture and migration workflow.
  - Acceptance Criteria: `docs/architecture/persistence.md` describing schema, repositories, job queue. Update `README` quick start for DB seed command.
  - File Targets: `docs/architecture/persistence.md`, `README.md` updates.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun db:push`, `bun db:seed` to initialize dev DB.
- `bun test apps/server` using DB context.
- Manual regression: Launchpad, Mission board, Mission Room still functional.

## Documentation Updates
- Update mission log.
- Note follow-up tasks for migration versioning (if any) in `notes/db-followups.md`.

## Handoff Notes for Mission 0010
- Provide repository methods or SQL views required for workstation metrics.
- Document how to run background worker, as mission 0010/0011 will enqueue realtime/notification jobs.
