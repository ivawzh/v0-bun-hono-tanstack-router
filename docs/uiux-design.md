# Solo Unicorn — Simplified UI/UX Design

This document describes the extremely simplified UI/UX for Solo Unicorn, reflecting the least powerful principle: one user, one machine, one coding session at a time.

## Board Layout

### 4-Column Kanban Board

Simple, clean board with essential workflow columns including iterative Loop:

```text
+-------------------------------------------------------------------------------------------------------------------------------+
| Solo Unicorn | Project: My App [▼] | + New Task | Repo Agents: Claude Code (active) | Profile |
+-------------------------------------------------------------------------------------------------------------------------------+
|  Todo                   |  Doing                  |  Done                   |  Loop                   |
|  ┌─────────────────────┐|  ┌─────────────────────┐|  ┌─────────────────────┐|  ┌─────────────────────┐|
|  | [P1] Task A         ||  | [P2] Task C (Refine)||  | [P3] Task E         ||  | [∞] Brainstorm      ||
|  | Main Repo (Claude)  ||  | Main Repo (Claude)  ||  | Frontend (OpenCode) ||  | ideas & document    ||
|  | Default Actor       ||  | Custom Actor        ||  | Default Actor       ||  | Main Repo (Claude)  ||
|  | Ready [☑]   📎2     ||  | Stage: Refine ●○○   ||  | Completed 2h ago    ||  | Stage: loop ♻️      ||
|  | [Delete]            ||  | [Delete]            ||  | [Delete]            ||  | [Delete]            ||
|  └─────────────────────┘|  └─────────────────────┘|  └─────────────────────┘|  └─────────────────────┘|
|  ┌─────────────────────┐|  ┌─────────────────────┐|                         |  ┌─────────────────────┐|
|  | [P1] Task B         ||  | [∞] Code review &   ||                         ||  | [∞] Update docs     ||
|  | Main Repo (Claude)  ||  | refactoring         ||                         ||  | & README            ||
|  | Ready [☐]           ||  | Stage: loop ♻️      ||                         ||  | Main Repo (Claude)  ||
|  | [Delete]            ||  | [Delete]            ||                         ||  | Stage: loop ♻️      ||
|  └─────────────────────┘|  └─────────────────────┘|                         |  └─────────────────────┘|
+-------------------------------------------------------------------------------------------------------------------------------+
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

**Loop Cards:**
- Infinity symbol [∞] indicating repeatable nature
- Title and description of repeatable task
- Repo Agent and Actor
- Stage: loop ♻️ (never changes)
- Delete button (removes from Loop entirely)

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

**Regular Tasks:**
1. **Create**: Human creates task with raw title/description
2. **Ready**: Human marks task ready when prepared
3. **Pickup**: Agent automatically picks up highest priority ready task
4. **Refine**: Agent updates with refined title/description
5. **Plan**: Agent creates solution options and plan
6. **Execute**: Agent implements the plan
7. **Done**: Task completed ✓

**Loop Tasks:**
1. **Create**: Human creates repeatable task directly in Loop column
2. **Pickup**: Agent picks Loop task when Todo/Doing are empty
3. **Execute**: Task moves to Doing with stage="loop" (no Refine/Plan stages)
4. **Return**: After completion, task returns to bottom of Loop column
5. **Cycle**: Process repeats infinitely ♻️

### Drag and Drop
- Drag from Todo → Doing: Sets status to doing (if ready)
- Drag from Doing → Done: Marks as completed (regular tasks)
- Drag from Doing → Loop: Returns Loop task to bottom of Loop column
- Drag from Done → Todo: Reopens regular task
- Drag from Loop → Doing: Manual execution of Loop task
- No dragging Loop tasks to Done (infinite cycle only)

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
- `SimplifiedBoard` - 4 columns with drag/drop (Todo, Doing, Done, Loop)
- `TaskCard` - minimal card display with Loop task indicators
- `TaskDrawer` - simplified task details
- `CreateTaskModal` - basic task creation with Loop option
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

This design focuses on dual workflows:
- **Regular tasks**: create → mark ready → agent completes → done
- **Loop tasks**: create in Loop → agent cycles infinitely when no regular work available

The Loop column ensures projects maintain continuous momentum with repeatable tasks like brainstorming, maintenance, and reviews.
