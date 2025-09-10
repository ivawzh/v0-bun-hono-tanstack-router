# Project Brief: Solo Unicorn!

## Executive Summary
Solo Unicorn! is an AI-powered development workflow orchestrator that coordinates local code agents, Git repositories, and a collaborative web UI to deliver rapid, reliable software changes. It introduces optional Pull Request (PR) workflows for production-grade control while preserving fast iteration for early-stage projects. It also enables Public Projects with granular permission controls so communities can discover, star, and contribute to work transparently.

- Product concept: Mission-oriented orchestration for AI coding agents across CLI, Web, and API
- Primary problem: Fragmented agent usage, weak context continuity, and inconsistent review flows slow delivery
- Target market: Individual developers, small product teams, and OSS maintainers using AI-assisted development
- Key value: Flow-first missions with clear stages, optional PR mode, and public collaboration with fine-grained access

## Problem Statement
Modern teams experimenting with AI coding tools face friction:
- Context fragmentation across CLI, web, and repositories
- Inconsistent or missing review paths for quality control
- Weak visibility into workstation/agent availability and status
- Difficult community collaboration without permission-aware public views
- Unstable repository identification and worktree churn
These issues slow iteration, reduce code quality, and discourage broader participation.

## Proposed Solution
Solo Unicorn! unifies development into a mission-based system with a least-powerful communication principle and a clear flow of stages (Clarify → Plan → Code → Review when enabled). It integrates:
- Workstation-centric orchestration (agents run on user machines) with Monster Realtime for presence/assignment
- Optional PR mode with GitHub integration for production-grade governance
- Public Projects with role-based permissions and discovery features
- Hybrid document management (solution and tasks stored in the filesystem; progress in DB) for durable cross-session context
- Stable repository IDs (GitHub numeric ID) and Git worktrees for parallel development

Key differentiators:
- Flow-first mission creation and stage control (with human review points)
- Explicit MVP boundaries and pragmatic tech choices (e.g., Cloudflare Tunnel choice; simple permission checks in app layer)
- MCP-first design with REST adapters for external consumers

## Target Users
Primary user segment: Small product teams and individual developers orchestrating AI code agents
- Behaviors: Frequent iteration, branch-based workflows, lightweight process, desire for control when moving to prod
- Needs: Reliable mission flow, optional PR review, clear workstation/agent visibility, simple repository scaling

Secondary user segment: Open-source maintainers and communities
- Behaviors: Public collaboration, external contributors, need for visibility with guardrails
- Needs: Public Projects with permission-aware views, contributor onboarding, discoverability, and analytics

## Goals & Success Metrics
Business objectives
- Reduce cycle time from idea to merged code in PR mode
- Increase mission throughput per week without sacrificing quality
- Enable public collaboration to grow community engagement

User success metrics
- Time to first mission completed (TTFM)
- PR mode average iteration times under 2 review cycles until approval
- PR review-to-merge time (when PR mode enabled)
- Contributor conversion rate on Public Projects (request → approved → first mission)

KPIs
- Missions/week per active project: target +30% vs baseline
- PR mode adoption in production projects: target 60%+
- Public Project stars/uses as template: growth MoM

## MVP Scope
Core features (Must Have)
- Authentication & authorization via Monster Auth; organization multi-tenancy; role-based access (owner, admin, member)
- Workstation registration, presence, and mission assignment via Monster Realtime
- Mission management with flow-first creation, default stages (clarify, plan, code), optional human review points
- Optional PR flow with GitHub: auto-create PRs in Review stage; human review occurs in GitHub; iterate via GH comments using CLI
- Repository and worktree handling: stable GitHub numeric repo ID; CLI auto-manages clone/worktree on first mission
- Hybrid Solution & Tasks document management: solution.md and tasks/{n}.md under ./solo-unicorn-docs/missions/{id}/ with DB tracking of progress
- Public Projects with granular, role-based permission controls and permission-aware UI/API responses
- MCP-first design for domain operations; REST endpoints as adapters for external use; oRPC reserved for internal web-server calls

Out of scope for MVP
- Dynamic prompt generation (server-calls client-hosted prompt endpoint)
- In-app PR comment UI (reviews happen in GitHub; Solo Unicorn links/status only)
- CLI “dev-server” and “tunnel” UX (documented as post-MVP in CLI design)
- SQL permission helper functions as runtime gates (permission checks live in app layer for MVP)

