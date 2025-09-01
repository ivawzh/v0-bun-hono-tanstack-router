# Solo Unicorn — UI/UX Design

## Overview

Solo Unicorn v3 introduces **Pull Request Support** for controlled development workflows while maintaining fast iteration for early-stage projects.

### Key Features
- **Dual Workflow Modes**: Direct push (early stage) vs PR workflow (production)
- **Seamless GitHub Integration**: Auto-create PRs, sync comments, handle reviews
- **AI Feedback Loop**: Agents read and respond to GitHub PR comments
- **Flexible Configuration**: Per-project defaults with per-task overrides

## Core UI Components

Whenever in doubt, follow Trello UI/UX design.

### KanbanBoard component with layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] [Project ▼]                           [🌙/☀️] [👤 User ▼]           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Project Name                👤👤👤 🟢 Workstations: 2  [⏸️ Pause] [⚙️ Settings]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────┬─────────┬─────────┬─────────┐                                   │
│ │  TODO   │  DOING  │ REVIEW  │  DONE   │                                   │
│ ├─────────┼─────────┼─────────┼─────────┤                                   │
│ │┌───────┐│         │         │         │                                   │
│ ││Normal ▼││         │         │         │                                   │
│ │├───────┤│         │         │         │                                   │
│ ││┌─────┐││┌───────┐│┌───────┐│┌───────┐│                                   │
│ │││Task │││ Task  ││ Task  ││ Task  ││                                   │
│ │││P H  │││ P L   ││ P M   ││ P H   ││                                   │
│ │││Code▼│││ Plan  ││ Review││ Done  ││                                   │
│ │││🔄   │││🤖 AI  ││       ││       ││                                   │
│ │││Desc │││ Desc  ││ Desc  ││ Desc  ││                                   │
│ │││Ready│││ Ready ││Review ││       ││                                   │
│ ││└─────┘││└───────┘│└───────┘│└───────┘│                                   │
│ │├───────┤│         │         │         │                                   │
│ ││Loop  ▶││         │         │         │                                   │
│ │└───────┘│         │         │         │                                   │
│ └─────────┴─────────┴─────────┴─────────┘                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Top Header Bar (layout)**

- Logo (Top left corner)
- Project select dropdown (Next to logo)
- Dark/Light mode toggle (Top right)
- User avatar/menu (Far top right)

**Sub Header Bar (layout)**

- Project name (Left side)
- **PR Mode Indicator**: 🔄 PR Mode | ⚡ Direct Push (visual indicator of current mode)
- Online users (stacked avatars like Figma): Shows project members currently active
- 🟢 Online workstations with count: Shows workstations currently connected
- Pause|Resume button for AI agent (Left of settings)
- Settings button (Right side)

**Main Kanban Board Area**

- 4 columns: Todo, Doing, Review, Done
- Todo column has special split sections (Normal/Loop tasks)
- Each card shows TaskPreview component
- Kanban column height is fixed and scrollable.
- Mobile friendly horizontal scroll.
- Drag and drop will update task.list.

**TaskPreview Card Structure** (Column-Specific)

**Todo Column:**

1. Title line
2. Badge row (Priority emoji+number, Mode dropdown ▼, Process badge)
3. Description (collapsible, 3.5 lines visible)
4. Ready toggle button

**Doing Column:**

1. Title line
2. Badge row (Priority emoji+number, Mode badge, Process badge)
3. Description (collapsible, 3.5 lines visible)
4. Ready toggle button

**Review Column:**

1. Title line
2. Badge row (Priority emoji+number, Mode badge, **PR status badge**)
3. Description (collapsible, 3.5 lines visible)
4. **GitHub PR link** (if PR mode)
5. Review actions (Approve/Request Changes)

**Done Column:**

1. Title line
2. Badge row (Priority emoji+number, Mode badge, **PR status badge**)
3. Description (collapsible, 3.5 lines visible)
4. **GitHub PR/Merge info** (if applicable)

### TaskPreview component (Column-Specific)

**Todo Column Card:**

```
┌─────────────────────────────────────┐
│ Task Title Here                  [⋮]│
├─────────────────────────────────────┤
│ P High [Code ▼] [📝 PR Mode]         │
├─────────────────────────────────────┤
│ Branch: solo-unicorn/task-auth-123  │
├─────────────────────────────────────┤
│ Description text here that can be   │
│ multiple lines long and will show   │
│ only first 3.5 lines by default... │
│ ⋮                                   │
├─────────────────────────────────────┤
│                        [Ready]     │
└─────────────────────────────────────┘
```

**TaskPreview Dropdown Menu (⋮)**:
- View & Edit (opens TaskViewPopup)
- Reset AI (when task is active)
- Delete Task

**Review Column Card:**

