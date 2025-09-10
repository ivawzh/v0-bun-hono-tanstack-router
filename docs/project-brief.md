# Project Brief: Solo Unicorn!

## Executive Summary

Solo Unicorn is an AI-centric platform that orchestrates AI agents through Kanban flows, providing a dynamic AI workflow framework. The platform supports both fast iteration (YOLO/direct push) and controlled development (PR mode) to fit different project maturity levels. It enables public project discovery, community contribution, and reusable templates to grow the ecosystem. The primary value proposition is helping solo founders build "Unicorn startups" by leveraging AI agents for accelerated development while maintaining human oversight through optional GitHub PR-based workflows.

## Problem Statement

Modern software development faces several critical challenges:

1. **Developer Productivity Bottlenecks**: Developers spend significant time on repetitive tasks, boilerplate code, and routine implementation work that could be automated.

2. **AI Orchestration Complexity**: While AI coding assistants exist, there's a lack of structured frameworks for orchestrating AI agents through complex development workflows with proper human oversight.

3. **Balancing Speed vs. Quality**: Teams struggle to balance rapid iteration with code quality and review processes. Early-stage projects need fast iteration, while production projects require controlled changes.

4. **Community Collaboration Barriers**: There's limited infrastructure for public projects to enable community contribution with granular permissions and proper access controls.

5. **Workstation Integration Gaps**: Existing solutions often require running code agents on servers or in the cloud, creating latency and privacy concerns.

The impact of these problems includes slower time-to-market, inconsistent code quality, difficulty managing technical debt, and limited community engagement for open-source projects. Current solutions either sacrifice control for speed or add too much process overhead, making them unsuitable for solo developers or small teams.

## Proposed Solution

Solo Unicorn addresses these challenges through a workstation-first architecture that orchestrates AI agents via structured Kanban flows:

1. **AI Agent Orchestration**: Structured mission-based workflows (Clarify → Plan → Code) that guide AI agents through development tasks with optional human review points.

2. **Flexible Development Modes**: Dual workflow support - Direct Push mode for rapid prototyping and PR mode for production-quality code with GitHub integration.

3. **Community-First Design**: Public project discovery with granular permission controls (Public, Contributor, Collaborator, Maintainer, Owner roles) enabling collaborative development.

4. **Workstation-Centric Execution**: AI agents run locally on user machines for privacy and performance, with the server orchestrating via Monster Realtime presence and WebSocket communication.

5. **Hybrid Documentation System**: Mission documentation stored in both filesystem (solution.md, tasks/{n}.md) and database for progress tracking and contextual prompting.

This solution succeeds where others haven't by providing a balanced approach that maintains developer control while maximizing AI assistance, with flexible workflows that adapt to project maturity.

## Target Users

### Primary User Segment: Solo Founders and Small Development Teams

Solo founders and small teams (1-10 developers) building software products who want to leverage AI for acceleration while maintaining control over their codebase. These users typically:

- Have limited development resources and need to maximize productivity
- Want to move fast in early stages but maintain quality as projects mature
- Seek community collaboration opportunities for their projects
- Value privacy and prefer local execution of AI agents
- Need flexible workflows that can adapt to different project phases

### Secondary User Segment: Open Source Project Maintainers

Maintainers of open-source projects looking to:

- Accelerate development through AI assistance
- Enable community contributions with proper access controls
- Manage public project discovery and engagement
- Maintain code quality through structured review processes
- Handle both rapid prototyping and production-ready code

## Goals & Success Metrics

### Business Objectives

- Accelerate software delivery by 3x compared to traditional development through AI-assisted missions
- Achieve 50% faster time-to-first-mission for new projects (from signup to first mission in Doing state)
- Enable 80% of missions to complete without human intervention in Direct Push mode
- Grow public project ecosystem to 1,000+ projects within first year
- Achieve 40% contributor conversion rate from public viewers to active contributors

### User Success Metrics

- Time-to-first-mission (TTFM) under 5 minutes for new projects
- 90%+ mission completion rate without human intervention in Direct Push mode
- PR mode average iteration times under 2 review cycles until approval
- Workstation online ratio above 95% with latency under 100ms
- Public project engagement with 20%+ view-to-contribution conversion

### Key Performance Indicators (KPIs)

- **Mission Throughput**: Average mission cycle time (created → done) under 30 minutes for simple tasks
- **Agent Utilization**: 85%+ workstation utilization during active development periods
- **Community Growth**: 100 new public projects and 500 new contributors per month
- **System Reliability**: 99.9% uptime for core orchestration services
- **User Retention**: 70% monthly active users returning within 30 days

## MVP Scope

### Core Features (Must Have)

- **Auth & Tenancy**: Monster Auth integration (OAuth, PAT, org API keys) with email as canonical identity and org-based multi-tenancy
- **Mission Management**: Kanban board (Todo/Doing/Review/Done) with flows (Clarify/Plan/Code), optional review, dependencies, loop missions, priority and list ordering
- **Workstation Management**: Registration, presence, agent availability reporting with repository concurrency controls
- **Repository Integration**: GitHub linking with numeric repo_id identification and CLI auto-management of git worktrees
- **Web UI**: Trello-like Kanban board with MissionView/MissionCreate modals, mobile-first responsive design
- **CLI**: Authentication, workstation lifecycle, repository management, agent detection/registration, configuration management
- **Database**: Schema supporting projects, missions, flows, actors, repositories, workstations, permissions with performance indexes

