# Solo Unicorn — Simplified UI/UX Design

This document describes the extremely simplified UI/UX for Solo Unicorn, reflecting the least powerful principle: one user, one machine, one coding session at a time.

## Board Layout

### 3-Column Kanban Board

Simple, clean board with essential workflow columns and loop tasks integrated into Todo:

```text
+---------------------------------------------------------------------------------------------------------------+
| Solo Unicorn | Project: My App [▼] | + New Card | Repo Agents: Claude Code (active) | Profile |
+---------------------------------------------------------------------------------------------------------------+
|  Todo                   |  Doing                  |  Done                   |
|  ┌─ Normal Tasks ────┐  |  ┌─────────────────────┐|  ┌─────────────────────┐|
|  | [P1] Card A       |  |  | [P2] Card C (clarify)||  | [P3] Card E         ||
|  | Main Repo (Claude)|  |  | Main Repo (Claude)  ||  | Frontend (OpenCode) ||
|  | Ready [☑]   📎2   |  |  | Mode: clarify ●○○   ||  | Completed 2h ago    ||
|  | [Delete]          |  |  | [Delete]            ||  | [Delete]            ||
|  └───────────────────┘  |  └─────────────────────┘|  └─────────────────────┘|
|  ┌─ Loop Tasks ▼────┐  |                          |                          |
|  | [∞] Brainstorm    |  |                          |                          |
|  | ideas & document  |  |                          |                          |
|  | Mode: loop ♻️    |  |                          |                          |
|  | [Delete]          |  |                          |                          |
|  └───────────────────┘  |                          |                          |
|  | [∞] Update docs   |  |                          |                          |
|  | & README          |  |                          |                          |
|  | Mode: loop ♻️    |  |                          |                          |
|  | [Delete]          |  |                          |                          |
|  └───────────────────┘  |                          |                          |
+---------------------------------------------------------------------------------------------------------------+
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
- Mode indicator: clarify ●○○, Kickoff ●●○, Execute ●●●
- Progress info
- Delete button

**Done Cards:**
- Priority and title (refined)
- Repo Agent
- Completion timestamp
- Delete button

**Loop Cards (in Todo column subsection):**
- Infinity symbol [∞] indicating repeatable nature
- Title and description of repeatable card
- Repo Agent and Actor
- Mode: loop ♻️ (never changes)
- Delete button (removes from Loop entirely)
- Collapsible subsection within Todo column

## Card Creation Flow

### 1. Click "+ New Card"

Simple modal with minimal fields:

```text
+----------------------------------+
| Create New Card                  |
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

After creating card, human ticks "Ready" checkbox when ready for AI pickup.

## Card Drawer (Simplified)

Click any card to open simplified drawer:

```text
+-------------------------------------------------------- Card Drawer ----------------------+
| CARD-123: Implement user authentication                                           [×]   |
| Column: Doing • Mode: Execute • Priority: P1                                            |
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
| Plan (Agent Generated - Plan Results)                                                    |
| Selected Solution: OAuth + JWT tokens                                                    |
| Spec: Implement Google OAuth integration with JWT tokens for session management.        |
| Use secure HTTP-only cookies, redirect to dashboard on success.                         |
+-------------------------------------------------------------------------------------------+
| Project Memory                                                                            |
| [View/Edit Project Memory] - includes context for all agent sessions                     |
+-------------------------------------------------------------------------------------------+
| Actions                                                                                   |
| [Mark as Done] [Delete Card] [Open in Claude Code] (if session active)                  |
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
- Horizontal scrolling lists
- Swipe to navigate between Todo, Doing, Done columns
- Tap card to open full-screen drawer

### Card Creation
- Full-screen modal with simplified form
- Voice input support for title/description

### Card Drawer
- Full-screen view with same information
- Bottom action bar for primary actions

## Key Interactions

### Card Lifecycle

**Regular Cards:**
1. **Create**: Human creates card with raw title/description
2. **Ready**: Human marks card ready when prepared
3. **Pickup**: Agent automatically picks up highest priority ready card
4. **clarify**: Agent updates with refined title/description
5. **Plan**: Agent creates solution options and plan
6. **Execute**: Agent implements the plan
7. **Done**: Card completed ✓

**Loop Cards:**
1. **Create**: Human creates repeatable card directly in Loop subsection
2. **Pickup**: Agent picks Loop card when Todo/Doing are empty
3. **Execute**: Card moves to Doing with mode="loop" (no clarify/Plan modes)
4. **Return**: After completion, card returns to bottom of Loop subsection in Todo column
5. **Cycle**: Process repeats infinitely ♻️

### Drag and Drop
- Drag from Todo → Doing: Sets column to doing (if ready)
- Drag from Doing → Done: Marks as completed (regular cards)
- Drag from Doing → Todo: Returns Loop card to bottom of Loop subsection
- Drag from Done → Todo: Reopens regular card
- Drag from Todo Loop subsection → Doing: Manual execution of Loop card
- No dragging Loop cards to Done (infinite cycle only)

### Agent Status
- Header shows active repo agent sessions
- Only one active session per client type
- Real-time status updates via WebSocket

## Removed Features

All complex features removed for extreme simplification:

- ❌ Blocked flag/badges
- ❌ QA list and requirements
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
- `SimplifiedBoard` - 3 columns with drag/drop (Todo with Loop subsection, Doing, Done)
- `TaskCard` - minimal card display with Loop card indicators
- `TaskDrawer` - simplified card details
- `CreateTaskModal` - basic card creation with Loop option
- `ProjectSettings` - repo agents and actors config

### State Management
- `useProject` - project data and memory
- `useTasks` - card CRUD and status updates
- `useWebSocket` - real-time agent communication
- `useDragDrop` - column movements

### Mobile Considerations
- Responsive design with horizontal scrolling
- Touch-friendly interactions
- Full-screen modals on mobile
- Simplified navigation

This design focuses on dual workflows:
- **Regular cards**: create → mark ready → agent completes → done
- **Loop cards**: create in Loop subsection → agent cycles infinitely when no regular work available

The Loop subsection ensures projects maintain continuous momentum with repeatable cards like brainstorming, maintenance, and reviews.