```
┌─────────────────────────────────────┐
│ Task Title Here                     │
├─────────────────────────────────────┤
│ P Low [Code]                        │
├─────────────────────────────────────┤
│ Description text here that can be   │
│ multiple lines long and will show   │
│ only first 3.5 lines by default... │
│ ⋮                                   │
├─────────────────────────────────────┤
│                       [Review]     │
└─────────────────────────────────────┘
```

*Note: Review column shows the current mode being reviewed as a display badge*

#### Priority System

**Priority Display** (clean emoji+number format):

5 is Highest, 1 is Lowest.

- P Highest
- P High
- P Medium
- P Low
- P Lowest

**Process Badges** (Only Todo/Doing columns):

- **Todo Column**: Queueing
- **Doing Column**: AI at work
- **Review Column**: (no Process badge)
- **Done Column**: (no Process badge)

#### Task Mode System

**Todo Column** (Editable dropdown):

- Clarify ▼
- Plan ▼
- Code ▼
- Review ▼

**Other Columns** (Display badge only):

- [Clarify]
- [Plan]
- [Code]
- [Review]

#### Key Interactive Elements

**Todo Column Special Layout**

- Collapsible "Normal Tasks" section (default open)
- Collapsible "Loop Tasks" section (default closed)
- When both open: 50/50 vertical split
- Smooth expand/collapse animations

**AI Agent Controls**

- Pause/Resume button in sub-header
- Controls the AI agent task processing queue
- Visual indicator of current agent state

**Column-Specific Controls**

**Ready Toggle** (Todo/Doing columns only):

- Ready: Green "Ready" button
- Not Ready: Red "Not Ready" button
- Affects task eligibility for AI processing

**Review Button** (Review column only):

- Opens TaskViewPopup → Review Tab
- Shows "review instruction"
- Approve/Reject buttons
- Reject requires mandatory "feedback" field
- Approved tasks move to Done column

**TaskViewPopup Integration**

- Review column Review button → Review Tab
- Review Tab displays review instructions
- Approve: Move to Done
- Reject: Require feedback + return to previous column

This layout provides a comprehensive task management system specifically designed for AI-agent workflows with clear visual hierarchy and intuitive controls.

### TaskViewPopup component

**Modal Layout (Full Screen on Mobile)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Task: Implement user authentication                                   [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Base] [Clarify] [Plan] [Review] [Dependencies] [Settings]                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ BASE TAB ────────────────────────────────────────────────────────────────┐│
│ │ Title: [Implement user authentication                                   ]││
│ │ Description: [Create login page with email/password validation...       ]││
│ │ Priority: [High ▼]  Mode: [Code ▼]  List: [Doing ▼]                    ││
│ │ Repository: [Main Repo]  Agent: [Claude Code]  Actor: [Default]        ││
│ │                                                                         ││
│ │ Attachments:                                                            ││
│ │ ┌─────────────┐ ┌─────────────┐                                         ││
│ │ │📄 wireframe │ │🖼️ mockup.png│                           [+ Add File] ││
│ │ │.jpg         │ │             │                                         ││
│ │ └─────────────┘ └─────────────┘                                         ││
│ │                                                                         ││
│ │ Status: 🤖 AI at work  •  Started: 2 minutes ago                       ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│ ID: task_123456789                                                        │
│ Created: Dec 15, 2024 2:30 PM                                            │
│ Updated: Dec 15, 2024 4:45 PM                                           |│                                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tab Structure**:

**Base Tab** (Default):
- Editable fields: Title, Description, Priority, Mode, List
- Read-only: Repository, Agent, Actor (configured at creation)
- Attachments with drag-and-drop upload
- Real-time status display
- Action buttons: Delete Task, Save Changes

