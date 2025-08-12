# Solo Unicorn — UI/UX Design (MVP)

This document captures the selected MVP UI/UX direction and key interaction details. It reflects the requirements and user preferences: Trello-inspired board, Blocked as a flag (not a column), a dedicated QA column (but optional per task), persistent kickoff history, assignment history, and task attachments with image support.

## Board

Approach: Board-first with slide-over Task Drawer (Trello-inspired)

- Board as the primary view with columns and drag-and-drop
- Right-side task drawer for fast drill-in and edits
- Mobile-first considerations (columns scroll horizontally, task opens in full-screen sheet)

### Columns

- Columns: `Todo`, `In Progress`, `QA`, `Done`
  - Optional column (collapsed by default): `Paused`
- Blocked is a boolean flag (badge), not a column
- QA is a distinct column; tasks can skip QA if not required

ASCII (desktop)

```text
---------------------------------------------------------------------------------------------------------------+
| Solo Unicorn | Project [▼] | + New Task | Search [..........] | Agents: 2 online • Running 1 | ⏸ Pause All Agents | Profile |
---------------------------------------------------------------------------------------------------------------+
|  Todo                           |  In Progress                     |  QA                           |  Done       |
|  ┌───────────────────────────┐  |  ┌───────────────────────────┐  |  ┌────────────────────────┐  |  ...        |
|  | [P2] Task A              |  |  | [P1] Task C              |  |  | [P1] Task E (QA req)   |  |             |
|  | stage: spec              |  |  | stage: dev               |  |  | stage: qa              |  |             |
|  | assignee: Agent          |  |  | assignee: Human          |  |  | assignee: Agent        |  |             |
|  | Auto-Start [☐]  ⏸ Agent Paused |  |  | Auto-Start [☑]          |  |  | Auto-Start [☑]         |  |             |
|  | badges: 📎2 💬3            |  |  | badges: ⛔ blocked        |  |  | badges: 📎1            |  |             |
|  └───────────────────────────┘  |  └───────────────────────────┘  |  └────────────────────────┘  |             |
|  ...                                                                                                           |
---------------------------------------------------------------------------------------------------------------
```

Notes

- Drag between columns updates `status` to `todo | in_progress | qa | done | paused`
- Blocked is a toggle badge (⛔), independent of column
- QA column shows tasks where QA is required or currently in QA; other tasks may move from In Progress → Done directly
- Per-card Auto-Start/Agent Paused: `Auto-Start` controls whether agents auto-start on stage triggers; `Agent Paused` indicates the card is paused for agents
- Project-level "Pause All Agents" pauses all agent activity for this project
- Agent-level rate limit UX (Agent-centric controller):
  - Enforce single active Claude session (concurrency=1)
  - When a rate limit occurs, show persistent banners in the task drawer and a yellow "Needs attention" badge on the card
  - Display agent-level status in header chip with countdown to resume
  - Provide actions: Retry now, Snooze (+15m or until reset), View details
  - Record incidents for analytics (occurrence, inferred reset, retries)
- Prioritization (MVP note): Use simple FIFO within `Todo` — cards are ordered manually; agents pick the top-most `Auto-Start`-enabled card first

### Task card (board tile)

- Title, priority badge, stage chip, assignee avatar/name
- Badges: blocked (⛔), attachments count (📎), comments (💬), questions (❓)
- Optional mini-pipeline dots for stage progress
- Claude Code link: if the task has a recent/active agent session, show “Open in Claude Code” link/icon to the session
  - Example: `http://172.22.208.25:8888/session/<session-id>` (e.g., `http://172.22.208.25:8888/session/18b64b03-bc9c-406e-a37f-34e9a5a2471a`)

### Task drawer (slide-over)

Appears from the right on card click. Mirrors Trello’s simplicity with structured tabs and persistent histories.

ASCII (drawer)

