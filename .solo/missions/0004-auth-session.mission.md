# Mission 0004 - Authentication & Session Bridging

## Mission Goal
Integrate Monster Auth end-to-end so the web app, server, and future CLI share consistent identity, role, and session state.

## Why This Matters
- Every feature after this mission assumes authenticated context for authorization decisions and audit trails.
- Login/logout flows must feel seamless and respect UX expectations (minimum friction, optimistic UI).
- Session data feeds role-based access in mission board, workstation controls, and public/private surfaces.

## Current Context
- **Previous mission**: `0003-client-shell` built the app shell with anonymous handling.
- **Next mission**: `0005-projects-org` will display Launchpad and project context requiring role awareness.

## Deliverables
- Monster Auth OAuth integration (Google + password) wired via `apps/server/src/lib/openauth.ts` with secure cookie handling.
- Session persistence across requests using HTTP-only cookies complying with CSRF guardrails.
- Frontend auth guard providing login/logout buttons, gating private routes, and exposing `useAuth()` state.
- Role resolution (org/project roles) stubbed or derived from mock data for now, ready for Mission 0005.

## Out of Scope
- Persisting user roles in the database (Mission 0009+ handles storage).
- Public project access control (Mission 0012).
- CLI authentication flows (document TODOs for later CLI mission).

## Dependencies
- Monster Auth SDK credentials (ensure `.env` placeholders defined).
- Existing `authRouter` stub in `apps/server/src/routers/rpc/auth.ts`.

## Constraints & Guardrails
- Cookies must be HTTP-only, Secure (except localhost), and include CSRF tokens for REST POSTs.
- Implement logout to revoke cookies server-side, not just client state.
- Provide optimistic UI for login (spinner, disabled states) without leaking secret tokens to client.

## Kickoff Checklist
Create `kickoffs/0004-auth-session.kickoff.md` and follow the standard four steps with human confirmation before coding auth flows.

## Tasks
- [ ] Task 1: Server-Side Auth Plumbing
  - Description: Finish integrating Monster Auth SDK for OAuth/password flows.
  - Acceptance Criteria: `apps/server/src/lib/openauth.ts` configures Monster Auth client with env variables; `apps/server/src/services/authCookies.ts` sets signed cookies with expiry + refresh tokens; `/api/oauth/callback` exchanges auth code for tokens, stores session, and redirects correctly.
  - Implementation Notes: Use `sst.Secret` or env for Monster Auth credentials; ensure fallback mocks exist for dev when credentials missing. Add tests verifying cookie flags via supertest.
  - File Targets: `apps/server/src/lib/openauth.ts`, `apps/server/src/services/authCookies.ts`, `apps/server/src/routers/others/oauth-callback.ts`, `.env.example` updates.
  - Validation: Local login via Monster Auth sandbox works; `bun test apps/server/test/auth.test.ts` covers happy/unhappy flows.
  - Log:
- [ ] Task 2: Session Context & Role Resolution
  - Description: Extend `createContext` to attach user roles and permissions from mock store.
  - Acceptance Criteria: Context includes `session`, `appUser`, `roles: { orgId -> role, projectId -> role }`. Update mock store to supply role mapping for test users.
  - Implementation Notes: Expose helper `getUserContext(session)` to share with routers; ensure unauthorized requests throw consistent `UNAUTHORIZED` errors. Add ts-pattern for role gating (owner vs contributor vs viewer).
  - File Targets: `apps/server/src/lib/context.ts`, `apps/server/src/mocks/store.ts`, new `apps/server/src/auth/roles.ts`.
  - Validation: Router tests verifying unauthorized users get 403; context type exported for frontend (via new ORPC procedure `auth.authenticate`).
  - Log:
- [ ] Task 3: Frontend Auth Guard
  - Description: Build login/logout UI and protect private routes.
  - Acceptance Criteria: `apps/web/src/hooks/useAuth.ts` updated to call `auth.authenticate`; `AuthProvider` (new) stores state; `LoginGate` component wraps private routes. Header shows user info + avatar, login button when unauthenticated.
  - Implementation Notes: Use TanStack Router loaders to require auth; redirect to `/login` route with CTA. Provide optimistic state while awaiting session. Use shadcn `Button`, `DropdownMenu` for account menu.
  - File Targets: `apps/web/src/providers/AuthProvider.tsx`, `apps/web/src/routes/login.tsx`, updates to `Header`, route definitions.
  - Validation: Manual test: unauthenticated users redirected to login; login triggers Monster Auth flow; logout clears state.
  - Log:
- [ ] Task 4: Security Hardening
  - Description: Add CSRF tokens for REST POST/PUT/DELETE and document session handling.
  - Acceptance Criteria: `apps/server/src/middleware/csrf.ts` verifying double-submit token; frontend attaches `X-CSRF-Token` from cookie via interceptor. Document security story in `docs/security/auth.md`.
  - Implementation Notes: Provide fallback for GET-only contexts; ensure tokens rotate on login/logout.
  - File Targets: `apps/server/src/middleware/csrf.ts`, `apps/server/src/index.ts` (middleware registration), `apps/web/src/lib/api/restClient.ts` for attaching token, `docs/security/auth.md`.
  - Validation: Tests hitting protected POST without token returns 403; with token returns 200.
  - Log:

## Testing & Validation
- `bun test apps/server` covering auth + csrf.
- `bun typecheck` across repo.
- Manual login FLow using Monster Auth sandbox credentials.

## Documentation Updates
- Update `.env.example` with required Monster Auth config.
- Append session/role explanation to `docs/architecture/rules.md`.

## Handoff Notes for Mission 0005
- Provide list of role names and associated permissions for projects/missions.
- Document any outstanding TODOs (e.g. CLI token issuance) for later missions in `notes/todo-auth.md`.