**Clarify Tab**
```
┌─ CLARIFY TAB ─────────────────────────────────────────────────────────────┐
│ Raw Input (Human):                                                       │
│ Title: [user login                                                     ] │
│ Description: [need login page                                          ] │
│                                                                          │
│ AI Clarified Output:                                                       │
│ Title: [Implement user authentication with email/password             ] │
│ Description: [Create comprehensive login system with validation,       ] │
│              [password hashing, and session management...              ] │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Plan Tab**:
```
┌─ PLAN TAB ────────────────────────────────────────────────────────────────┐
│ Solution title:                                                           │
│ OAuth + JWT  tokens                                                       │
│ Solution  Description:                                                    │
│ .....                                                                     │
│                                                                           │
│ Progress: Step 1 of 5 (20% complete) [━━━━━━░░░░░░░░░░░░░░░░░░░░░░░░]        │
│                                                                           │
│ Steps (from database):                                                    │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ ✅ Set up OAuth provider integration                    ← Current    │   │
│ │ [ ] Create JWT token generation/validation                          │   │
│ │ [ ] Build login/logout UI components                                │   │
│ │ [ ] Implement session management                                     │   │
│ │ [ ] Add password reset functionality                                 │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [View Detailed Plan Documents] [View Step 1 Details]                     │
└───────────────────────────────────────────────────────────────────────────┘
```

**Review Tab**:
```
┌─ REVIEW TAB ──────────────────────────────────────────────────────────────┐
│ Review Instructions:                                                      │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ Please test the login functionality with:                          │   │
│ │ - Valid email/password combinations                                │   │
│ │ - Invalid credentials                                              │   │
│ │ - Password reset flow                                              │   │
│ │ - Session persistence across browser refresh                      │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ Implementation Notes (AI):                                                │
│ - Added OAuth Google integration                                          │
│ - JWT tokens with 24h expiry                                             │
│ - Secure HTTP-only cookies                                               │
│ - Tests passing: 15/15                                                   │
│                                                                           │
│                                       [✅ Approve] [❌ Reject]            │
│                                                                           │
│ ┌─ REJECT FEEDBACK (when Reject clicked) ──────────────────────────────┐   │
│ │ Feedback *                                                          │   │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│ │ │ Please explain what needs to be fixed...                       │ │   │
│ │ │                                                                 │ │   │
│ │ │ Upload files: [📎 Drop files here] or [📄 wireframe.png]       │ │   │
│ │ │ Reference: ![wireframe](wireframe.png) shows expected flow     │ │   │
│ │ └─────────────────────────────────────────────────────────────────┘ │   │
│ │                                           [Cancel] [Submit Reject] │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

**Dependencies Tab**:
```
┌─ DEPENDENCIES TAB ────────────────────────────────────────────────────────┐
│ Depends On:                                                               │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ ✅ Set up database schema                     [Remove]              │   │
│ │ 🔄 Install authentication libraries          [Remove]              │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [+ Add Dependency ▼]                                                     │
│                                                                           │
│ Blocks:                                                                   │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ ⏳ Create user dashboard (waiting for this task)                    │   │
│ │ ⏳ Implement user profile page                                       │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

**Settings Tab**:
```
┌─ SETTINGS TAB ────────────────────────────────────────────────────────────┐
│ Task Configuration:                                                       │
│ Workstation: [My MacBook Pro ▼]                                          │
│ Repository: [Main Repo (github.com/user/project)]                        │
│                                                                           │
│ Task Metadata:                                                            │
│ ID: task_123456789                                                        │
│ Created: Dec 15, 2024 2:30 PM                                            │
│ Author: user.name                                                         │
│                                                                           │
│ Advanced Settings:                                                        │
│ Auto-ready: [☑] Mark ready automatically when dependencies complete      │
│ Notifications: [☑] Notify when task status changes                       │
│ Time tracking: [☐] Track time spent on this task                         │
│                                                                           │
│ Danger Zone:                                                              │
│ [🔄 Reset AI] [🗑️ Delete Task]                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### TaskCreatePopup component

