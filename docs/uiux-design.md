# Solo Unicorn — Simplified UI/UX Design

This document describes the extremely simplified UI/UX for Solo Unicorn, reflecting the least powerful principle: one user, one machine, one coding session at a time.

## Board Layout

### 3-Column Kanban Board

Simple, clean board with only essential columns:

```text
+-------------------------------------------------------------------------------------------------------------+
| Solo Unicorn | Project: My App [▼] | + New Task | Repo Agents: Claude Code (active) | Profile |
+-------------------------------------------------------------------------------------------------------------+
|  Todo                           |  Doing                           |  Done                                |
|  ┌───────────────────────────┐  |  ┌───────────────────────────┐  |  ┌─────────────────────────────┐  |
|  | [P1] Task A              |  |  | [P2] Task C (Refine)     |  |  | [P3] Task E                 |  |
|  | Main Repo (Claude Code)  |  |  | Main Repo (Claude Code)  |  |  | Frontend (OpenCode)         |  |
|  | Default Actor            |  |  | Custom Actor             |  |  | Default Actor               |  |
|  | Ready [☑]   📎2          |  |  | Stage: Refine ●○○        |  |  | Completed 2h ago            |  |
|  | [Delete]                 |  |  | [Delete]                 |  |  | [Delete]                    |  |
|  └───────────────────────────┘  |  └───────────────────────────┘  |  └─────────────────────────────┘  |
|  ┌───────────────────────────┐  |  ┌───────────────────────────┐  |                                  |
|  | [P1] Task B              |  |  | [P1] Task D (Execute)    |  |                                  |
|  | Main Repo (Claude Code)  |  |  | Main Repo (Claude Code)  |  |                                  |
|  | Ready [☐]                |  |  | Stage: Execute ●●●       |  |                                  |
|  | [Delete]                 |  |  | [Delete]                 |  |                                  |
|  └───────────────────────────┘  |  └───────────────────────────┘  |                                  |
+-------------------------------------------------------------------------------------------------------------+
```

### Card Information

**Todo Cards:**
- Priority (P1-P5)
- Title (raw)
- Repo Agent selection
- Actor selection
- Ready checkbox
- Attachment count
- Delete button

**Doing Cards:**
- Priority and title (refined if available)
- Repo Agent
- Stage indicator: Refine ●○○, Kickoff ●●○, Execute ●●●
- Progress info
- Delete button

**Done Cards:**
- Priority and title (refined)
- Repo Agent
- Completion timestamp
- Delete button

## Task Creation Flow

### 1. Click "+ New Task"

Simple modal with minimal fields:

```text
+----------------------------------+
| Create New Task                  |
+----------------------------------+
| Title: [........................] |
| Description (optional):          |
| [...........................]    |
| [...........................]    |
|                                  |
| Repo Agent: [Main Repo (Claude)] |
| Actor: [Default Actor ▼]         |
| Priority: [P3 ▼]                 |
| Attachments: [Drag & Drop]       |
|                                  |
| [Cancel]              [Create]   |
+----------------------------------+
```

### 2. Mark Ready When Ready

After creating task, human ticks "Ready" checkbox when ready for AI pickup.

## Task Drawer (Simplified)

Click any card to open simplified drawer:

```text
+-------------------------------------------------------- Task Drawer ----------------------+
| TASK-123: Implement user authentication                                           [×]   |
| Status: Doing • Stage: Execute • Priority: P1                                            |
| Repo Agent: Main Repo (Claude Code) • Actor: Default Actor                               |
+-------------------------------------------------------------------------------------------+
| Raw Information                                                                           |
| Title: user login                                                                         |
| Description: need login page                                                              |
| Attachments: wireframe.png                                                               |
+-------------------------------------------------------------------------------------------+
| Refined Information (Agent Generated)                                                     |
| Title: Implement user authentication with email/password                                 |
| Description: Create login page, authentication service, and session management          |
+-------------------------------------------------------------------------------------------+
| Plan (Agent Generated - Kickoff Results)                                                 |
| Selected Solution: OAuth + JWT tokens                                                    |
| Spec: Implement Google OAuth integration with JWT tokens for session management.        |
| Use secure HTTP-only cookies, redirect to dashboard on success.                         |
+-------------------------------------------------------------------------------------------+
| Project Memory                                                                            |
| [View/Edit Project Memory] - includes context for all agent sessions                     |
+-------------------------------------------------------------------------------------------+
| Actions                                                                                   |
| [Mark as Done] [Delete Task] [Open in Claude Code] (if session active)                  |
+-------------------------------------------------------------------------------------------+
```

