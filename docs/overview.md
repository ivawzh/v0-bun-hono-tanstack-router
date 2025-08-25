# Solo Unicorn Project Overview

## Vision and Goal

**We provide**:

- Hub of AI agents.
- Task management system for dispatching tasks to AI agents. We are like Trello for AI tasks.
- Efficient AI agent orchestration.
- Flexible AI workflow framework.
- Easy switch to different agent types. We are like OpenRouter for coding agent CLIs.
- Web UI for code agent CLIs.
- Context preservation across repos, agents, tasks and sessions.
- Multi-repo coordination.

**Our differentiator to other AI tools**: We're focusing on AI task orchestration while leaving coding execution to proven tools.

**Typical user groups**:

- For dev users, we are the "task management brain" that sits between requirements and their AI coding agents.
- For startup founders without tech background, we are the (TBD).
- For (TBD), we are the magic between ideas to results.

## Basic UX

- Setup UX: Create project, configure repo, agents, and start tasking
- Tasking UX: AI agents autonomously clarify, plan, execute and loop tasks

## Tech stack

- Web: React + TanStack Router (apps/web)
- UI: TailwindCSS + shadcn/ui component library
- Server: Hono + oRPC (apps/server)
- Runtime: Bun
- ORM: Drizzle
- Database: PostgreSQL
- Validation: Valibot
- MCP: stateless http @modelcontextprotocol/sdk/server/mcp
- WebSocket: Bun std `Bun.serve({ websocket })`
- Auth: Monster Auth

## Facts

1. **Current Usage Pattern**: Primarily using Claude Code agent client type, which is the most powerful agent in the market.
1. **Claude Code Max Subscription price**: $100-$200/month. Very expensive. Implied their user group is rich.
1. **Claude Code Max Subscription rate limit**: Monthly access with unknown rate limits (hourly, daily, or monthly) that change without notice
1. **Claude Code Capabilities**:
   - Supports additional working directories for multi-repo access and all-in-one manipulation
   - Rate limit refresh times are provided when limits are hit
   - Can switch accounts via `CLAUDE_CONFIG_DIR` environment variable
   - Session resuming: Reusing session IDs preserves conversation context and memory across task modes
1. **Conflict Management Philosophy**: Easier to maintain one active session per repo to avoid git conflicts, but should be configurable
1. **Rate Limit Handling**: Need to re-feed ongoing tasks when rate limits refresh.

## Core Entities

### Project

- Single board per project (no separate board entity)
- Project memory stored in database (viewable/editable by human)
- Contains configured repos, agents and actors
- **Authorization-First**: All operations secured with project-user authorization

### Repo

- Repo path is a directory on the filesystem.
- `maxConcurrencyLimit`: 0 = limitless, >0 = max concurrent cards per repository
- `lastTaskPushedAt` to avoid spamming

## Agent

- The only agent type is Claude Code
- `maxConcurrencyLimit`: 0 = limitless (default), >0 = max concurrent cards per agent
- `lastTaskPushedAt` to avoid spamming
- `agentSettings` to store fields like CLAUDE_CONFIG_DIR. CLAUDE_CONFIG_DIR basically represents Claude Code account, so that we can switch agent (i.e. Claude Code account) while one agent is rate limited. This is also why card can have multiple agents assigned.

### Actor

- Basically LLM character card, that is injected into agent prompt
- Describes agent mindset, principles, focus, methodology, values
- Not bound to repo or agent - assigned per card
- Default Actor for unspecified tasks

### Task (Card)

- `ready` checkbox to mark ready for AI pickup
- `mode` controls what prompt to use. Eventually, we might allow user to create and modify mode and prompt.
- **Regular tasks**: Todo → Doing → Done
- **Loop tasks**: Loop → Doing → Loop (infinite cycle)
- Doing has 3 modes: clarify → Plan → Execute
- Loop has 1 mode: loop (never changes)
- Must have repo(s) and agent(s) assigned
- Optional additional repos for multi codebases manipulation at once.
- Optional actor assignment

## Project Setup UX

1. **Create Project**: Simple name and description
2. **Configure Repos and Agents**:
   - Add repository path. E.g. Todo app at "/home/repos/todo"
   - Add agent. E.g. "Claude Code"
3. **Configure Actors** (Optional):
   - Define agent personalities/methodologies
   - Assign to specific tasks or use default
4. **Project Memory**:
   - Stored in database (not git submodule)
   - Viewable and editable by human
   - Included in every session prompt like CLAUDE.md
   - Agents can read/modify via MCP

## Task Workflow

### Human Creates Task

- Write raw title and optional raw description
- Add optional attachments
- Select repo and agent
- Optionally select actor (or use default)
- Tick "Ready" checkbox when ready for AI pickup

### Agent Picks Up Task

Agents automatically pick up ready tasks in criteria -

**Scope**:

- task is ready
- task is not in done column
- task is not in the loop list
- task doesn't have an active agent session and is not being pushed
- task doesn't have any incomplete dependencies
- repo has not reached max concurrency limit
- has at least one available agent that
- is not rate limited
- has not reached max concurrency limit