**Modal Layout (Responsive)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create New Task                                                       [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Title *                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Task title here...                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Description                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Describe what needs to be done...                                       │ │
│ │                                                                         │ │
│ │ ┌─────────────┐ ┌───────────────────────────────────────────────────┐   │ │
│ │ │ 📎 Drop     │ │ 📄 wireframe.sketch                              │   │ │
│ │ │ files here  │ │ 🖼️ mockup.png                                     │   │ │
│ │ │ or click    │ │                                          [Remove] │   │ │
│ │ └─────────────┘ └───────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐   │
│ │ Mode            │ Priority        │ List            │ Repository      │   │
│ │ [Clarify ▼]     │ [Medium ▼]      │ [Todo ▼]        │ [Main Repo ▼]  │   │
│ └─────────────────┴─────────────────┴─────────────────┴─────────────────┘   │
│                                                                             │
│ ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐   │
│ │ Workstation     │ Agent           │ Model           │ Actor           │   │
│ │ [MacBook Pro ▼] │ [Claude Code ▼] │ [GPT-4 ▼]      │ [Default ▼]    │   │
│ └─────────────────┴─────────────────┴─────────────────┴─────────────────┘   │
│                                                                             │
│ Workflow Template: [Standard Development ▼]                                │
│                                                                             │
│ ▼ Advanced Settings                                                         │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Customize Review Requirements:                                          │ │
│ │ ┌─ Mode Sequence ────────────────────────────────────────────────────┐   │ │
│ │ │ 1. ☑ Clarify    → [☑ Require Review]                               │   │ │
│ │ │ 2. ☑ Plan       → [☑ Require Review]                               │   │ │
│ │ │ 3. ☑ Code       → [☐ Require Verification]                        │   │ │
│ │ │ 4. ☐ Custom     → [☐ Require Review]                               │   │ │
│ │ │ 5. ☐ Deploy     → [☐ Require Review]                               │   │ │
│ │ └─────────────────────────────────────────────────────────────────────┘   │ │
│ │ [+ Add Custom Mode]                                                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Dependencies (Optional)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ┌─ No dependencies selected ────────────────────────────────────────┐   │ │
│ │ │                                            [+ Add Dependency ▼]   │   │ │
│ │ └────────────────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Auto-ready: [☑] Mark task ready for AI processing immediately              │
│                                                                             │
│                                             [Cancel] [Create Task]         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Field Specifications**:

- **Title** (Required): Auto-focus, max 255 chars
- **Description**: Rich text with GitHub-style file attachment support
- **Mode**: Default "Clarify", affects workflow path
- **Priority**: Default "Medium", visual priority in board
- **List**: Default "Todo", can create directly in other columns
- **Repository**: Shows GitHub URLs from projectRepo entities, max concurrent tasks = 1
- **Workstation**: Required, defaults to single workstation if available
- **Agent**: Required, dynamically loaded from selected workstation
- **Model**: Required, appears after agent selection (GPT-5, GPT-4, etc.)
- **Actor**: Optional, narrower field, defaults to project default actor
- **Workflow Configuration**: Template-based workflow with customizable mode sequence and review requirements per mode
- **Dependencies**: Task picker with search/filter
- **Auto-ready**: Convenience flag to skip manual ready toggle

### ProjectSettingsPopup component

**Modal Layout with Tabs**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project Settings: My App                                              [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [General] [Members] [Repositories] [Actors] [Workflows]                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ GENERAL TAB ─────────────────────────────────────────────────────────────┐│
│ │ Project Details:                                                         ││
│ │ Name: [My App                                                          ] ││
│ │ Description: [E-commerce application with AI features                 ] ││
│ │                                                                         ││
│ │ Project Memory (Shared Context):                                        ││
│ │ ┌─────────────────────────────────────────────────────────────────────┐ ││
│ │ │ Tech Stack: React + Node.js + PostgreSQL                           │ ││
│ │ │ Architecture: Microservices with REST APIs                         │ ││
│ │ │ Key Dependencies: Stripe for payments, Redis for caching           │ ││
│ │ │ Coding Standards: ESLint + Prettier, TypeScript strict mode        │ ││
│ │ │ ...                                                                 │ ││
│ │ └─────────────────────────────────────────────────────────────────────┘ ││
│ │                                                                         ││
│ │ Danger Zone:                                                            ││
│ │ [🗑️ Delete Project]                                   ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│                                                      [Cancel] [Save]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Members Tab**:
```
┌─ MEMBERS TAB ─────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 John Doe (Owner)                                    [Edit] [×]   │   │
│ │ john@company.com  •  Active 2 hours ago                            │   │
│ │ Role: Owner  •  Joined: Dec 1, 2024                                │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 Jane Smith (Member)                                 [Edit] [×]   │   │
│ │ jane@company.com  •  Active 1 day ago                              │   │
│ │ Role: Member  •  Joined: Dec 10, 2024                              │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [+ Add Member] (Also adds user to organization)                          │
└───────────────────────────────────────────────────────────────────────────┘
```

**Repositories Tab**:
```
┌─ REPOSITORIES TAB ────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📁 Main Repository                                      [Edit] [×]   │   │
│ │ GitHub URL: https://github.com/user/my-app                         │   │
│ │ Max Concurrent Tasks: [1 ▼]                                        │   │
│ │ Last Active: 2 minutes ago                                         │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📁 Frontend Repository                                  [Edit] [×]   │   │
│ │ GitHub URL: https://github.com/user/my-app-frontend                │   │
│ │ Max Concurrent Tasks: [1 ▼]                                        │   │
│ │ Last Active: Never                                                 │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [+ Add Repository] (Link GitHub URL to project)                          │
└───────────────────────────────────────────────────────────────────────────┘
```

**Actors Tab**:
```
┌─ ACTORS TAB ──────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 Default Actor (System Default)                      [Edit] [×]   │   │
│ │ Description: Full-stack engineering agent focused on working        │   │
│ │              solutions with clean, maintainable code               │   │
│ │ Used by: 34 tasks                                                  │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 Frontend Specialist                                  [Edit] [×]   │   │
│ │ Description: React/TypeScript expert focused on UI/UX best         │   │
│ │              practices and responsive design                        │   │
│ │ Used by: 8 tasks                                                   │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [+ Create Actor]                                                          │
└───────────────────────────────────────────────────────────────────────────┘
```

**Workflows Tab**:
```
┌─ WORKFLOWS TAB ───────────────────────────────────────────────────────────┐
│ Project Workflow Templates:                                                 │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📋 Standard Development (Default)                       [Edit] [×]   │   │
│ │ Sequence: Clarify(✓) → Plan(✓) → Code                                 │   │
│ │ Used by: 28 tasks                                                    │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📋 Quick Fix                                            [Edit] [×]   │   │
│ │ Sequence: Code                                                        │   │
│ │ Used by: 12 tasks                                                    │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📋 Research & Analysis                                  [Edit] [×]   │   │
│ │ Sequence: Clarify(✓) → Plan(✓) → Code(✓) → Review(✓)                │   │
│ │ Used by: 3 tasks                                                     │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [+ Create Workflow Template]                                              │
│                                                                           │
│ Edit Template Modal:                                                      │
│ ┌─ Create/Edit Workflow Template ──────────────────────────────────────┐   │
│ │ Name: [Research & Analysis                                        ]   │   │
│ │                                                                     │   │
│ │ Mode Sequence:                                                      │   │
│ │ ┌─ Drag to reorder ────────────────────────────────────────────┐     │   │
│ │ │ 1. ☑ Clarify    → [☑ Require Review] [⋮]                    │     │   │
│ │ │ 2. ☑ Plan       → [☑ Require Review] [⋮]                    │     │   │
│ │ │ 3. ☑ Code       → [☑ Require Verification] [⋮]             │     │   │
│ │ │ 4. ☑ Review     → [☑ Require Review] [⋮]                    │     │   │
│ │ └─────────────────────────────────────────────────────────────────┘     │   │
│ │ [+ Add Mode]                                                        │   │
│ │                                                                     │   │
│ │                                         [Cancel] [Save Template]   │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

### ProjectCreatePopup component

**Step-by-Step Wizard**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create New Project (Step 1 of 3)                                     [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ● Project Details  ○ Workstation Setup                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Let's start with your project basics                                       │
│                                                                             │
│ Project Name *                                                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ My Awesome Project                                                      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Description                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ A brief description of what this project is about...                   │ │
│ │                                                                         │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                                                             │
│                                                     [Cancel] [Next →]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Step 2 - Workstation Setup**:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create New Project (Step 2 of 3)                                     [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✅ Project Details  ● Workstation Setup  ○ Repository Setup                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Connect your code workstation                                              │
│                                                                             │
│ Available Workstations:                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ☑ 💻 My MacBook Pro                                                      │ │
│ │   Status: 🟢 Online  •  2 agents available                              │ │
│ │   Last seen: Active now                                                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ☐ 🖥️ Office Desktop                                                      │ │
│ │   Status: 🔴 Offline  •  1 agent available                              │ │
│ │   Last seen: 2 hours ago                                                │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Missing a workstation? Run: solo-unicorn register                          │
│                                                                             │
│                                                [← Back] [Cancel] [Next →] │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Step 3 - Repository Configuration**:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create New Project (Step 3 of 3)                                     [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✅ Project Details  ✅ Workstation Setup  ● Repository Setup               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Link your code repositories                                                │
│                                                                             │
│ Main Repository *                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ GitHub URL: [https://github.com/user/my-repo                        ] │ │
│ │ Max Concurrent Tasks: [1 ▼]                                            │ │
│ │                                                                         │ │
│ │ Status: ✅ Valid repository found                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Additional Repositories (Optional):                           [+ Add More] │                                                                                                     │                                                                             │
│ ☑️ Create sample "Welcome" task to test the setup                          │
│                                                                             │
│                                          [← Back] [Cancel] [Create Project]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### WorkstationViewPopup component

**Modal Layout (Responsive)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Workstation: My MacBook Pro                                          [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Agents] [Repositories] [Activity] [Settings]                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ OVERVIEW TAB ────────────────────────────────────────────────────────────┐│
│ │ Workstation Info:                                                        ││
│ │ Name: [My MacBook Pro                                                  ] ││
│ │ Status: 🟢 Online  •  Last seen: Active now                            ││
│ │ OS: macOS 14.2  •  Arch: arm64                                          ││
│ │ Registration: Dec 1, 2024 via CLI                                       ││
│ │                                                                          ││
│ │ Current Tasks:                                                        ││
│ │ ┌──────────────────────────────────────────────────────────────────────┐ ││
│ │ │ 🤖 Agent: Claude Code                                                │ ││
│ │ │ 📋 Task: Implement user authentication (task_123456)                │ ││
│ │ │ 📁 Repository: github.com/user/my-app                                │ ││
│ │ │ ⏱️  Started: 15 minutes ago                                           │ ││
│ │ └──────────────────────────────────────────────────────────────────────┘ ││
│ │                                                                          ││
│ │ Quick Actions:                                                           ││
│ │ [🔄 Pause receiving tasks] [📊 View Metrics] [🚫 Disconnect]             ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│                                                      [Close] [Save]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Agents Tab**:
```
┌─ AGENTS TAB ──────────────────────────────────────────────────────────────┐
│ Available Agents on this Workstation:                                      │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 🤖 Claude Code                                          [Config] [×]   │   │
│ │ Version: v2.1.4                                  │   │
│ │ Rate Limit: Available  •  Concurrent Tasks: 1/1                       │   │
│ │ Last Activity: 2 minutes ago                                          │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 🤖 OpenCode                                             [Config] [×]   │   │
│ │ Version: v1.3.2                                                        │   │
│ │ Rate Limit: Available  •  Concurrent Tasks: 0/2                       │   │
│ │ Last Activity: 1 hour ago                                             │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [Instruction to add New Agent via CLI]                                      │
└───────────────────────────────────────────────────────────────────────────┘
```

**Repositories Tab**:
```
┌─ REPOSITORIES TAB ────────────────────────────────────────────────────────┐
│ Accessible Repositories:                                                   │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📁 github.com/user/my-app                                  [Open]    │   │
│ │ Local Path: /Users/user/projects/my-app                             │   │
│ │ Default Branch: main                                                │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📁 github.com/user/my-app-frontend                         [Open]    │   │
│ │ Local Path: /Users/user/projects/my-app-frontend                    │   │
│ │ Default Branch: master                                               │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

### OrganizationPage component

**Full Page Layout**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] Solo Unicorn                                  [🌙/☀️] [👤 User ▼]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ [← Back to Projects]                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ My Organization ──────────────────────────────────────────────────┐      │
│ │                                                          [⚙️ Settings] │      │
│ │                                                                     │      │
│ │ Projects (4)                                           [+ New Project] │      │
│ │ ┌─────────────────┬─────────────────┬─────────────────┬─────────────┐ │      │
│ │ │ 📱 Mobile App   │ 🌐 Web Portal   │ 📊 Analytics    │ 🔧 DevTools │ │      │
│ │ │ 12 tasks        │ 8 tasks         │ 3 tasks        │ 15 tasks    │ │      │
│ │ │ 💻 2 stations    │ 💻 1 station    │ 💻 1 station   │ 💻 3 stations │ │      │
│ │ │ ✅ 23 done      │ ✅ 45 done      │ ✅ 12 done     │ ✅ 67 done  │ │      │
│ │ │                 │                 │                 │             │ │      │
│ │ │ [Open]          │ [Open]          │ [Open]          │ [Open]      │ │      │
│ │ └─────────────────┴─────────────────┴─────────────────┴─────────────┘ │      │
│ └─────────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│ ┌─ Workstations (3) ─────────────────────────────────────────────────┐      │
│ │                                                 Register via CLI → │      │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │      │
│ │ │ 💻 My MacBook Pro (John's)                         [View] [×]   │ │      │
│ │ │ Status: 🟢 Online  •  2 agents  •  Last seen: Active now       │ │      │
│ │ │ Projects: Mobile App, Web Portal                                │ │      │
│ │ └─────────────────────────────────────────────────────────────────┘ │      │
│ │                                                                     │      │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │      │
│ │ │ 🖥️ Office Desktop (Jane's)                         [View] [×]   │ │      │
│ │ │ Status: 🔴 Offline  •  1 agent  •  Last seen: 2 hours ago      │ │      │
│ │ │ Projects: Analytics, DevTools                                   │ │      │
│ │ └─────────────────────────────────────────────────────────────────┘ │      │
│ │                                                                     │      │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │      │
│ │ │ 💻 Mike's Laptop                                   [View] [×]   │ │      │
│ │ │ Status: 🟡 Idle  •  1 agent  •  Last seen: 1 day ago          │ │      │
│ │ │ Projects: Web Portal                                            │ │      │
│ │ └─────────────────────────────────────────────────────────────────┘ │      │
│ └─────────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│ ┌─ Team Members (3) ─────────────────────────────────────────────────┐      │
│ │                                                          [+ Invite] │      │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │      │
│ │ │ 👤 John Doe (Owner)                              [Settings] [×] │ │      │
│ │ │ john@company.com  •  Active 2 hours ago                        │ │      │
│ │ │ Workstations: My MacBook Pro                                    │ │      │
│ │ └─────────────────────────────────────────────────────────────────┘ │      │
│ │                                                                     │      │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │      │
│ │ │ 👤 Jane Smith (Admin)                            [Settings] [×] │ │      │
│ │ │ jane@company.com  •  Active 1 day ago                          │ │      │
│ │ │ Workstations: Office Desktop                                    │ │      │
│ │ └─────────────────────────────────────────────────────────────────┘ │      │
│ │                                                                     │      │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │      │
│ │ │ 👤 Mike Johnson (Member)                         [Settings] [×] │ │      │
│ │ │ mike@company.com  •  Invited (pending)                          │ │      │
│ │ │ Workstations: Mike's Laptop                                     │ │      │
│ │ └─────────────────────────────────────────────────────────────────┘ │      │
│ └─────────────────────────────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Organization Settings Modal**:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Organization Settings                                                 [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [General] [Members] [Security] [Integrations]                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ GENERAL TAB ─────────────────────────────────────────────────────────────┐│
│ │ Organization Details:                                                    ││
│ │ Name: [My Organization                                                 ] ││
│ │ Domain: [my-org.solo-unicorn.lol                                       ] ││
│ │ Logo: [📷 Upload Logo]                                                   ││
│ │                                                                          ││
│ │ Default Settings:                                                        ││
│ │ Default Project Template: [Empty Project ▼]                             ││
│ │ Default Workstation Registration: [Automatic ▼]                         ││
│ │ Auto-invite to new projects: [☑]                                         ││
│ │                                                                          ││
│ │ CLI Setup:                                                               ││
│ │ Registration Command: solo-unicorn register --org=my-org                ││
│ │ API Key: [sk-xxx...xxx] [🔄 Regenerate]                                 ││
│ │                                                                          ││
│ │ Danger Zone:                                                             ││
│ │ [🗂️ Export All Data] [🗑️ Delete Organization]                           ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│                                                      [Cancel] [Save]       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Features**:

1. **TaskViewPopup**: Context-aware tabs based on task state, real-time status updates
2. **TaskCreatePopup**: Streamlined creation with smart defaults, file attachment support
3. **ProjectSettingsPopup**: Comprehensive configuration with validation and status indicators
4. **ProjectCreatePopup**: 3-step wizard with validation and template support
5. **OrganizationPage**: Team management, project overview, usage tracking

All components follow the established design patterns with consistent spacing, responsive layouts, and mobile-first approach.

## Pull Request Support UI/UX

### Overview

Solo Unicorn v3 introduces comprehensive Pull Request support enabling two distinct development workflows:

- **🚀 Direct Push Mode**: Fast iteration for early-stage projects
- **🔄 PR Mode**: Controlled development with GitHub integration

### Key Features

1. **Dual Workflow Support**: Seamlessly switch between direct push and PR modes
2. **GitHub Integration**: Auto-create PRs, sync comments, handle reviews
3. **AI Feedback Loop**: Agents read and respond to GitHub PR comments
4. **Flexible Configuration**: Per-project defaults with per-task overrides
5. **Team Collaboration**: Multiple reviewers and real-time PR status

### Enhanced Task Cards (PR Mode)

#### Review Column Card with PR Integration

```
┌─────────────────────────────────────┐
│ Implement OAuth integration      [⋮]│
├─────────────────────────────────────┤
│ P High [Review] 👀 PR #42 (pending) │
├─────────────────────────────────────┤
│ 🔗 [View GitHub PR] [💬 PR Comments] │
│ Branch: solo-unicorn/task-oauth-456 │
├─────────────────────────────────────┤
│ Description text here that can be   │
│ multiple lines long and will show   │
│ only first 3.5 lines by default... │
│ ⋮                                   │
├─────────────────────────────────────┤
│ GitHub Status: [✓ Checks passed]    │
│ [👍 Approve] [👎 Request Changes]    │
└─────────────────────────────────────┘
```

#### Todo Column Card (PR Mode)

```
┌─────────────────────────────────────┐
│ Implement OAuth integration      [⋮]│
├─────────────────────────────────────┤
│ P High [Review] 👎 PR #42 (rework) │
├─────────────────────────────────────┤
│ Branch: solo-unicorn/task-oauth-456 │
├─────────────────────────────────────┤
│ Add Google OAuth integration using  │
│ Monster Auth. Create login flow...  │
│ [Show more ▼]                       │
├─────────────────────────────────────┤
│                  [✓ Ready for AI]   │
└─────────────────────────────────────┘
```

#### Done Column Card (PR Mode)

```
┌─────────────────────────────────────┐
│ Implement OAuth integration      [⋮]│
├─────────────────────────────────────┤
│ P High [Done] [✅ Merged] [📅 1d]     │
├─────────────────────────────────────┤
│ 🔗 [View PR #42] [📊 PR Stats]       │
│ Merged to: main                     │
├─────────────────────────────────────┤
│ Description text here that can be   │
│ multiple lines long and will show   │
│ only first 3.5 lines by default... │
│ ⋮                                   │
└─────────────────────────────────────┘
```

### Project Configuration - PR Settings

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project Settings - Pull Request Configuration                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 🔄 Pull Request Mode                                                        │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ○ Direct Push Mode (Fast iteration)                                    │ │
│ │   • Tasks work directly on main branch                                 │ │
│ │   • No PR creation, immediate commits                                  │ │
│ │   • Best for: Early stage development, solo work                      │ │
│ │                                                                         │ │
│ │ ● PR Mode (Controlled development)                                     │ │
│ │   • Tasks create individual branches                                   │ │
│ │   • Auto-create GitHub PRs when moving to Review                      │ │
│ │   • AI agents respond to GitHub PR comments                           │ │
│ │   • Best for: Production projects, team collaboration                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ PR Configuration (when PR Mode enabled)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Branch Prefix: [solo-unicorn/] (e.g., solo-unicorn/task-123-auth)      │ │
│ │ Target Branch: [main      ▼] (base branch for PRs)                     │ │
│ │ Require Review: [✓] (human approval before merge)                      │ │
│ │ Auto-merge: [✓] (merge approved PRs automatically)                     │ │
│ │ Delete Branch: [✓] (cleanup after merge)                               │ │
│ │ PR Template: [Edit Template...] (default PR description)               │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                        [Cancel]  [Save Configuration]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Task Creation with PR Override

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create New Task                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Title: [Implement OAuth integration                               ]         │
│                                                                             │
│ Description:                                                                │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Add Google OAuth integration using Monster Auth...                     │ │
│ │                                                                         │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Repository: [main-repo           ▼] Actor: [Full-Stack Dev ▼]              │
│ Priority: [High ▼]                   Workflow: [Default      ▼]              │
│                                                                             │
│ 🔄 Pull Request Mode                                                        │
│ ○ Use project default (PR Mode)                                            │
│ ○ Force Direct Push (override)                                             │
│ ● Force PR Mode (override)                                                 │
│   └─ Target Branch: [main ▼] Custom Branch: [ ]                           │
│                                                                             │
│                                            [Cancel]  [Create Task]         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### GitHub PR Comments Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ GitHub PR Comments - Implement OAuth integration (#42)                 [×] │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🔗 https://github.com/user/repo/pull/42                   [Open in GitHub] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 💬 3 comments • ✅ 2 approvals • 🔄 1 change request                        │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 👤 john@example.com • 2 hours ago                                      │ │
│ │ ✅ Approved                                                             │ │
│ │                                                                         │ │
│ │ Great implementation! The OAuth flow looks solid. Just one minor       │ │
│ │ suggestion - could you add error handling for the token refresh?       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 🤖 Claude Code (AI Agent) • 1 hour ago                                 │ │
│ │ 💬 Response to review                                                   │ │
│ │                                                                         │ │
│ │ Thanks for the feedback! I've added comprehensive error handling       │ │
│ │ for token refresh in the latest commit. The implementation now         │ │
│ │ includes retry logic and user-friendly error messages.                 │ │
│ │                                                                         │ │
│ │ Changes made:                                                           │ │
│ │ - Added TokenRefreshError class                                        │ │
│ │ - Implemented exponential backoff retry                                │ │
│ │ - Added user notification for auth failures                            │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ 👤 sarah@example.com • 30 minutes ago                                  │ │
│ │ ✅ Approved                                                             │ │
│ │                                                                         │ │
│ │ Perfect! The error handling looks great now. Ready to merge! 🚀        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                                    [Close]  [Refresh]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### PR Status Indicators & Workflow

#### PR Mode Badges
- `📝 PR Mode` - Task configured for PR workflow
- `⚡ Direct` - Task using direct push mode
- `🔄 PR #42` - PR created and linked
- `✅ Merged` - PR successfully merged
- `❌ Closed` - PR closed without merging
- `🕐 2h` - Time since PR creation

#### Review Status Badges
- `👀 Pending` - Awaiting review
- `✅ Approved` - Review approved
- `👎 Changes` - Changes requested
- `🔄 Updated` - PR updated after feedback

### Workflow State Transitions

#### Direct Push Mode Flow
```
Todo (Direct) → Doing (Working) → Review (Manual) → Done (Complete)
              ↳ commits directly to main branch
```

#### PR Mode Flow
```
Todo (PR Mode) → Doing (Working) → Review (PR Created) → Done (Merged)
                ↳ creates branch  ↳ creates GitHub PR  ↳ merges PR
```

### AI Agent PR Integration

#### Intelligent Feedback Processing

1. **PR Comment Detection**: Real-time GitHub webhook integration
2. **Context Understanding**: AI analyzes code context and review comments
3. **Smart Task Reopening**: Tasks automatically move back to Doing for changes
4. **Targeted Code Updates**: AI implements specific requested changes
5. **Conversational Responses**: AI responds to reviewers with implementation details
6. **Iterative Improvement**: Multiple review cycles supported

#### AI Response Examples

**Code Review Response:**
```markdown
Human Reviewer: "Please add input validation for the email field"

AI Agent Response:
"I've added comprehensive email validation with the following improvements:
- Regex validation for email format
- Length limits (max 254 chars per RFC 5321)
- Sanitization to prevent XSS
- User-friendly error messages

Changes implemented in commit abc123f. Please review the updated validation logic in `src/auth/validators.ts`."
```
