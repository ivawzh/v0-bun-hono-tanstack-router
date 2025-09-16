# Mission 0012 - Configuration Management & Flow Templates

## Mission Goal
Deliver typed configuration management across apps and implement flow template/prompt management with realtime-aware updates.

## Why This Matters
- FEAT-009 mandates typed config access for server/web/CLI; prevents runtime env drift.
- FEAT-016 requires flow templates and prompt versioning to keep missions consistent.
- Configuration changes should propagate instantly via realtime events established in Mission 0011.

## Current Context
- **Previous mission**: `0011-realtime-notifications` enables realtime event broadcasts.
- **Next mission**: `0013-public-access` will expose public surfaces that depend on config + templates for guardrails.

## Deliverables
- Shared config package providing typed accessors for env variables and persisted project/org config values.
- Server + CLI endpoints to view/edit config with validation and backup/restore.
- Flow template management: CRUD for templates, versioning, prompt preview, rollout plan.
- Web UI for Project Settings to adjust defaults (change policy, flow templates, quiet hours) with optimistic UI.

## Out of Scope
- Public project features (next mission).
- Full-blown prompt editor beyond minimal requirements (provide extension hooks).

## Dependencies
- Domain schema includes ConfigBundle, FlowTemplate, PromptVersion.
- Realtime events for `config.updated`, `flowTemplate.updated`.

## Constraints & Guardrails
- Config access must avoid direct `process.env`; provide wrappers in each app using shared package.
- Editing config should emit audit events and backup previous version automatically.
- Flow templates require semantic versioning (`major.minor.patch`) and status (draft/active/deprecated).

## Kickoff Checklist
Create `kickoffs/0012-configuration-templates.kickoff.md` and follow the four steps with human sign-off before implementation.

## Tasks
- [ ] Task 1: Shared Config Package
  - Description: Create `packages/config` exporting typed accessors for env + persisted config.
  - Acceptance Criteria: `packages/config/src/env.ts` wraps `process.env` with schema (use `zod`). Provide `getServerEnv`, `getWebEnv` (tree-shakable). `packages/config/src/projectConfig.ts` fetches persisted config from server (via ORPC) with caching.
  - Implementation Notes: Ensure SSR-safe for web (expose read-only). Provide tests verifying schema validation.
  - File Targets: `packages/config/**`.
  - Validation: `bun typecheck` + `bun test packages/config`.
  - Log:
- [ ] Task 2: Server Config Management APIs
  - Description: Implement endpoints to read/write org/project config.
  - Acceptance Criteria: `/rpc/config.get`, `.update`, `.history`, `.restore`. Validate updates against schema; store history table for rollback. Emit realtime `config.updated` event.
  - Implementation Notes: Restrict updates to owners. On update, snapshot previous version to `config_history` table.
  - File Targets: `apps/server/src/routers/rpc/config.ts`, repository updates, tests.
  - Validation: Tests verifying validation errors + history entries.
  - Log:
- [ ] Task 3: Flow Template Service
  - Description: Manage flow template CRUD + versioning.
  - Acceptance Criteria: `/rpc/flowTemplates.list`, `.create`, `.update`, `.publish`, `.archive`. Templates include metadata (intent, actor, default flow, prompts). Rollout plan: ability to mark template version as default for new missions. Realtime `flowTemplate.updated` events.
  - Implementation Notes: Use `semver` library for versioning. Store prompts as structured JSON (persist for CLI consumption).
  - File Targets: `apps/server/src/services/flowTemplates.ts`, routers, DB migrations if needed.
  - Validation: Tests verifying version bump rules.
  - Log:
- [ ] Task 4: Web UI - Project Settings
  - Description: Build settings interface for config + flow templates.
  - Acceptance Criteria: `/projects/$projectId/settings` route with tabs (Configuration, Flow Templates, Quiet Hours). Config form uses typed schema with inline validation. Flow template table with version history, preview modal (Minimal Tiptap read-only for prompt). Provide ability to duplicate templates.
  - Implementation Notes: Use shadcn `Tabs`, `Form`, `Table`, `Dialog`. Hook into realtime events to refresh data.
  - File Targets: `apps/web/src/routes/projects/$projectId/settings/*.tsx`, components.
  - Validation: Manual QA: update config, watch board reflect new defaults.
  - Log:
- [ ] Task 5: CLI Config Commands
  - Description: Extend CLI to view/edit config with validation and backup.
  - Acceptance Criteria: Commands `solo config show`, `solo config edit`, `solo flows list`, `solo flows promote`. Provide diff preview before apply. On edit, fetch schema, open in `$EDITOR`, patch via API.
  - Implementation Notes: Reuse config package; ensure CLI handles realtime update notifications (subscribe to events).
  - File Targets: `apps/cli/src/commands/config.ts`, `apps/cli/src/commands/flows.ts`.
  - Validation: Manual run of CLI commands.
  - Log:
- [ ] Task 6: Documentation
  - Description: Document config + flow template management.
  - Acceptance Criteria: `docs/product/configuration.md`, `docs/product/flow-templates.md`, update `docs/cli`.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun test apps/server` covering config/template APIs.
- `bun test apps/web` for settings forms if tests added.
- CLI manual tests.

## Documentation Updates
- Mission log per task.
- Add TODO for advanced prompt diffing if not implemented to `notes/template-followups.md`.

## Handoff Notes for Mission 0013
- Document config flags controlling public project visibility for Mission 0013 to respect.
- Provide event names for access request notifications.
