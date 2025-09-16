# Mission 0014 - Global Search & Command Palette

## Mission Goal
Implement the cross-entity search service and keyboard-first command palette providing <200ms initial results across missions, projects, docs, commands, and notifications.

## Why This Matters
- FEAT-018 defines global search as a core navigation accelerator on web and CLI.
- Search index powers discovery, command execution, and quick actions across the platform.
- Later observability mission (0015) will reuse search logs for analytics.

## Current Context
- **Previous mission**: `0013-public-access` delivered public gallery and access request workflow feeding search content.
- **Next mission**: `0015-observability` will add dashboards leveraging search metrics.

## Deliverables
- Search indexing service ingesting missions, projects, docs, templates, notifications, commands into a queryable store (e.g. Postgres FTS or dedicated search index).
- API endpoints returning search results with type-specific metadata and ranking.
- Web command palette (Ctrl+K) with typeahead, command execution, and context awareness.
- CLI search commands providing parity (`solo search missions <query>` etc.).

## Out of Scope
- Analytics dashboards (next mission).
- Third-party search integrations (Algolia, etc.).

## Dependencies
- Domain schema includes SearchableEntity union.
- Realtime events (Mission 0011) to invalidate caches when data changes.

## Constraints & Guardrails
- Target <200ms median latency for initial query using caching and precomputed index.
- Provide stale-while-revalidate behaviour (immediate partial results then refined result).
- Ensure command palette accessible (keyboard navigation, screen reader support).

## Kickoff Checklist
Create `kickoffs/0014-global-search.kickoff.md` and follow all four steps with human confirmation before implementation.

## Tasks
- [ ] Task 1: Search Indexer
  - Description: Build indexing pipeline populating search tables/materialized views.
  - Acceptance Criteria: `apps/server/src/services/search/indexer.ts` listens to domain events (missions updated, docs changed) and updates search index. Provide nightly full rebuild job. Schema includes vectors for FTS ranking, tag filters.
  - Implementation Notes: Use Postgres `tsvector` or `pgvector` for embedding-based ranking. Keep fallback simple for now (tsvector) but design for extension.
  - File Targets: `apps/server/src/services/search/*.ts`, DB migrations for search tables.
  - Validation: Tests verifying index contains expected tokens.
  - Log:
- [ ] Task 2: Search Query API
  - Description: Expose `/rpc/search.query` and `/api/v1/search` returning aggregated results by entity type.
  - Acceptance Criteria: Response includes `items` with type, id, title, snippet, url, score. Support filters (type, project/org). Provide pagination (limit/offset) and highlight matched terms.
  - Implementation Notes: Use prepared statements for performance; add caching (Redis or in-memory) if necessary.
  - File Targets: `apps/server/src/routers/rpc/search.ts`, `apps/server/src/routers/api/search.ts`.
  - Validation: Tests verifying ranking order.
  - Log:
- [ ] Task 3: Command Palette UI
  - Description: Implement keyboard-invoked command palette with search + quick actions.
  - Acceptance Criteria: `CommandPalette` component opens on `Cmd/Ctrl+K`, shows grouped results (missions, projects, docs, commands). Supports arrow navigation, Enter to execute. Actions include navigation, toggling Ready, opening Mission creation modal, etc.
  - Implementation Notes: Use shadcn `Command` component (install). Prefetches results using search API with SWR-like stale-while-revalidate behaviour.
  - File Targets: `apps/web/src/components/CommandPalette.tsx`, integrate with root layout.
  - Validation: Manual performance check (<200ms). Add tests for keyboard navigation.
  - Log:
- [ ] Task 4: CLI Search Commands
  - Description: Extend CLI to perform search and execute commands.
  - Acceptance Criteria: `solo search missions <query>`, `solo search projects`, `solo command <name>` to execute quick actions. Provide fuzzy matching offline fallback (cached index).
  - Implementation Notes: Cache responses in local file; respect PAT auth.
  - File Targets: `apps/cli/src/commands/search.ts`, `apps/cli/src/commands/command.ts`.
  - Validation: Manual CLI usage.
  - Log:
- [ ] Task 5: Telemetry & Logging
  - Description: Capture search metrics for observability.
  - Acceptance Criteria: Logging service records query, latency, result count, executed action. Data stored for dashboards in next mission.
  - Implementation Notes: Minimal PII (hash user id). Provide sampling config.
  - File Targets: `apps/server/src/services/search/telemetry.ts`, DB table.
  - Validation: Tests verifying logs recorded.
  - Log:
- [ ] Task 6: Documentation
  - Description: Document search + command palette usage.
  - Acceptance Criteria: `docs/product/search.md`, `docs/cli/search.md`, update `docs/frontend/app-shell.md` with palette instructions.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun test apps/server` for search index + query.
- Manual performance check using dev data (profiling logs).
- CLI tests.

## Documentation Updates
- Mission log per task.
- Note TODO if external search provider considered later in `notes/search-followups.md`.

## Handoff Notes for Mission 0015
- Provide telemetry schema + aggregator functions for observability dashboards.
- Document API endpoints powering search so analytics mission can chart usage.
