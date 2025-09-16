# Mission 0001 - Domain Architecture & Shared Contracts

## Mission Goal
Establish a shared understanding of the Solo Unicorn platform domain, codify the canonical data contracts, and document the interaction flows so future missions can build against stable foundations.

## Why This Matters
- Every UX surface in `.solo/designs/10-features.md` depends on consistent nouns (org, project, mission, workstation, agent, template, notification, access request).
- Early clarity keeps subsequent missions under the 272k context limit because we can reference a single source of truth instead of re-deriving requirements.
- The in-memory server mocks (Mission 0002) must align 1:1 with these contracts.

## Current Context
- **Previous mission**: None, greenfield start.
- **Next mission**: `0002-server-contracts` will stand up ORPC/OpenAPI handlers over the contracts finalized here.

## Deliverables
- Mermaid system diagrams covering domain relationships and lifecycle states stored under `docs/architecture/`.
- A shared TypeScript package (e.g. `packages/domain-schema`) exporting `interface` definitions, discriminated unions, and helper guards for every primary entity.
- Enumerations and constants for stages (Todo/Doing/Review/Done), ready status, auth roles, workstation visibility, mission fallback origins, notification categories, etc.
- Written guidance on cross-entity invariants (e.g. a mission belongs to exactly one project; a workstation can host many agents but has a capacity cap).

## Out of Scope
- Persisting data anywhere; keep everything in documentation and shared types only.
- Authoring API handlers, UI components, or CLI commands.
- Integrating with Monster Auth or any third-party service.

## Dependencies
- Design references: `.solo/designs/10-features.md`, `.solo/designs/20-gui/web.md`.
- Existing repo rules in `AGENTS.md` (functional style, ts-pattern).

## Constraints & Guardrails
- Prefer interfaces over types (`interface Mission { ... }`).
- Keep exports tree-shakeable: named exports only.
- Document assumptions inside the shared package using succinct comments.
- Ensure diagrams map directly to exported interfaces so later agents can trace fields quickly.

## Kickoff Checklist
Create `kickoffs/0001-domain-architecture.kickoff.md` before coding and pause for human feedback after each step.
- [ ] Step 1: Clarify the Mission Goal — list open questions about domain scope, lifecycle, and naming collisions.
- [ ] Step 2: Are we doing the right thing? — challenge the planned domain splits (e.g. should workstations own agents?).
- [ ] Step 3: List and rank solution options — compare at least two ways to structure shared types (single file vs per-entity folders).
- [ ] Step 4: Specification — outline happy/unhappy/edge paths for mission lifecycle, access requests, and workstation onboarding.

## Tasks
- [ ] Task 1: Author Domain Blueprint
  - Description: Translate product designs into an entity-relationship outline plus lifecycle flow diagrams.
  - Acceptance Criteria: `docs/architecture/domain-map.md` with a Mermaid ER diagram and `docs/architecture/flows/mission-lifecycle.mmd` covering Todo → Done transitions including fallback origin metadata.
  - Implementation Notes: Surface key fields per entity (ids, slugs, timestamps, owner references). Call out invariants (e.g. mission fallback templates never attach to active missions directly).
  - File Targets: `docs/architecture/domain-map.md`, `docs/architecture/flows/mission-lifecycle.mmd`, optionally additional files under `docs/architecture/` for workstation onboarding and access requests.
  - Validation: Share diagrams with the human after Kickoff for confirmation.
  - Log:
- [ ] Task 2: Create Shared Domain Package
  - Description: Scaffold `packages/domain-schema` with `src/entities/` folder housing interfaces for Organization, Project, Mission, FlowTemplate, Workstation, AgentPresence, Repository, Notification, ConfigBundle, AccessRequest, MissionDocument, MissionTimelineEvent.
  - Acceptance Criteria: Package builds via `bun run --filter domain-schema build` (add script) and exports aggregated barrel at `src/index.ts`; types document optional vs required fields; string unions map to enumerations defined in designs (e.g. mission stages, notification kinds, tunneling status).
  - Implementation Notes: Add runtime guards using `zod` or `valibot` only where necessary for validation in later missions; avoid heavy dependencies. Provide helper factories for generating mock ids (`createMissionId()` etc.).
  - File Targets: `packages/domain-schema/package.json`, `packages/domain-schema/tsconfig.json`, `packages/domain-schema/src/index.ts`, `packages/domain-schema/src/entities/*.ts`, `packages/domain-schema/src/constants.ts`.
  - Validation: `bun typecheck` at repo root passes; add lightweight unit tests using Bun test runner in `packages/domain-schema/test/entities.test.ts` to ensure stage unions align with constants.
  - Log:
- [ ] Task 3: Document Cross-Cutting Rules
  - Description: Capture textual rules tying entities together so future missions know expected behaviour.
  - Acceptance Criteria: `docs/architecture/rules.md` lists sections for Auth, Missions, Workstations, Reviews, Notifications, Public Access, Config, Search. Each rule references relevant interface names and fields.
  - Implementation Notes: Include retry/idempotency expectations and concurrency guardrails noted in `.solo/designs/10-features.md` (e.g. Mission Fallback guardrails, review requirements). Highlight any TBD decisions that next mission must resolve.
  - File Targets: `docs/architecture/rules.md`.
  - Validation: Ensure no TODOs remain unresolved; align wording with Communication Style (direct, actionable).
  - Log:

## Testing & Validation
- Run `bun typecheck` to ensure shared package compiles.
- Run `bun test packages/domain-schema` if tests added.
- Share diagrams with human reviewer before closing mission; capture approvals in mission log.

## Documentation Updates
- Update `notes/` with any future follow-ups identified during Kickoff.
- Summarize key decisions within this mission file upon completion (Log entries per task).

## Handoff Notes for Mission 0002
- Provide final exported interface names and enums in the mission log so `0002-server-contracts` can import directly.
- Note any unresolved questions about relationships or field naming; Mission 0002 must not invent new fields without consensus.
