# Solo Unicorn — UI/UX Design

## Core UI Components

Whenever in doubt, follow Trello UI/UX design.

### KanbanBoard component with layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] [Project ▼]                           [🌙/☀️] [👤 User ▼]           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Project Name                           [⏸️ Pause] [⚙️ Settings]              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─────────┬─────────┬─────────┬─────────┐                                   │
│ │  TODO   │  DOING  │  CHECK  │  DONE   │                                   │
│ ├─────────┼─────────┼─────────┼─────────┤                                   │
│ │┌───────┐│         │         │         │                                   │
│ ││Normal ▼││         │         │         │                                   │
│ │├───────┤│         │         │         │                                   │
│ ││┌─────┐││┌───────┐│┌───────┐│┌───────┐│                                   │
│ │││Task │││ Task  ││ Task  ││ Task  ││                                   │
│ │││P H  │││ P L   ││ P M   ││ P H   ││                                   │
│ │││Exec▼│││ Plan  ││ Check ││ Done  ││                                   │
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
- Pause|Resume button for AI agent (Left of settings)
- Settings button (Right side)

**Main Kanban Board Area**

- 4 columns: Todo, Doing, Check, Done
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

**Check Column:**

1. Title line
2. Badge row (Priority emoji+number, Mode badge)
3. Description (collapsible, 3.5 lines visible)
4. Review button

**Done Column:**

1. Title line
2. Badge row (Priority emoji+number, Mode badge)
3. Description (collapsible, 3.5 lines visible)

### TaskPreview component (Column-Specific)

**Todo Column Card:**

```
┌─────────────────────────────────────┐
│ Task Title Here                     │
├─────────────────────────────────────┤
│ P High [Execute ▼] [🔄 Queueing]      │
├─────────────────────────────────────┤
│ Description text here that can be   │
│ multiple lines long and will show   │
│ only first 3.5 lines by default... │
│ ⋮                                   │
├─────────────────────────────────────┤
│                        [Ready]     │
└─────────────────────────────────────┘
```

**Check Column Card:**

```
┌─────────────────────────────────────┐
│ Task Title Here                     │
├─────────────────────────────────────┤
│ P Low [Execute]                        │
├─────────────────────────────────────┤
│ Description text here that can be   │
│ multiple lines long and will show   │
│ only first 3.5 lines by default... │
│ ⋮                                   │
├─────────────────────────────────────┤
│                       [Review]     │
└─────────────────────────────────────┘
```

*Note: Check column shows the last stage's mode (Execute) as a display badge*

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
- **Check Column**: (no Process badge)
- **Done Column**: (no Process badge)

#### Task Mode System

**Todo Column** (Editable dropdown):

- Clarify ▼
- Plan ▼
- Execute ▼
- Check ▼
- Iterate ▼

**Other Columns** (Display badge only):

- [Clarify]
- [Plan]
- [Execute]
- [Check]
- [Iterate]

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

**Review Button** (Check column only):

- Opens TaskViewPopup → CheckTab
- Shows "review instruction"
- Approve/Reject buttons
- Reject requires mandatory "feedback" field
- Approved tasks move to Done column

**TaskViewPopup Integration**

- Check column Review button → CheckTab
- CheckTab displays review instructions
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
│ │ Priority: [High ▼]  Mode: [Execute ▼]  List: [Doing ▼]                 ││
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