MVP success criteria
- End-to-end mission flow operational (create → execute → review/merge or done) across web + CLI + agents
- At least one project using PR mode in production successfully
- At least one Public Project discoverable with measured engagement (views, stars)

## Post-MVP Vision
Phase 2 features
- PR comments ingestion UI and richer review flows inside Solo Unicorn
- Mission templates, actor expansions, and multi-agent orchestration
- Public gallery curation and template library growth

Long-term vision
- Ecosystem of reusable workflows and templates that accelerate delivery for teams and communities
- Advanced analytics (mission throughput, bottlenecks) driving continuous improvement

Expansion opportunities
- Additional VCS providers; enriched public API for third-party tools; deeper CI/CD integrations

## Technical Considerations
Platform requirements
- Target platforms: Web UI + CLI (macOS, Windows, Linux)
- Browser/OS support: Modern evergreen browsers; CLI cross-platform support
- Performance: MVP prioritizes correctness and reliability; caching/optimizations deferred per docs

Technology preferences (per foundation docs)
- App layer in TypeScript; PostgreSQL database (NeonDB for alpha, RDS for prod)
- Monster Auth (authn) + app-layer authz; Monster Realtime WebSocket presence
- MCP-first interfaces; REST for external integrations; oRPC for internal web↔server
- Cloudflare Tunnel chosen for public dev URL strategy (platform-managed; CLI tunnel UX post-MVP)

Architecture considerations
- Repository identification: GitHub numeric repo ID is canonical; support for additionalRepositoryIds
- Git worktrees for parallel development; auto-managed by CLI on first mission
- Solution & tasks docs in filesystem with DB-tracked progress for cross-session context
- Public Projects permission model with role-based, permission-aware UI/API responses
- Security: TLS; input validation; rate limiting; audit logging; never expose sensitive workstation data for public access

## Constraints & Assumptions
Constraints
- Budget/time: Favor simple, reliable implementations for MVP; defer non-critical optimizations
- Resources: Agents run client-side; server orchestrates with minimal state for agents
- Technical: App-layer permissions; MCP-first; static prompts for MVP; GitHub primary VCS

Key assumptions
- Teams vary between YOLO (direct push) and PR mode based on maturity
- Community value requires permission-aware public views and simple contributor onboarding
- Stable repository identifiers are required to avoid drift/renames

## Risks & Open Questions
Key risks
- Code agent rate limits and availability impacting mission throughput
- Public Projects privacy boundaries (e.g., workstation visibility) must be carefully enforced
- PR flow complexity (e.g., merge conflicts, iteration loops) requires robust UX

Open questions
- Default flows and stage requirements per project: which review gates should be on by default?
- Priority and scheduling heuristics for loop missions to maximize budgets
- How to sequence Public Project gallery features without distracting from core delivery

Areas needing further research
- Optimal elicitation patterns for generating solution/tasks consistently
- Benchmarks for agent session timeouts and retry strategies
- Metrics model for public engagement (stars, contributions) and anti-abuse rate limits

## Appendices
References
- docs/foundation/001-feature-requirements.md (features, MVP notes, public projects, APIs)
- docs/foundation/002-web-design.md (kanban, mission modal, public project UI/UX, mobile)
- docs/foundation/003-cli-design.md (CLI architecture/commands, worktrees, security, PR support)
- docs/foundation/004-db-design.md (schema: orgs, users, workstations, projects, missions, PRs, permissions)
- docs/foundation/005-api-and-mcp-design.md (MCP-first + REST adapters)
- docs/foundation/006-rpc-design.md (oRPC for internal HTTP, TanStack Query cache mapping)

## Next Steps
Immediate actions
1) Validate this brief with stakeholders; confirm MVP vs Post-MVP boundaries
2) If accepted, generate a PRD using the PM agent or BMAD template
3) Derive epics and seed initial missions from MVP scope
4) Prepare repository linking and workstation registration checklists
5) Decide initial default flow configuration (review gates) and actor profiles

PM handoff
This Project Brief provides the full context for Solo Unicorn!. Please proceed to PRD generation, working section-by-section with the relevant stakeholders and templates, and capture any additional constraints as they surface.
