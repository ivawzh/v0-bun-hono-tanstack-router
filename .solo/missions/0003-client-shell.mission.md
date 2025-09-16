# Mission 0003 - Client Shell & Data Access Layer

## Mission Goal
Stand up the web application shell, query infrastructure, and reusable data hooks so UI missions can focus on UX without re-solving data plumbing.

## Why This Matters
- We need a reliable way to consume the mock contracts built in Mission 0002.
- Shared query utilities keep request behaviour uniform (loading, error states, optimistic updates).
- Establishing layout + navigation ensures subsequent feature screens snap into place with minimal rework.

## Current Context
- **Previous mission**: `0002-server-contracts` delivered stable ORPC/OpenAPI endpoints with mock data.
- **Next mission**: `0004-auth-session` will layer in Monster Auth; design shell must accommodate auth states.

## Deliverables
- API client module wrapping ORPC and REST calls with typed hooks powered by TanStack Query.
- Global providers (query client, ORPC utils) configured under the TanStack Router root.
- Application shell with header, subheader (project context), and responsive layout aligned to `.solo/designs/20-gui/web.md`.
- Placeholder route components for Launchpad, Project Workspace, Mission Room, Workstations, Notifications, Settings; each should render data fetched from mocks where available.
- Loading/empty/error states consistent across screens using shadcn/ui patterns.

## Out of Scope
- Authenticating users (handled next mission; assume session exists or is null).
- Detailed mission board UI, mission room features, or workstation wizard (future missions will flesh out).
- CLI functionality.

## Dependencies
- Mission 0002 endpoints reachable at `/rpc` and `/api`.
- Root route currently defined in `apps/web/src/routes/__root.tsx`.

## Constraints & Guardrails
- Follow JS rules (functional style, no loops when map/reduce works better).
- Use shadcn/ui primitives instead of custom components (import via CLI if missing).
- Keep components <300 lines; factor helper components where necessary.
- Provide descriptive hook names (`useOrganizationsQuery`, `useMissionListQuery`).

## Kickoff Checklist
Create `kickoffs/0003-client-shell.kickoff.md` and pause for human confirmation at every step.

## Tasks
- [ ] Task 1: API Client Module
  - Description: Create a unified API layer bridging ORPC and REST endpoints.
  - Acceptance Criteria: `apps/web/src/lib/api/client.ts` exporting `createApiClient` that wraps ORPC client (from Mission 0002) plus REST helper for streaming endpoints. Provide query key factory in `apps/web/src/lib/api/queryKeys.ts`.
  - Implementation Notes: Support `withSession` wrapper (no-op now) to prepare for Mission 0004. Ensure fetchers set `credentials: 'include'`.
  - File Targets: `apps/web/src/lib/api/*.ts`.
  - Validation: Type-safe consumption in upcoming hooks; `bun typecheck apps/web` passes.
  - Log:
- [ ] Task 2: Query Hooks
  - Description: Implement strongly typed hooks for core resources.
  - Acceptance Criteria: Hooks under `apps/web/src/hooks/api/` for organizations, projects, missions (list + detail), fallback templates, workstations summary, notifications. Each hook handles loading/error states and returns typed data from domain schema.
  - Implementation Notes: Use `createTanstackQueryUtils` already set up in root route. Provide suspense-friendly wrappers.
  - File Targets: `apps/web/src/hooks/api/*.ts`.
  - Validation: Add unit tests with React Testing Library + MSW stub (optional) or simple hook tests using `@testing-library/react-hooks` alternative; ensure consistent query keys.
  - Log:
- [ ] Task 3: Application Shell Layout
  - Description: Build header, subheader, global nav consistent with web design doc.
  - Acceptance Criteria: Header shows logo placeholder, project picker dropdown, theme toggle, user avatar placeholder. Subheader shows project overview stats (counts), online workstation indicator placeholder, `Pause AI` button (disabled for now). Layout responsive (grid rows) with proper spacing tokens.
  - Implementation Notes: Use shadcn `NavigationMenu`, `Breadcrumb`, `Avatar`, `Badge`. Factor components into `apps/web/src/components/layout/`.
  - File Targets: `apps/web/src/components/layout/*.tsx`, update `apps/web/src/components/header.tsx`, `apps/web/src/routes/__root.tsx` to use new layout.
  - Validation: Manual visual check; use Storybook? (If not configured, create `apps/web/.storybook` scaffolding optional). Record GIF/screenshot for docs.
  - Log:
- [ ] Task 4: Route Placeholders
  - Description: Create route files aligning with future missions.
  - Acceptance Criteria: Routes under `apps/web/src/routes/` for Launchpad (`/`), Project (`/projects/$projectId`), Mission Room (`/missions/$missionId`), Workstations (`/workstations`), Notifications (`/notifications`), Settings (`/settings`). Each route uses appropriate hooks to fetch data and renders skeleton states.
  - Implementation Notes: Use TanStack Router file-based conventions. Ensure each route exports `loader` that prefetches queries using query client (pattern with `loaderClient`). Provide `pendingComponent` for skeletons.
  - File Targets: `apps/web/src/routes/**/*`.
  - Validation: `bun dev:web` loads each route without runtime errors; `bun typecheck` covers typed params.
  - Log:

## Testing & Validation
- `bun typecheck apps/web`.
- Optional: Add integration tests using Playwright for navigation skeleton flows.

## Documentation Updates
- Update `docs/frontend/app-shell.md` summarizing architecture, key components, and hooks.
- Add quickstart snippet to `docs/api/mock-contract.md` showing how hooks consume endpoints.

## Handoff Notes for Mission 0004
- Ensure hooks gracefully handle `null` session responses so authentication mission can plug in without refactoring.
- Document TODOs for gated components (e.g. show login CTA) in route files via comments.