```text
+---------------------------------------------------------------------------------------- Drawer --+
| [Status: In Progress ▼] [Stage: dev ▼]           TASK-123: Improve Checklist               [⋯]   |
| Assignee: Agent [Engineer ▼]   Auto-Start [☑]  [Start/Pause Agent]  [Ask Human]  QA Required [☐] |
| [Open in Claude Code]  (links to latest session if exists)                                         |
| Pipeline: kickoff - spec - design - [dev]* - qa - done                                             |
| Tabs: Overview | Kickoff | Checklist | Comments | Attachments | Events | Questions                 |
| ----------------------------------------------------------------------------------------------     |
| Overview                                                                                           |
| - Description (Markdown render, 🎤 input toggle)                                                    |
| - Metadata (priority, links)                                                                       |
| - Quick toggles: Blocked [⛔]  Paused [⏸]  QA Required [☑/☐]                                        |
| ----------------------------------------------------------------------------------------------     |
| Kickoff (history preserved)                                                                         |
| - Challenge the idea: [timeline of entries with author/time; latest visible; view history]         |
| - Options list & ranking: [sortable list; past versions accessible]                                 |
| - Selected option: [current selection + previous selections history]                                |
| - Spec: [markdown editor + version history]                                                         |
| ----------------------------------------------------------------------------------------------     |
| Checklist (by stage)                                                                                |
| - Dev: [ ] Clarify requirement  [ ] Challenge assumptions  [ ] List options  [ ] Select option      |
| - [Add item]                                                                                        |
| ----------------------------------------------------------------------------------------------     |
| Comments (Kickoff) (🎤)                                                                              |
| [agent] Plan step...                                                                               |
| [human] OK                                                                                         |
| [input.............................................] [Send] [🎤]                                    |
| ----------------------------------------------------------------------------------------------     |
| Attachments (images/files)                                                                          |
| - Grid thumbnails for images with preview lightbox                                                  |
| - Other files as rows with kind icon and download/open                                              |
| - [Drag & drop here] [Upload]                                                                       |
| ----------------------------------------------------------------------------------------------     |
| Events | Questions                                                                                  |
| - Assignment history (popover + entries): assigned/reassigned/unassigned with actor/time            |
| - Status/stage changes, artifacts added, questions raised/resolved                                  |
| - Agent incidents (rate limit/errors) with actions: Retry, Snooze, View details                     |
+-----------------------------------------------------------------------------------------------------+
```

### Mobile behavior

- Board columns scroll horizontally; card opens full-screen sheet with the same tabs
- Persistent header with Status, Stage, Blocked toggle, QA Required toggle, Assignee, Agent controls
- Bottom sticky action bar on the sheet for Start/Pause Agent, Ask Human, Add Attachment

### Interactions and rules

- Blocked flag
  - Toggle on card or in drawer; renders red ⛔ badge
  - Does not move the card; can be filtered globally
- QA column and QA Required
  - `QA Required` toggle per task controls whether the task should flow through the QA column
  - Moving a card into `QA` sets `status=qa` (even if toggle is off); moving out clears `qa` status
  - Automations: on stage change to `qa`, if `QA Required` is off, propose skip-to-done action
- Stage pipeline
  - Visual pipeline chip row independent of columns; editable from drawer
  - On stage change, run default hooks: notify assignee, create next-stage checklist, start/stop agent
- Agent readiness and pause
  - Per-card `agent_ready` flag governs auto-start behavior on triggers; manual Start/Pause always available
  - Project-level Pause All toggles a project `agent_paused` control to suspend agent sessions
- Claude Code rate limits (Agent-centric controller)
  - Agent state machine: `idle | starting | running | paused | rate_limited | error`
  - Strict single-session: agent runs at most one coding session at a time
  - On rate limit: set agent state to `rate_limited`, compute ETA if available, persist incident, and schedule retry
  - UI surfaces: header chip (countdown), card badge “Needs attention: Rate limit”, drawer banner with actions
  - No auto-move to Done on ambiguous completion; require verified success or human confirm
- Kickoff guardrails (agent self-pause and questions)
  - During kickoff, the agent may self-pause and raise a question to the human; the card is automatically marked blocked until answered
  - Questions appear in the card’s Questions tab and project notifications; answering unblocks and resumes the agent if `agent_ready`
- Claude Code linking
  - The board card and drawer header expose an “Open in Claude Code” link to the most recent `AGENT_SESSION` for the task (prefer running, else latest finished)
  - If no session exists yet, the action is disabled with a tooltip
- Assignment history
  - Every assignment change is recorded and surfaced in Events and a quick header popover
- Attachments
  - Labeled as “Attachments” in the UI; supports images with thumbnails and preview
  - Backed by artifacts storage; drag-and-drop and mobile upload supported

