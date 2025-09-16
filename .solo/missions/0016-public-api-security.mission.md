# Mission 0016 - Public API & Security Hardening

## Mission Goal
Expose the versioned public API (`/api/v1`) with rate limits, structured error payloads, PAT management, and security guardrails covering authz, CSRF, and auditing.

## Why This Matters
- FEAT-014 requires stable APIs for CLI, MCP, and third parties with observability hooks.
- Security features (rate limiting, PAT scopes) protect the platform as we open access to public consumers.
- Later mission (`0017-dev-tunneling`) depends on PAT and API policies for tunnel control.

## Current Context
- **Previous mission**: `0015-observability` produced audit logs and metrics used for monitoring API usage.
- **Next mission**: `0017-dev-tunneling` will build dev server/tunnel capabilities using new security primitives.

## Deliverables
- API versioning strategy with deprecation headers, structured errors, rate limiting tiers.
- PAT/org key issuance + management flows (web + CLI).
- Security middleware (rate limit, input validation, error handling) integrated across REST + ORPC.
- Updated OpenAPI spec with authentication docs and examples.

## Out of Scope
- Dev server tunnel operations (next mission).
- OAuth provider expansion beyond Monster Auth.

## Dependencies
- Auth/session infrastructure (Mission 0004).
- Audit log + metrics (Mission 0015).

## Constraints & Guardrails
- Rate limiting must differentiate anonymous/authenticated/contributor roles; store counters in Redis or Postgres.
- PAT scopes (read, write, admin) restrict CLI commands accordingly.
- Error payloads follow spec: `{ error: { code, message, traceId, details? } }` with HTTP status mapping.

## Kickoff Checklist
Create `kickoffs/0016-public-api-security.kickoff.md` and complete all four steps with human feedback before implementing.

## Tasks
- [ ] Task 1: API Versioning & Deprecation
  - Description: Formalize versioning and add deprecation metadata.
  - Acceptance Criteria: Middleware adds `X-Solo-Api-Version`, `Deprecation` headers when older versions accessed. Document version support matrix. Provide negotiation endpoint `/api/v1/meta/features` returning supported versions.
  - Implementation Notes: Use config to track supported versions; set default to `v1`.
  - File Targets: `apps/server/src/middleware/apiVersion.ts`, `apps/server/src/routers/api/meta.ts`, docs.
  - Validation: Tests verifying headers and negotiation.
  - Log:
- [ ] Task 2: Rate Limiting Middleware
  - Description: Implement per-role rate limits with burst/steady-state config.
  - Acceptance Criteria: Middleware using Redis or Postgres to throttle requests; returns 429 with retry-after. Configurable per endpoint group. Audit event recorded when throttle triggered.
  - Implementation Notes: Provide developer toggle for local to disable. Document environment variables.
  - File Targets: `apps/server/src/middleware/rateLimit.ts`, integration in `index.ts`.
  - Validation: Tests simulating limit exhaustion.
  - Log:
- [ ] Task 3: PAT & Org Key Management
  - Description: Build flows to issue, revoke, and scope Personal Access Tokens and organization keys.
  - Acceptance Criteria: DB tables for PATs with hashed tokens; web UI under Settings -> Access Keys for create/revoke; CLI command `solo auth pat create`. PAT scopes enforced in middleware.
  - Implementation Notes: Use secure random generator; display token once. Provide expiry + revoke endpoint.
  - File Targets: `apps/server/src/services/pat.ts`, routers, `apps/web/src/routes/settings/access-keys.tsx`, CLI commands.
  - Validation: Manual issue PAT, use for CLI request, revoke.
  - Log:
- [ ] Task 4: Structured Error Handling
  - Description: Standardize error responses across ORPC + REST.
  - Acceptance Criteria: Central error handler mapping domain errors to HTTP codes, includes `traceId` (use existing logging). Document error codes (e.g. `AUTH.UNAUTHORIZED`, `MISSION.INVALID_STAGE`).
  - Implementation Notes: Use middleware wrapping ORPC handlers; log to audit on 4xx/5xx as appropriate.
  - File Targets: `apps/server/src/middleware/errorHandler.ts`, update routers.
  - Validation: Tests verifying error structure.
  - Log:
- [ ] Task 5: OpenAPI Documentation Refresh
  - Description: Regenerate OpenAPI spec with security schemes, rate limit docs, error examples.
  - Acceptance Criteria: `apps/server/openapi.json` updated, plus human-friendly doc `docs/api/public-api.md` referencing endpoints, auth, pagination, rate limits. Ensure CLI uses generated SDK if helpful.
  - Implementation Notes: Provide script to publish spec.
  - File Targets: `apps/server/openapi.json`, docs.
  - Validation: Validate spec via `prism` or `swagger-cli`.
  - Log:
- [ ] Task 6: Security Testing
  - Description: Pen-test core endpoints for auth bypass, rate limit, CSRF.
  - Acceptance Criteria: Add automated tests (OWASP top 10 coverage), manual checklist results recorded in `docs/security/testing.md`. Ensure audit log records key events.
  - File Targets: `apps/server/test/security/*.test.ts`, docs.
  - Validation: Test suite passes; manual results documented.
  - Log:

## Testing & Validation
- `bun test apps/server` including new security tests.
- Manual flow issuing PAT, calling API, hitting rate limits.
- Validate OpenAPI spec using CLI.

## Documentation Updates
- Mission log per task.
- Update `docs/security/auth.md` with PAT scopes, `docs/architecture/rules.md` referencing rate limits.

## Handoff Notes for Mission 0017
- Provide PAT usage instructions for dev tunnel mission.
- Document endpoints new mission must call for tunnel lifecycle.
