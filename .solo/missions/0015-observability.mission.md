# Mission 0015 - Observability & Auditing Dashboards

## Mission Goal
Implement observability dashboards for missions, workstations, and notifications, plus full audit trails capturing sensitive actions.

## Why This Matters
- FEAT-019 requires trustworthy mission health, workstation uptime, and audit logs for compliance.
- Prior missions generate telemetry events and search logs; this mission surfaces them for humans.
- Audit trails support security mission (0016) and public API consumers.

## Current Context
- **Previous mission**: `0014-global-search` added telemetry hooks to search service.
- **Next mission**: `0016-public-api-security` will formalize API versioning, rate limits, and security features.

## Deliverables
- Metrics aggregation jobs producing mission SLA, workstation uptime, notification delivery stats.
- Web dashboards on Launchpad/Project workspace showing charts, uptime badges, mission timeline.
- Audit log storage + API with filtering (by actor, entity, action) and retention policy.
- CLI commands to view audit events and metrics snapshots.

## Out of Scope
- Security features (rate limiting, API tokens) beyond capturing audit events (next mission).
- Non-critical analytics (e.g. marketing metrics).

## Dependencies
- Telemetry from Mission 0014, events from Mission 0011, job queue from Mission 0009.

## Constraints & Guardrails
- Keep dashboards performant (pre-aggregate metrics; avoid heavy queries on page load).
- Audit log must be append-only with tamper-proof design (store hash chain or signature).
- Provide retention policy configuration (default 90 days, configurable).

## Kickoff Checklist
Create `kickoffs/0015-observability.kickoff.md` and complete all four steps with human confirmation before implementing.

## Tasks
- [ ] Task 1: Metrics Aggregators
  - Description: Build background jobs computing mission SLA, workstation uptime, notification success rates.
  - Acceptance Criteria: Jobs run on schedule (cron) and populate metrics tables (daily/hourly). Provide manual trigger CLI command. Aggregators handle partial data gracefully.
  - Implementation Notes: Use job queue from Mission 0009; store aggregated values in dedicated tables with indexes.
  - File Targets: `apps/server/src/jobs/metrics/*.ts`, DB migrations, CLI command.
  - Validation: Tests verifying aggregator output on sample data.
  - Log:
- [ ] Task 2: Observability API
  - Description: Expose metrics via ORPC/REST endpoints for Launchpad + dashboards.
  - Acceptance Criteria: `/rpc/metrics.getOrgDashboard`, `.getProjectDashboard`, `.getWorkstationHealth`. Responses include SLA percentages, uptime, fallback utilization. Provide REST GET `/api/v1/projects/{id}/metrics`.
  - Implementation Notes: Cache responses (Redis or memory) with TTL. Include `updatedAt` timestamp.
  - File Targets: `apps/server/src/routers/rpc/metrics.ts`, `apps/server/src/routers/api/metrics.ts`.
  - Validation: Tests verifying data shape + caching behaviour.
  - Log:
- [ ] Task 3: Web Dashboards
  - Description: Build dashboards rendering metrics with charts.
  - Acceptance Criteria: Launchpad displays SLA cards + line charts (use `@tanstack/react-charts` or `recharts` if approved). Project workspace includes uptime chart, mission timeline summary, fallback analytics. Provide tooltip with raw numbers.
  - Implementation Notes: Use shadcn + chart library (if new dependency needed justify). Ensure responsive design with skeletons.
  - File Targets: `apps/web/src/components/metrics/*`, updates to Launchpad + project routes.
  - Validation: Manual QA with seeded data.
  - Log:
- [ ] Task 4: Audit Log Service
  - Description: Implement append-only audit log storage with API + UI.
  - Acceptance Criteria: `audit_events` table with hashed chain; service method `recordAuditEvent`. Endpoints `/rpc/audit.list`, filters (actor, entity, action). UI route `/audit` accessible to owners with table, filters, export CSV.
  - Implementation Notes: Use cryptographic hash linking events for tamper prevention. Document rotation/retention.
  - File Targets: `apps/server/src/services/audit.ts`, routers, DB migration, `apps/web/src/routes/audit.tsx`.
  - Validation: Tests verifying hash chain integrity.
  - Log:
- [ ] Task 5: CLI Metrics & Audit Commands
  - Description: Extend CLI to fetch metrics snapshots + audit logs.
  - Acceptance Criteria: `solo metrics org`, `solo metrics project`, `solo audit list`. Support filters + JSON output for scripting.
  - Implementation Notes: Provide pagination, respect PAT scopes.
  - File Targets: `apps/cli/src/commands/metrics.ts`, `apps/cli/src/commands/audit.ts`.
  - Validation: Manual CLI run.
  - Log:
- [ ] Task 6: Documentation
  - Description: Document observability architecture and audit policy.
  - Acceptance Criteria: `docs/product/observability.md`, `docs/security/audit.md`, update `docs/dev/runbooks/metrics.md`.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun test apps/server` covering metrics + audit services.
- Manual QA of dashboards with seeded data.
- CLI smoke tests.

## Documentation Updates
- Mission log per task.
- Note TODO for long-term storage/archival in `notes/observability-followups.md` if not implemented.

## Handoff Notes for Mission 0016
- Expose audit event structure + API paths so security mission can integrate with rate limiting + public API responses.
- Provide caching configuration details for API rate limit design.