### Out of Scope for MVP

- In-app PR comments UI and full PR conversation sync (reviews occur in GitHub)
- Dynamic prompt generation (static prompt templates only)
- Rich community features beyond basic public visibility and minimal discovery
- Advanced dev-server/tunneling controls in CLI
- Streaming/partial document streaming for large specs
- Multi-agent orchestration beyond single Claude Code agent

### MVP Success Criteria

MVP is successful when users can:

1. Create a project and complete their first mission within 10 minutes
2. Successfully execute 90% of missions without errors in Direct Push mode
3. Complete PR mode workflows with average 2 or fewer review iterations
4. Achieve 95%+ uptime for core services during beta testing
5. Receive positive feedback from beta users on workflow intuitiveness

## Post-MVP Vision

### Phase 2 Features

- Enhanced PR mode with in-app comment UI and conversation sync
- Dynamic prompt generation based on project context
- Advanced community features (discussions, project analytics, leaderboards)
- Multi-agent orchestration for complex missions
- Streaming document support for large specifications
- Advanced dev-server and tunneling capabilities

### Long-term Vision

Solo Unicorn will become the standard platform for AI-assisted software development, with:

- Support for multiple AI agent types beyond Claude Code
- Enterprise-grade security and compliance features
- Integration with major project management tools (Jira, Linear, etc.)
- Marketplace for community-created flows and templates
- Advanced analytics and insights for development optimization

### Expansion Opportunities

- Extension to non-software domains (content creation, design, data analysis)
- Integration with low-code/no-code platforms
- Support for enterprise development workflows and compliance requirements
- AI agent marketplace with specialized capabilities
- Advanced collaboration features for distributed teams

## Technical Considerations

### Platform Requirements

- **Target Platforms**: Web application (Chrome, Firefox, Safari), CLI (macOS, Linux, Windows)
- **Browser/OS Support**: Modern browsers with ES2020+ support, Node.js 18+
- **Performance Requirements**: Mission assignment under 2 seconds, WebSocket latency under 100ms

### Technology Preferences

- **Frontend**: React 19 with TanStack Router, TanStack Query, shadcn/ui components, Tailwind CSS
- **Backend**: Bun with Hono.js, oRPC for internal communication, PostgreSQL database
- **Database**: PostgreSQL (NeonDB for alpha, AWS RDS for production)
- **CLI**: Bun-compiled single-file application
- **Hosting/Infrastructure**: Cloudflare for frontend, AWS for backend services, SST for deployment

### Architecture Considerations

- **Repository Structure**: Monorepo with clear separation of web, server, and CLI components
- **Service Architecture**: Monolithic with clear module separation (breaking changes allowed for web-server)
- **Integration Requirements**: GitHub API, Monster Auth, Monster Realtime, Monster Upload
- **Security/Compliance**: OAuth2 for authentication, encrypted token storage, CORS protection

### Integration with External Services

**Note**: This project integrates with several external Monster services that are hosted in separate repositories:

- **Auth**: Monster Auth. Read more at [Monster Auth](/monster-wiki/shared-services/monster-auth.md).
- **Websocket**: Monster Realtime. Read more at [Monster Realtime](/monster-wiki/shared-services/monster-realtime.md).
- **User uploads**: Monster Upload. Read more at [Monster Upload](/monster-wiki/shared-services/monster-upload.md).

These services are isolated from Solo Unicorn and must be integrated according to their respective documentation.

## Constraints & Assumptions

### Constraints

- **Budget**: Limited initial funding requiring cloud cost optimization
- **Timeline**: MVP target of 6 months with beta release
- **Resources**: Small development team (2-3 engineers) with part-time design support
- **Technical**: Dependency on Monster services for auth and realtime communication

### Key Assumptions

- GitHub will remain the dominant VCS provider for target users
- Users prefer local AI agent execution for privacy and performance
- Community will adopt public project sharing with appropriate permissions
- Claude Code will be sufficient as the primary AI agent for MVP
- Bun-compiled CLI will provide adequate cross-platform support

## Risks & Open Questions

### Key Risks

- **Adoption Risk**: Users may resist changing development workflows or sharing projects publicly
- **Technical Risk**: Monster service dependencies could create single points of failure
- **Competition Risk**: Major tech companies may launch competing solutions
- **Security Risk**: Permission leakage in public mode could expose sensitive information

### Open Questions

- What specific onboarding flow will maximize time-to-first-mission?
- How to balance automation with user control in mission workflows?
- What community features will drive the highest engagement?
- How to handle complex multi-repository missions in MVP?

### Areas Needing Further Research

- Optimal git worktree management strategies for parallel development
- Best practices for hybrid filesystem/database documentation storage
- Effective permission models for public project collaboration
- Agent scheduling algorithms for workstation presence-based assignment

## Next Steps

### Immediate Actions

1. Finalize core database schema design based on requirements
2. Implement basic authentication and organization management
3. Build MVP Kanban board with mission creation/editing
4. Develop CLI for workstation registration and agent management
5. Create initial flow templates (Clarify/Plan/Code)
6. Set up Monster Auth and Realtime service integrations
7. Design public project discovery and permission system

### PM Handoff

This Project Brief provides the full context for Solo Unicorn. Please start in 'PRD Generation Mode', review the brief thoroughly to work with the user to create the PRD section by section as the template indicates, asking for any necessary clarification or suggesting improvements.