### Data model notes (MVP-aligned deltas)

- Task status lanes: include `qa`, remove `blocked` as a status
  - Status suggested set: `todo | in_progress | qa | done | paused`
- Add `task.is_blocked boolean default false` (blocked becomes a flag)
- Add `task.qa_required boolean default false` (controls flow through QA column)
- Add `task.agent_ready boolean default false` (card-level control for auto-start)
- Add `project.agent_paused boolean default false` (project-level Pause All)
- Agent pool and rate limits
  - Multiple `agent` rows represent the pool; summarize online/running in UI
  - Track budget in `agent.config.rate_limits` (jsonb) e.g., `{ hourly: {limit, used}, weekly: {limit, used} }`
  - Optionally add `agent_usage` materialized view or counters derived from `agent_action`
- Assignment history
  - Extend `task_event.type` to include `assigned | unassigned | reassigned`
  - Payload includes `from`, `to`, and `by`
- Attachments
  - Use `task_artifact kind=file` and label as “Attachment” in UI; `meta.contentType` enables image preview
  - Optionally add `kind=attachment` alias for clarity; both map to UI “Attachments”
- Kickoff history
  - Store structured entries under `task.metadata.kickoff` with arrays of timestamped records for: `challenge_md`, `options_md` (with ranks), `selected_option`, `spec_md`
  - Additionally mirror significant updates as `task_event` for auditability

These changes are backward-compatible with the current ERD direction and can be implemented incrementally.

### Highlights (what’s new/decided)

- Trello-inspired board + drawer is the MVP UI
- Blocked is a flag/badge, not a column
- QA is a dedicated column; tasks can skip QA if `QA Required` is off
- The task view keeps kickoff history (challenge, options+rank, selected option, spec)
- Assignment history is first-class and visible
- Attachments (esp. images) are supported with thumbnails and preview

### Why this works for MVP

- Fast to build with shadcn/ui components (Drawer, Tabs, Badges, Avatars, Upload)
- Matches single-user Kanban flow; mobile-friendly via sheets and horizontal columns
- Clean separation of status lanes vs stage pipeline; automations map to stage changes
- Deep work remains possible by later adding a dedicated Task Workspace route, without changing the board mental model

### Implementation sketch (apps/web)

- Routes
  - `/projects/:id/board` (default)
  - `/tasks/:id` (deep link opens drawer; on mobile opens full-screen)
- Components
  - `BoardColumns` (DnD, lane filters, collapsed `Paused`)
  - `TaskCard` (badges: ⛔, 📎, 💬, ❓; stage chip; assignee)
  - `TaskDrawer` with Tabs: Overview, Kickoff, Checklist, Messages, Attachments, Events, Questions
  - `StagePipeline`, `AssignmentHistoryPopover`, `AttachmentGrid`
- Hooks/State
  - `useTask` (status, stage, flags, qa_required)
  - `useDnD` (column moves → status update)
  - `useUploader` (attachments)

### ASCII quick-reference (mobile sheet)

```text
+--------------------------------------------------------------+
| TASK-123: Improve Checklist                                  |
| Status [In Progress▼]  Stage [dev▼]  ⛔[ ]  QA Req [ ]  [⋯]   |
| Assignee [Agent ▼]      [Start/Pause]  [Ask Human]           |
+--------------------------------------------------------------+
| Tabs: Overview | Kickoff | Checklist | Messages | Attachments |
| Overview: Description (md, 🎤)                                 |
| Kickoff: Challenge • Options • Selected • Spec (history)      |
| Checklist: per-stage items                                    |
| Comments (Kickoff): thread + input                             |
| Attachments: image grid + files                               |
+--------------------------------------------------------------+
```

## Chat

Purpose: Brainstorm ideas, discuss solutions, coordinate with agents/human, and turn outcomes into actionable updates. Single chat space (no multiple channels) with titled threads (ChatGPT-style). Supports typing `@` or clicking quick-mention buttons to tag actors (agents, roles, human owner). Task-scoped comments remain in the card (Kickoff Comments tab) and are distinct from chat.

### Single Chat with Titled Threads (ChatGPT-style)

ASCII (desktop)

