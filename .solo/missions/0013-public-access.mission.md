# Mission 0013 - Public Surfaces, Access Requests & Discovery

## Mission Goal
Expose public project pages with permission-aware sections, support visitor access requests, and deliver discovery surfaces (gallery, categories, activity feed).

## Why This Matters
- FEAT-012, FEAT-013, and FEAT-020 expand Solo Unicorn to public audiences and manage contributor onboarding.
- Access requests integrate with notifications and mission backlog planning.
- Discovery ensures healthy mission backlog by showcasing public projects and templates.

## Current Context
- **Previous mission**: `0012-configuration-templates` added config flags + flow templates that influence public visibility.
- **Next mission**: `0014-global-search` will build cross-entity search leveraging discovery indices.

## Deliverables
- Public API endpoints exposing projects with ACL-aware payloads and access request submission.
- Web public site routes (`/public`, `/public/projects/$slug`) following design with permission gating.
- Access request workflow: submission form, maintainer approval UI, notifications integration.
- Discovery gallery with search/filters, trending highlights, activity feed.

## Out of Scope
- Global command palette search (next mission).
- SEO automation beyond initial metadata (document TODOs).

## Dependencies
- Config flags controlling public visibility (Mission 0012).
- Notification system (Mission 0011) for request updates.

## Constraints & Guardrails
- Do not leak private data; filter payloads based on visitor role.
- Rate-limit access requests (per IP/email) to prevent spam.
- Provide human-friendly copy per design guidelines.

## Kickoff Checklist
Create `kickoffs/0013-public-access.kickoff.md` and complete the four steps with human confirmation before implementation.

## Tasks
- [ ] Task 1: Public API Endpoints
  - Description: Build `/api/v1/public/projects` listing, project detail, categories, activity; access request submission endpoint.
  - Acceptance Criteria: Endpoints respect visibility settings, include SEO metadata (title, description, hero image). Access request endpoint stores request, triggers notification.
  - Implementation Notes: Use caching for public queries (15s). Validate request input (name, reason, expected involvement). Include optional reCAPTCHA stub.
  - File Targets: `apps/server/src/routers/api/public/*.ts`, repository methods, tests.
  - Validation: Tests ensuring private sections removed for visitors.
  - Log:
- [ ] Task 2: Access Request Workflow
  - Description: Implement submission, maintainer approval/decline, SLA messaging.
  - Acceptance Criteria: ORPC endpoints for maintainers to view queue, approve, reject with rationale; timeline updates for requester. Notification event fired on state change. SLA estimate displayed based on config.
  - Implementation Notes: Provide CLI command `solo access-requests list/approve` leveraging same endpoints.
  - File Targets: `apps/server/src/routers/rpc/accessRequests.ts`, CLI commands, DB migrations if needed (status fields, SLA timestamps).
  - Validation: Tests for status transitions, permission gating.
  - Log:
- [ ] Task 3: Public Web Pages
  - Description: Build `apps/web/src/routes/public/` pages.
  - Acceptance Criteria: `/public` gallery with filters (search, categories, trending). Cards show permission state, achievements, CTA. `/public/projects/$slug` shows sections toggled by ACL (missions, docs, repositories, workstations). Provide Access Request form with SLA indicator.
  - Implementation Notes: Use TanStack Router routeGroup for public area (no auth). Use shadcn components for cards, forms.
  - File Targets: `apps/web/src/routes/public/*.tsx`, components.
  - Validation: Manual QA; ensure unauthorized sections show friendly locked state.
  - Log:
- [ ] Task 4: Maintainer Approval UI
  - Description: Add access request management surface to Launchpad/Notifications.
  - Acceptance Criteria: Maintainer sees requests in notifications + dedicated `/access-requests` view with decision buttons, rationale capture, history table.
  - Implementation Notes: Integrate with notification service to mark request as read when opened.
  - File Targets: `apps/web/src/routes/access-requests.tsx`, components.
  - Validation: Manual scenario from visitor request to maintainer approval.
  - Log:
- [ ] Task 5: Discovery Activity Feed
  - Description: Create backend + UI for trending insights and activity feed (mission completions, stars).
  - Acceptance Criteria: Endpoint aggregates events; UI on `/public` displays feed with relative timestamps, filters. Provide caching/invalidation strategy.
  - Implementation Notes: Use background job to compute trending stats daily.
  - File Targets: `apps/server/src/services/discovery.ts`, `apps/web/src/components/public/ActivityFeed.tsx`.
  - Validation: Tests verifying aggregator output.
  - Log:
- [ ] Task 6: Documentation
  - Description: Document public project policies + access request process.
  - Acceptance Criteria: `docs/product/public-projects.md`, update `docs/product/access-requests.md`, `docs/product/discovery.md`.
  - Validation: Human review.
  - Log:

## Testing & Validation
- `bun test apps/server` covering public endpoints + access requests.
- Manual QA with incognito browser.
- CLI tests for approval commands.

## Documentation Updates
- Mission log per task.
- Note SEO TODOs (structured data, sitemap) in `notes/public-followups.md` if not completed.

## Handoff Notes for Mission 0014
- Provide search indexing API references (list of searchable entities, filters).
- Document caching layer decisions for search to reuse.