## Project Setup

### Project Configuration Page

```text
+----------------------------- Project Settings -------------------------------+
| Project: My App                                                    [Save]   |
+---------------------------------------------------------------------------+
| Memory                                                                      |
| [Edit in Modal] - Project context included in all agent prompts           |
|                                                                            |
| Repo Agents                                             [+ Add Repo Agent] |
| ┌─────────────────────────────────────────────────────────────────────┐   |
| │ Main Repo (Claude Code)                                    [Edit] [×] │   |
| │ Path: /home/user/repos/my-app                                        │   |
| │ Client: Claude Code                                                  │   |
| │ Status: Active                                                       │   |
| └─────────────────────────────────────────────────────────────────────┘   |
| ┌─────────────────────────────────────────────────────────────────────┐   |
| │ Frontend (OpenCode)                                        [Edit] [×] │   |
| │ Path: /home/user/repos/my-app-frontend                               │   |
| │ Client: OpenCode                                                     │   |
| │ Status: Idle                                                         │   |
| └─────────────────────────────────────────────────────────────────────┘   |
|                                                                            |
| Actors                                                         [+ Add Actor] |
| ┌─────────────────────────────────────────────────────────────────────┐   |
| │ Default Actor (Default)                                    [Edit] [×] │   |
| │ Full-Stack Engineering Agent focused on working solutions           │   |
| └─────────────────────────────────────────────────────────────────────┘   |
+---------------------------------------------------------------------------+
```

## Mobile Experience

### Board View
- Horizontal scrolling columns
- Swipe to navigate between Todo, Doing, Done
- Tap card to open full-screen drawer

### Task Creation
- Full-screen modal with simplified form
- Voice input support for title/description

### Task Drawer
- Full-screen view with same information
- Bottom action bar for primary actions

## Key Interactions

### Task Lifecycle
1. **Create**: Human creates task with raw title/description
2. **Ready**: Human marks task ready when prepared
3. **Pickup**: Agent automatically picks up highest priority ready task
4. **Refine**: Agent updates with refined title/description
5. **Kickoff**: Agent creates solution options and plan
6. **Execute**: Agent implements the plan
7. **Done**: Agent moves task to done

### Drag and Drop
- Drag from Todo → Doing: Sets status to doing (if ready)
- Drag from Doing → Done: Marks as completed
- Drag from Done → Todo: Reopens task
- No QA column - simplified workflow

### Agent Status
- Header shows active repo agent sessions
- Only one active session per client type
- Real-time status updates via WebSocket

## Removed Features

All complex features removed for extreme simplification:

- ❌ Blocked flag/badges
- ❌ QA column and requirements
- ❌ Ask Human button
- ❌ Start/Pause Agent buttons
- ❌ Comments and Questions
- ❌ Checklists
- ❌ Chat system
- ❌ Multiple boards per project
- ❌ Assignment history
- ❌ Complex notifications
- ❌ Voice input
- ❌ Multiple active sessions
- ❌ Rate limit UI

## Implementation Notes

### Components (apps/web)
- `SimplifiedBoard` - 3 columns with drag/drop
- `TaskCard` - minimal card display
- `TaskDrawer` - simplified task details
- `CreateTaskModal` - basic task creation
- `ProjectSettings` - repo agents and actors config

### State Management
- `useProject` - project data and memory
- `useTasks` - task CRUD and status updates
- `useWebSocket` - real-time agent communication
- `useDragDrop` - column movements

### Mobile Considerations
- Responsive design with horizontal scrolling
- Touch-friendly interactions
- Full-screen modals on mobile
- Simplified navigation

This simplified design focuses on the core workflow: create task → mark ready → agent picks up → agent completes → done. Everything else is removed to achieve maximum simplicity.