```text
+--------------------------------------------------------------------------------------------------+
| Solo Unicorn | Project [▼] | Board | Chat | Search | Agents: 2 online | Rate: 45/100h | Profile |
+------------------------------+-------------------------------------------------------------------+
| Threads                      | Thread: New business line — Mobile Agent Runner      [New Thread]  |
| - New business line          | ----------------------------------------------------------------  |
| - Architecture options       |  [09:31] You (title): Explore a mobile agent runner MVP scope     |
| - Tooling & rate limits      |  [09:32] Agent(Engineer): Constraints: device APIs, offline, cost |
|                              |  [09:33] You: Feasibility? Risks? Monetization options?           |
|                              |  └─ Replies (3)                                                  |
| Mentions                     |     • You: Option A native app; Option B PWA; Option C SDK        |
| - @ You                      |     • Agent: Suggests PWA pilot with limited toolset              |
| - @ Engineer (Agent)         |     • You: Next: draft scope doc and validate with 3 users        |
|                              | ----------------------------------------------------------------  |
| Quick mention: [@Engineer] [@PM] [@Designer] [@QA] [@All]  [Attach] [Create Decision] [⋯]      |
| [ Title .................. ]                                                                     |
| [ + New post.................................................. ] [Post] [🎤]                    |
+--------------------------------------------------------------------------------------------------+
```

Highlights

- Single forum space with titled threads; no channel sprawl
- `@` mentions and quick-mention buttons for common actors/roles
- Convert posts/threads to artifacts: Decision, Spec update, Checklist items, or Questions
- Link or create tasks inline: “Apply to TASK-123” → updates kickoff/spec history

#### Task-Scoped Kickoff Comments (Embedded) with Bridge to Chat

ASCII (task drawer kickoffs tab)

```text
+--------------------------------- TASK-123: Kickoff Comments ------------------------------------+
| [09:31] You: Challenge: Is QA needed if QA Required is off?                                     |
| [09:32] Agent(Engineer): We can skip QA if low risk.                                            |
| [09:33] You: Selecting option #2 (Prototype)                                                    |
|        [Save as Kickoff → Selected Option] [Add to Spec] [Create Checklist Items]               |
| ------------------------------------------------------------------------------------------------ |
| Quick mention: [@Engineer] [@PM] [@Designer] [@QA]  [Attach] [Decision] [Question to Human]     |
| [ + New comment............................................. ] [Send] [🎤]  [Open in Forum]      |
+--------------------------------------------------------------------------------------------------+
```

Highlights

- Chat lives where the work happens; one click to push to project channel
- Buttons to convert messages into kickoff history, spec, checklist, or questions
- All messages auto-linked to the task and appear in Events

### Key interactions

- Mentions: type `@` to search actors (human owner, agents by role), or tap quick-mention buttons
- Message → Action buttons:
  - Save as Kickoff entry: Challenge, Options+Rank, Selected Option, Spec
  - Create/append to Checklist items
  - Create Question to Human (blocks/unblocks as needed)
  - Create Decision (adds to Events and Kickoff history)
  - Link/create Task, or “Apply to TASK-123” if context known
- Attachments: drag/drop or mobile upload (image preview, file rows). Stored as Attachments; messages display inline thumbnails
- AI Assist: Summarize thread, extract decisions, propose next steps, generate checklist items

#### Data model notes (Chat)

- New tables (minimal, future-proof):
  - `chat_channel`: id PK; scope_type `project|board|task`; scope_id FK; name; topic; created_at
  - `chat_message`: id PK; channel_id FK; parent_message_id (thread) nullable; author `human|agent|system`; content_md; mentions jsonb[]; at timestamptz
  - Reactions (optional later): `chat_reaction` with message_id, emoji, author
- Attachments: reuse `task_artifact` with `kind=file|image|link|log` and `meta`. For non-task channels, allow `message_id` linkage or introduce a general `attachment` table; UI labels as “Attachments”
- Mentions: store canonical entity references `{type:"agent|user|role", id, label}`
- Bridges: when a chat action updates a task, emit `task_event` entries and update `task.metadata.kickoff` accordingly

#### Implementation notes

- UI: Tabs and sidebars with shadcn/ui; emoji reactions optional later
- Search: simple full-text on `content_md`; filters for mentions and channel
- Notifications: in-app mention highlights; optional future email/webhook
- Agent presence: show “Agent (Engineer) is listening…”; `@Engineer` can trigger a question or action via the Agent Gateway