**Plan Tab** (when mode=plan):
```
┌─ PLAN TAB ────────────────────────────────────────────────────────────────┐
│ Choose Solution:                                                         │
│ OAuth + JWT tokens                                                       │
│ Solution Description:                                                    │
│ .....                                                                     │
│                                                                           │
│ Implementation Plan:                                                      │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ ✅ Set up OAuth provider integration                               │   │
│ │ [ ] Create JWT token generation/validation                          │   │
│ │ [ ] Build login/logout UI components                                │   │
│ │ [ ] Implement session management                                     │   │
│ │ [ ] Add password reset functionality                                 │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**Review Tab** (when list=check):
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
│ Task Metadata:                                                            │

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
│ ┌─────────────────┬─────────────────────────────────────────────────────┐   │
│ │ Agent           │ Actor                                               │   │
│ │ [Claude Code ▼] │ [Default ▼]                                         │   │
│ └─────────────────┴─────────────────────────────────────────────────────┘   │
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
- **Description**: Rich text with file attachment support
- **Mode**: Default "Clarify", affects workflow path
- **Priority**: Default "Medium", visual priority in board
- **List**: Default "Todo", can create directly in other columns
- **Repository**: Required, pre-selected if only one available
- **Agent**: Required, pre-selected if only one available
- **Actor**: Optional, defaults to project default actor
- **Dependencies**: Task picker with search/filter
- **Auto-ready**: Convenience flag to skip manual ready toggle

### ProjectSettingsPopup component

**Modal Layout with Tabs**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project Settings: My App                                              [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [General] [Repositories] [Agents] [Actors] [Integrations]                  │
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

**Repositories Tab**:
```
┌─ REPOSITORIES TAB ────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📁 Main Repository                                      [Edit] [×]   │   │
│ │ Path: /home/user/repos/my-app                                      │   │
│ │ Status: ✅ Connected  •  Max Concurrent: 1                         │   │
│ │ Last Active: 2 minutes ago                                         │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📁 Frontend Repository                                  [Edit] [×]   │   │
│ │ Path: /home/user/repos/my-app-frontend                            │   │
│ │ Status: ⚠️ Path not found  •  Max Concurrent: 1                    │   │
│ │ Last Active: Never                                                 │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [+ Add Repository]                                                        │
└───────────────────────────────────────────────────────────────────────────┘
```

**Agents Tab**:
```
┌─ AGENTS TAB ──────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 🤖 Claude Code (Primary)                                [Edit] [×]   │   │
│ │ Status: ✅ Active  •  Rate Limit: Available                         │   │
│ │ Config Dir: ~/.claude-main  •  Max Concurrent: Unlimited           │   │
│ │ Last Used: 5 minutes ago  •  Tasks Completed: 47                   │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 🤖 Claude Code (Secondary)                              [Edit] [×]   │   │
│ │ Status: 🚫 Rate Limited until 3:00 PM                               │   │
│ │ Config Dir: ~/.claude-backup  •  Max Concurrent: 3                 │   │
│ │ Last Used: 1 hour ago  •  Tasks Completed: 12                      │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [+ Add Agent ▼] [Claude Code] [OpenCode] [Cursor CLI]                    │
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

**Step 2 - Repository Setup**:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create New Project (Step 2 of 3)                                     [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✅ Project Details  ● Workstation Setup                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Connect your code Workstation                                             │
│ Workstation: [1 ▼]                                                     │ │
│                                                [← Back] [Cancel] [Next →] │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Step 3 - Agent Configuration**:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create New Project (Step 3 of 3)                                     [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ✅ Project Details  ✅ Workstation Setup  ● Repo Configuration              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Connect your code repositories                                             │
│                                                                             │
│ Main Repository *                                                           │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Github URL: [https://github.com/user/my-repo                        ] │ │
│ │ Max Concurrent Tasks: [1 ▼]                                            │ │
│ │                                                                         │ │
│ │ Status: ✅ Valid directory found                                        │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│                                                                             │
│ ☑️ Create sample "Welcome" task to test the setup                          │
│                                                                             │
│                                          [← Back] [Cancel] [Create Project]│
└─────────────────────────────────────────────────────────────────────────────┘
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
│ │ │ 🤖 2 agents     │ 🤖 1 agent      │ 🤖 1 agent     │ 🤖 3 agents │ │      │
│ │ │ ✅ 23 done      │ ✅ 45 done      │ ✅ 12 done     │ ✅ 67 done  │ │      │
│ │ │                 │                 │                 │             │ │      │
│ │ │ [Open]          │ [Open]          │ [Open]          │ [Open]      │ │      │
│ │ └─────────────────┴─────────────────┴─────────────────┴─────────────┘ │      │
│ └─────────────────────────────────────────────────────────────────────┘      │
│                                                                             │
│ ┌─ Team Members (3) ─────────────────────────────────────────────────┐      │
│ │                                                          [+ Invite] │      │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │      │
│ │ │ 👤 John Doe (Owner)                              [Settings] [×] │ │      │
│ │ │ john@company.com  •  Active 2 hours ago                        │ │      │
│ │ │ Projects: Mobile App, Web Portal                                │ │      │
│ │ └─────────────────────────────────────────────────────────────────┘ │      │
│ │                                                                     │      │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │      │
│ │ │ 👤 Jane Smith (Admin)                            [Settings] [×] │ │      │
│ │ │ jane@company.com  •  Active 1 day ago                          │ │      │
│ │ │ Projects: Analytics, DevTools                                   │ │      │
│ │ └─────────────────────────────────────────────────────────────────┘ │      │
│ │                                                                     │      │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │      │
│ │ │ 👤 Mike Johnson (Member)                         [Settings] [×] │ │      │
│ │ │ mike@company.com  •  Invited (pending)                          │ │      │
│ │ │ Projects: Web Portal                                            │ │      │
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
│ [General] [Members] [Billing] [Security] [Integrations]                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ GENERAL TAB ─────────────────────────────────────────────────────────────┐│
│ │ Organization Details:                                                    ││
│ │ Name: [My Organization                                                 ] ││
│ │ Domain: [my-org.solo-unicorn.ai                                        ] ││
│ │ Logo: [📷 Upload Logo]                                                   ││
│ │                                                                          ││
│ │ Default Settings:                                                        ││
│ │ Default Project Template: [Empty Project ▼]                             ││
│ │ Default Agent Type: [Claude Code ▼]                                     ││
│ │ Auto-invite to new projects: [☑]                                         ││
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