**Order by**:

- priority (5-1)
- list order (doing > todo > loop)
- list order (3 > 2 > 1)
- createdAt (oldest first)

## Task modes

**Mode 1: clarify**

- Agent understands and refines the raw title/description
- Updates card with refined title and refined description
- Raw versions remain for reference
- Uses MCP to update card

**Mode 2: Plan**

- List solution options and rank them
- Select final solution approach
- Write spec
- Step breakdown
- Evaluate size and complexity.
  - If it's too big, split it into smaller cards. Move this card to Done.
  - If not too big, store plan (final solution, spec, step breakdown) in card's `plan` field.
- Interaction via MCP

**Mode 3: Execute**

- Real implementation using refined title, description, attachments, plan, actor, and project memory
- Make commits and push as needed
- Move to Done when complete

## Loop List - Repeatable Tasks

The Loop column stores repeatable cards that cycle infinitely to maintain project momentum.

**Loop Purpose:**

- **Repeatable Cards**: Cards that should be executed regularly (brainstorming, maintenance, reviews)
- **Project Continuity**: When Todo and Doing are empty, agents pick from Loop
- **Infinite Cycling**: Loop cards never reach "Done" - they return to Loop after completion

**Loop Workflow:**

1. **Card Selection**: When no regular cards available, agent picks from Loop (top of list)
2. **Execution**: Loop card moves to Doing with mode="loop" (never changes mode)
3. **Completion**: After execution, card returns to Loop (bottom of list)
4. **Rotation**: Bottom placement ensures all Loop cards get cycled through

**Loop Card Examples:

- "Brainstorm new feature ideas. Document in wiki."
- "Review and refactor old code for improvements."
- "Update project documentation and README."
- "Research competitor features and document findings."
- "Run comprehensive project health checks."

**Lifecyle**:

- **Regular tasks**: Todo → Doing → Done ✓
- **Loop tasks**: Loop → Doing → Loop → Doing → Loop... (never Done)

**Task Priority:**

1. Todo and Doing tasks (highest priority)
2. Loop tasks (when no regular tasks available)
3. Bottom placement after completion ensures fair rotation

The Loop list ensures projects never run out of productive work while maintaining continuous improvement and innovation cycles.

## Data Model

```mermaid
erDiagram
    Users ||--o{ ProjectUsers : member_of
    ProjectUsers }o--|| Projects : access_to
    Users ||--o{ Agents : owns
    Projects ||--o{ Repositories : defines
    Projects ||--o{ Cards : contains
    Projects ||--o{ Actors : contains
    Agents ||--o{ Cards : assigned_to
    Repositories ||--o{ Cards : main_repo
    Repositories ||--o{ CardRepositories : additional_repos
    Cards ||--o{ CardRepositories : uses_repos
```

## Server-to-Agent Communication

### Direct Claude Code Process Spawning

Solo Unicorn invokes Claude Code via its SDK:

- **Environment Variables**: Each spawned process gets task-specific environment variables (`SOLO_UNICORN_TASK_ID`, `SOLO_UNICORN_AGENT_ID`,  etc.)
- **Working Directory**: Processes are spawned in the repository's working directory
- **Rate Limit Hook**: Read session result and detect if Claude Code hits rate limits. If so, update agent and tasks status.

### Claude Code Hook System

Hook scripts track session lifecycle and maintain synchronization:

- **Session Start Hook**: Called when Claude Code session begins. Update card agent session info and maintain active/completed session IDs in JSON files at `~/.solo-unicorn/sessions/`
- **Session End Hook**: Called when Claude Code session completes. Update card agent session info and maintain active/completed session IDs in JSON files at `~/.solo-unicorn/sessions/`

### Solo Unicorn MCP Server

Claude Code communicates back via MCP tools embedded in prompts:

- **Card Updates**: `mcp__solo-unicorn__task_update` - Update card status, refined title/description, plan
- **Card Creation**: `mcp__solo-unicorn__task_create` - Create new tasks during execution
- **Project Memory**: `mcp__solo-unicorn__project_memory_update` - Update shared project context

### Synchronization Strategy

Solo Unicorn maintains card status synchronization through multiple channels:

1. **Database State**: Primary source of truth with `agentSessionStatus` (INACTIVE/PUSHING/ACTIVE)
2. **File Registry**: Session data persisted in `~/.solo-unicorn/sessions/` JSON files
3. **HTTP Callbacks**: Real-time status updates from hook scripts
4. **MCP Tools**: Card updates from within Claude Code sessions
5. **Monitoring System**: Periodic orphan detection and recovery

### Claude Code UI

Claude Code UI by default is monitoring the session file in `~/.claude/projects` to display session info on its web UI.

## Implementation Notes

- all AI prompts must be stored at `apps/server/src/agents/prompts`
- Use `startHotReloadSafeInterval()` instead of `setInterval()` for Bun hot reload compatibility
