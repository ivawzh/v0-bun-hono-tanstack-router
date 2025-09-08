# Solo Unicorn Web Design

## Overview

Solo Unicorn v3 introduces **Pull Request Support** for controlled development flows while maintaining fast iteration for early-stage projects, plus **Public Projects** with granular permission controls for community collaboration.

### Key Features
- **Optional PR Modes**: Direct push (early stage) vs PR flow (production)
- **Seamless GitHub Integration**: Auto-create PRs, sync comments, handle reviews
- **AI Feedback Loop**: Agents read and respond to GitHub PR comments
- **Flexible Configuration**: Per-project defaults with per-mission overrides
- **Public Projects**: Community collaboration with granular permission controls
- **Project Discovery**: Browse, star, and contribute to public projects
- **Permission Management**: Role-based access (Public, Contributor, Collaborator, Maintainer, Owner)

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
│ │││Mission │││ Mission  ││ Mission  ││ Mission  ││                                   │
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
- Todo column has special split sections (Normal/Loop missions)
- Each card shows MissionPreview component
- Kanban column height is fixed and scrollable.
- Mobile friendly horizontal scroll.
- Drag and drop will update mission.list.

**MissionPreview Card Structure** (Column-Specific)

**Todo Column:**

1. Title line
2. Badge row (Priority emoji+number, Stage dropdown ▼, Process badge)
3. Description (collapsible, 3.5 lines visible)
4. Ready toggle button

**Doing Column:**

1. Title line
2. Badge row (Priority emoji+number, Stage badge, Process badge)
3. Description (collapsible, 3.5 lines visible)
4. Ready toggle button

**Review Column:**

1. Title line
2. Badge row (Priority emoji+number, Stage badge, **PR status badge**)
3. Description (collapsible, 3.5 lines visible)
4. **GitHub PR link** (if PR mode)
5. Review actions (Approve/Request Changes)

**Done Column:**

1. Title line
2. Badge row (Priority emoji+number, Stage badge, **PR status badge**)
3. Description (collapsible, 3.5 lines visible)
4. **GitHub PR/Merge info** (if applicable)

### MissionPreview component (Column-Specific)

**Todo Column Card:**

```
┌─────────────────────────────────────┐
│ Mission Title Here                  [⋮]│
├─────────────────────────────────────┤
│ P High [Code ▼] [📝 PR Mode]         │
├─────────────────────────────────────┤
│ Branch: solo-unicorn/mission-auth-123  │
├─────────────────────────────────────┤
│ Description text here that can be   │
│ multiple lines long and will show   │
│ only first 3.5 lines by default... │
│ ⋮                                   │
├─────────────────────────────────────┤
│                        [Ready]     │
└─────────────────────────────────────┘
```

**MissionPreview Dropdown Menu (⋮)**:
- View & Edit (opens MissionViewPopup)
- Reset AI (when mission is active)
- Delete Mission

**Review Column Card:**

```
┌─────────────────────────────────────┐
│ Mission Title Here                     │
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

*Note: Review column shows the current stage being reviewed as a display badge*

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

#### Mission Stage System

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

- Collapsible "Normal Missions" section (default open)
- Collapsible "Loop Missions" section (default closed)
- When both open: 50/50 vertical split
- Smooth expand/collapse animations

**AI Agent Controls**

- Pause/Resume button in sub-header
- Controls the AI agent mission processing queue
- Visual indicator of current agent state

**Column-Specific Controls**

**Ready Toggle** (Todo/Doing columns only):

- Ready: Green "Ready" button
- Not Ready: Red "Not Ready" button
- Affects mission eligibility for AI processing

**Review Button** (Review column only):

- Opens MissionViewPopup → Review Tab
- Shows "review instruction"
- Approve/Reject buttons
- Reject requires mandatory "feedback" field
- Approved missions move to Done column

**MissionViewPopup Integration**

- Review column Review button → Review Tab
- Review Tab displays review instructions
- Approve: Move to Done
- Reject: Require feedback + return to previous column

This layout provides a comprehensive mission management system specifically designed for AI-agent flows with clear visual hierarchy and intuitive controls.

### MissionViewPopup component

**Modal Layout (Full Screen on Mobile)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Mission: Implement user authentication                                   [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Base] [Clarify] [Plan] [Review] [Dependencies] [Settings]                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ BASE TAB ────────────────────────────────────────────────────────────────┐│
│ │ Title: [Implement user authentication                                   ]││
│ │ Description: [Create login page with email/password validation...       ]││
│ │ Priority: [High ▼]  Stage: [Code ▼]  List: [Doing ▼]                    ││
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
│ ID: mission_123456789                                                        │
│ Created: Dec 15, 2024 2:30 PM                                            │
│ Updated: Dec 15, 2024 4:45 PM                                           |│                                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tab Structure**:

**Base Tab** (Default):
- Editable fields: Title, Description, Priority, Stage, List
- Read-only: Repository, Agent, Actor (configured at creation)
- Attachments with drag-and-drop upload
- Real-time status display
- Action buttons: Delete Mission, Save Changes

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
│ │ ⏳ Create user dashboard (waiting for this mission)                    │   │
│ │ ⏳ Implement user profile page                                       │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

**Settings Tab**:
```
┌─ SETTINGS TAB ────────────────────────────────────────────────────────────┐
│ Mission Configuration:                                                       │
│ Workstation: [My MacBook Pro ▼]                                          │
│ Repository: [Main Repo (github.com/user/project)]                        │
│                                                                           │
│ Mission Metadata:                                                            │
│ ID: mission_123456789                                                        │
│ Created: Dec 15, 2024 2:30 PM                                            │
│ Author: user.name                                                         │
│                                                                           │
│ Advanced Settings:                                                        │
│ Auto-ready: [☑] Mark ready automatically when dependencies complete      │
│ Notifications: [☑] Notify when mission status changes                       │
│ Time tracking: [☐] Track time spent on this mission                         │
│                                                                           │
│ Danger Zone:                                                              │
│ [🔄 Reset AI] [🗑️ Delete Mission]                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### MissionCreatePopup component

**Modal Layout (Responsive)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create New Mission                                                       [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Title *                                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Mission title here...                                                      │ │
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
│ │ Stage            │ Priority        │ List            │ Repository      │   │
│ │ [Clarify ▼]     │ [Medium ▼]      │ [Todo ▼]        │ [Main Repo ▼]  │   │
│ └─────────────────┴─────────────────┴─────────────────┴─────────────────┘   │
│                                                                             │
│ ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐   │
│ │ Workstation     │ Agent           │ Model           │ Actor           │   │
│ │ [MacBook Pro ▼] │ [Claude Code ▼] │ [GPT-4 ▼]      │ [Default ▼]    │   │
│ └─────────────────┴─────────────────┴─────────────────┴─────────────────┘   │
│                                                                             │
│ │ Flow: [Standard Development ▼] ← PRIMARY SELECTION                         │
│ │                                                                             │
│ │ ▼ Optional: Start at a Specific Stage (skip earlier stages)                │
│ │ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ │ Start Stage (Optional): [From Beginning ▼]                              │ │
│ │ │                                                                         │ │
│ │ │ Available stages for "Standard Development" flow:                       │ │
│ │ │ ○ From Beginning (Clarify → Plan → Code)                                │ │
│ │ │ ○ Skip to Plan (Plan → Code)                                            │ │
│ │ │ ○ Skip to Code (Code only)                                              │ │
│ │ │                                                                         │ │
│ │ │ ℹ️ Selecting a later stage will skip the earlier stages in this flow    │ │
│ │ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Dependencies (Optional)                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ┌─ No dependencies selected ────────────────────────────────────────┐   │ │
│ │ │                                            [+ Add Dependency ▼]   │   │ │
│ │ └────────────────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Auto-ready: [☑] Mark mission ready for AI processing immediately              │
│                                                                             │
│                                             [Cancel] [Create Mission]         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Field Specifications**:

- **Title** (Required): Auto-focus, max 255 chars
- **Description**: Rich text with GitHub-style file attachment support
- **Stage**: Default "Clarify", affects flow path
- **Priority**: Default "Medium", visual priority in board
- **List**: Default "Todo", can create directly in other columns
- **Repository**: Shows GitHub URLs from projectRepo entities, max concurrent missions = 1
- **Workstation**: Required, defaults to single workstation if available
- **Agent**: Required, dynamically loaded from selected workstation
- **Model**: Required, appears after agent selection (GPT-5, GPT-4, etc.)
- **Actor**: Optional, narrower field, defaults to project default actor
- **Flow**: Primary selection - determines the sequence of stages (e.g., "Standard Development", "Quick Fix", "Research & Analysis")
- **Start Stage**: Optional secondary selection - allows skipping earlier stages in the selected flow
- **Dependencies**: Mission picker with search/filter
- **Auto-ready**: Convenience flag to skip manual ready toggle

### ProjectSettingsPopup component

**Modal Layout with Tabs**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project Settings: My App                                              [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [General] [Members] [Repositories] [Actors] [Flows]                       │
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
│ │ Max Concurrent Missions: [1 ▼]                                        │   │
│ │ Last Active: 2 minutes ago                                         │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📁 Frontend Repository                                  [Edit] [×]   │   │
│ │ GitHub URL: https://github.com/user/my-app-frontend                │   │
│ │ Max Concurrent Missions: [1 ▼]                                        │   │
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
│ │ Used by: 34 missions                                                  │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 Frontend Specialist                                  [Edit] [×]   │   │
│ │ Description: React/TypeScript expert focused on UI/UX best         │   │
│ │              practices and responsive design                        │   │
│ │ Used by: 8 missions                                                   │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [+ Create Actor]                                                          │
└───────────────────────────────────────────────────────────────────────────┘
```

**Flows Tab**:
```
┌─ FLOWS TAB ───────────────────────────────────────────────────────────────┐
│ Project Flows:                                                              │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📋 Standard Development (Default)                       [Edit] [×]   │   │
│ │ Sequence: Clarify(✓) → Plan(✓) → Code                                 │   │
│ │ Used by: 28 missions                                                    │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📋 Quick Fix                                            [Edit] [×]   │   │
│ │ Sequence: Code                                                        │   │
│ │ Used by: 12 missions                                                    │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 📋 Research & Analysis                                  [Edit] [×]   │   │
│ │ Sequence: Clarify(✓) → Plan(✓) → Code(✓) → Review(✓)                │   │
│ │ Used by: 3 missions                                                     │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [+ Create Flow]                                                           │
│                                                                           │
│ Edit Flow Modal:                                                          │
│ ┌─ Create/Edit Flow ────────────────────────────────────────────────────┐   │
│ │ Name: [Research & Analysis                                        ]   │   │
│ │                                                                     │   │
│ │ Stage Sequence:                                                      │   │
│ │ ┌─ Drag to reorder ────────────────────────────────────────────┐     │   │
│ │ │ 1. ☑ Clarify    → [☑ Require Review] [⋮]                    │     │   │
│ │ │ 2. ☑ Plan       → [☑ Require Review] [⋮]                    │     │   │
│ │ │ 3. ☑ Code       → [☑ Require Verification] [⋮]             │     │   │
│ │ │ 4. ☑ Review     → [☑ Require Review] [⋮]                    │     │   │
│ │ └─────────────────────────────────────────────────────────────────┘     │   │
│ │ [+ Add Stage]                                                        │   │
│ │                                                                     │   │
│ │                                         [Cancel] [Save Flow]       │   │
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
│ │ Max Concurrent Missions: [1 ▼]                                            │ │
│ │                                                                         │ │
│ │ Status: ✅ Valid repository found                                       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Additional Repositories (Optional):                           [+ Add More] │                                                                                                     │                                                                             │
│ ☑️ Create sample "Welcome" mission to test the setup                          │
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
│ │ Current Missions:                                                        ││
│ │ ┌──────────────────────────────────────────────────────────────────────┐ ││
│ │ │ 🤖 Agent: Claude Code                                                │ ││
│ │ │ 📋 Mission: Implement user authentication (mission_123456)                │ ││
│ │ │ 📁 Repository: github.com/user/my-app                                │ ││
│ │ │ ⏱️  Started: 15 minutes ago                                           │ ││
│ │ └──────────────────────────────────────────────────────────────────────┘ ││
│ │                                                                          ││
│ │ Quick Actions:                                                           ││
│ │ [🔄 Pause receiving missions] [📊 View Metrics] [🚫 Disconnect]             ││
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
│ │ Rate Limit: Available  •  Concurrent Missions: 1/1                       │   │
│ │ Last Activity: 2 minutes ago                                          │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 🤖 OpenCode                                             [Config] [×]   │   │
│ │ Version: v1.3.2                                                        │   │
│ │ Rate Limit: Available  •  Concurrent Missions: 0/2                       │ │
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
│ │ │ 12 missions        │ 8 missions         │ 3 missions        │ 15 missions    │ │      │
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

1. **MissionViewPopup**: Context-aware tabs based on mission state, real-time status updates
2. **MissionCreatePopup**: Streamlined creation with smart defaults, file attachment support
3. **ProjectSettingsPopup**: Comprehensive configuration with validation and status indicators
4. **ProjectCreatePopup**: 3-step wizard with validation and template support
5. **OrganizationPage**: Team management, project overview, usage tracking

All components follow the established design patterns with consistent spacing, responsive layouts, and mobile-first approach.

## Public Project Components

### PublicProjectViewPopup component

**Permission-aware Project View for Anonymous and Authenticated Users**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ E-commerce Starter Kit                                              [×]   │
│ by @ecommerce_expert • ⭐ 142 • 👥 8 contributors                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Overview] [Missions] [Contributors] [Analytics]          [🌟 Request Access]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─ OVERVIEW TAB ────────────────────────────────────────────────────────────┐│
│ │ Project Description:                                                      ││
│ │ Complete e-commerce solution with React frontend, Node.js backend,       ││
│ │ Stripe payments, and PostgreSQL database. Includes user authentication,  ││
│ │ product catalog, shopping cart, and admin dashboard.                     ││
│ │                                                                          ││
│ │ 🏷️ Tags: react, typescript, stripe, ecommerce, nodejs, postgresql       ││
│ │ 📂 Category: Web Development                                             ││
│ │ 🔗 Repository: github.com/ecommerce-expert/starter-kit (⭐ 89)           ││
│ │                                                                          ││
│ │ Progress: ██████████████████████▒▒▒ 92% (23/25 missions)                ││
│ │ Status: 🟢 Active • Last updated: 2 hours ago                           ││
│ │                                                                          ││
│ │ Workstation Activity: (based on workstation_visibility setting)         ││
│ │ 💻 2 workstations online (Status Only mode - no details shown)          ││
│ │                                                                          ││
│ │ Recent Activity:                                                         ││
│ │ • ✅ Mission completed: "Payment Gateway Integration" (2h ago)           ││
│ │ • 👤 New contributor: mike_dev joined as Contributor (5h ago)            ││
│ │ • 📋 Mission created: "Mobile Responsive Design" (1d ago)               ││
│ │                                                                          ││
│ │ Quick Actions:                                                           ││
│ │ [⭐ Star Project] [🍴 Use as Template] [📋 Browse Missions] [🤝 Contribute]││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                              [Close]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Missions Tab (Permission-aware)**:
```
┌─ MISSIONS TAB ────────────────────────────────────────────────────────────┐
│ Public Missions (23 completed, 2 active):              [Filter ▼] [Sort ▼]│
│                                                                            │
│ ✅ Completed Missions (Readable by public):                                │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ ✅ User Authentication System                          P High         │  │
│ │    JWT tokens, password hashing, session management                   │  │
│ │    Completed 3 days ago • Stage: Code                                  │  │
│ │    🔗 PR: #23 merged • 📁 Files: auth.ts, login.tsx (+4 more)        │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ 🚀 Active Missions (Contributors can see):                                │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ 🔄 Mobile Responsive Design                            P Medium        │  │
│ │    Make the entire app mobile-friendly with Tailwind CSS              │  │
│ │    Status: In Progress • Stage: Code                                    │  │
│ │    💻 Workstation: Hidden (Permission restricted)                      │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ Anonymous users see: Completed missions and basic info                    │
│ Contributors can: View active missions, create new missions               │
│ Collaborators can: See workstation assignments                           │
└────────────────────────────────────────────────────────────────────────────┘
```

### AccessRequestModal component

**Self-Service Permission Request System**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Request Access to: E-commerce Starter Kit                            [×]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Current Access: 👁️ Public (View only)                                       │
│                                                                             │
│ Request Permission Level:                                                   │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ○ Contributor                                                           │ │
│ │   ✓ Create and edit missions                                            │ │
│ │   ✓ Comment on missions and pull requests                              │ │
│ │   ✓ Submit mission dependencies                                         │ │
│ │   ✗ View workstation details                                            │ │
│ │   ✗ Execute missions                                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ ○ Collaborator                                                          │ │
│ │   ✓ All contributor permissions                                         │ │
│ │   ✓ View workstation status (if project allows)                        │ │
│ │   ✓ Access detailed analytics                                           │ │
│ │   ✓ Create flow templates                                               │ │
│ │   ✗ Execute missions on workstations                                    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Why do you want to contribute? (optional)                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ I have 5 years of React experience and would love to help improve      │ │
│ │ the authentication flow. I've built similar e-commerce systems         │ │
│ │ before and can contribute meaningful features.                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ GitHub Profile (optional): github.com/[myusername                       ] │
│                                                                             │
│ ℹ️  This project has automatic approval for Contributor access              │
│                                                                             │
│                                                    [Cancel] [Request Access]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### ProjectPermissionsPanel component

**Admin Interface for Managing Project Permissions**

```
┌─ PROJECT PERMISSIONS TAB ─────────────────────────────────────────────────┐
│ Public Access Settings:                                                     │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ Visibility: [🌍 Public ▼] (Private, Public)                        │   │
│ │                                                                     │   │
│ │ Anonymous Users Can:                                                │   │
│ │ ☑️ Read completed missions                                          │   │
│ │ ☑️ Read project documentation                                       │   │
│ │ ☑️ View repository information                                      │   │
│ │ ☐ See mission comments                                             │   │
│ │                                                                     │   │
│ │ Workstation Visibility: [🔒 Hidden ▼]                              │   │
│ │ • Hidden: No workstation info visible                              │   │
│ │ • Status Only: Show online/offline status                          │   │
│ │ • Full Details: Show all workstation information                   │   │
│ │                                                                     │   │
│ │ Contributors Can:                                                   │   │
│ │ ☑️ Create and edit missions                                         │   │
│ │ ☑️ Comment on missions                                              │   │
│ │ ☐ View active mission details                                      │   │
│ │                                                                     │   │
│ │ Auto-approve Contributor requests: [☑️]                             │   │
│ │ Require review for Collaborator+: [☑️]                             │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ Project Members:                                    [📧 Invite User]      │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 @ecommerce_expert (Owner)                         [Change Role ▼]│   │
│ │ Full project control, permission management                         │   │
│ │ Added: Project creation • Last active: 2 hours ago                 │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 @frontend_dev (Collaborator)                     [Change Role ▼]│   │
│ Can view workstation status, create flows                           │   │
│ │ Added: 2 weeks ago • Last active: 1 day ago                        │   │
│ │ [Message User] [Remove]                                             │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ Pending Requests (2):                                                     │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 @new_contributor → Contributor                                   │   │
│ │ "I want to help with the payment integration..."                    │   │
│ │ Requested: 3 hours ago • GitHub: github.com/new_contributor         │   │
│ │ [✅ Approve] [❌ Deny] [💬 Message]                                   │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [Save Changes]                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

### PublicProjectSettings component

**Enhanced Project Settings for Public Visibility**

```
┌─ PUBLIC SETTINGS TAB ─────────────────────────────────────────────────────┐
│ Project Visibility:                                                        │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ Current Status: [🌍 Public ▼] (Private, Public)                     │   │
│ │                                                                     │   │
│ │ ⚠️  Making project public will:                                     │   │
│ │ • Allow anyone to view project overview and completed missions     │   │
│ │ • Enable community contributions based on permission settings       │   │
│ │ • List project in public gallery (if not unlisted)                 │   │
│ │ • Generate public URL: solounicorn.lol/projects/my-project          │   │
│ │                                                                     │   │
│ │ Public URL Slug: [my-ecommerce-starter            ] (.unavailable)  │   │
│ │ Category: [Web Development ▼]                                       │   │
│ │ Tags: react, typescript, stripe, ecommerce                         │   │
│ │                                                                     │   │
│ │ Gallery Options:                                                    │   │
│ │ ☑️ List in public gallery                                          │   │
│ │ ☐ Submit for featured projects                                     │   │
│ │ ☑️ Allow use as template                                           │   │
│ │ ☑️ Enable community starring                                       │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ Public Project Preview:                                                   │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 🌍 E-commerce Starter Kit                              ⭐ 142 💬 23   │   │
│ │ Complete e-commerce solution with React, Stripe...                  │   │
│ │ by @ecommerce_expert • Web Development • 23/25 missions complete    │   │
│ │ 💻 2 workstations online • Updated 2 hours ago                      │   │
│ │ [View Project] [⭐ Star] [🍴 Use Template]                           │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ SEO & Sharing:                                                            │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ Project Description (for search & social sharing):                  │   │
│ │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│ │ │ Complete e-commerce solution with React frontend, Node.js      │ │   │
│ │ │ backend, Stripe payments, and PostgreSQL database. Perfect     │ │   │
│ │ │ for learning full-stack development with AI assistance.        │ │   │
│ │ │                                                                 │ │   │
│ │ └─────────────────────────────────────────────────────────────────┘ │   │
│ │                                                                     │   │
│ │ Social Preview Image: [📷 Upload Custom] or [🎨 Generate Badge]     │   │
│ │ README Integration: ☑️ Show README.md prominently                   │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ Privacy Controls:                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ Hide sensitive information:                                          │   │
│ │ ☑️ Hide organization details                                        │   │
│ │ ☑️ Hide workstation local paths                                     │   │
│ │ ☑️ Hide private mission details                                     │   │
│ │ ☑️ Hide user email addresses                                        │   │
│ │                                                                     │   │
│ │ Analytics & Tracking:                                               │   │
│ │ ☑️ Track project views and engagement                               │   │
│ │ ☑️ Show activity metrics publicly                                   │   │
│ │ ☐ Allow third-party analytics (Google Analytics, etc.)             │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ [Revert to Private] [Save Public Settings]                               │
└───────────────────────────────────────────────────────────────────────────┘
```

### CommunityDashboard component

**User Dashboard for Public Project Involvement**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] My Community Dashboard                          [🌙/☀️] [👤 User ▼]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ [My Projects] [Contributing] [Starred] [Templates] [Activity]                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ Contributing To (3) ─────────────────────────────────────────────────────┐ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐   │ │
│ │ │ 🌍 E-commerce Starter Kit                   📍 Collaborator Role     │   │ │
│ │ │ Your contributions: 5 missions created, 12 comments                 │   │ │
│ │ │ Recent: Added mobile responsive design mission (2 days ago)         │   │ │
│ │ │ [View Project] [View My Contributions]                             │   │ │
│ │ └─────────────────────────────────────────────────────────────────────┘   │ │
│ │                                                                         │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐   │ │
│ │ │ 🌍 AI Chatbot Framework                     📍 Contributor Role      │   │ │
│ │ │ Your contributions: 2 missions created, 8 comments                  │   │ │
│ │ │ Recent: Reviewed prompt optimization mission (1 week ago)              │   │ │
│ │ │ [View Project] [View My Contributions]                             │   │ │
│ │ └─────────────────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ Starred Projects (8) ────────────────────────────────────────────────────┐ │
│ │ 📌 Quick access to your favorite public projects                          │ │
│ │ [⭐ Design System] [⭐ Todo App] [⭐ Analytics Dashboard] [View All...]      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ My Templates Used (2) ───────────────────────────────────────────────────┐ │
│ │ Projects created from your public project templates:                      │ │
│ │ • "My Store" created from E-commerce Starter Kit (5 users)              │ │
│ │ • "Company Chat" created from AI Chatbot Framework (2 users)            │ │
│ │ [View Template Analytics]                                                  │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ Community Stats ─────────────────────────────────────────────────────────┐ │
│ │ Your Impact:                                                               │ │
│ │ 🎯 7 missions contributed • 🌟 24 stars received • 🍴 7 templates used     │ │
│ │ 💬 45 helpful comments • 🏆 Contributor level reached                      │ │
│ │                                                                           │ │
│ │ Recent Activity:                                                          │ │
│ │ • Starred "Mobile Game Engine" project                                    │ │
│ │ • Added comment to "E-commerce Starter Kit"                              │ │
│ │ • Created "Payment Integration" mission                                   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ [Discover More Projects] [Create Public Project]                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Public Project UI Features:**

1. **Permission-Aware Display**: UI adapts based on user's permission level
2. **Access Request Flow**: Self-service permission requests with approval workflow
3. **Public Gallery**: Browse, search, and discover public projects
4. **Community Features**: Starring, templating, and contribution tracking
5. **Privacy Controls**: Granular settings for workstation visibility and data exposure
6. **Role Management**: Visual role hierarchy with clear permission boundaries
7. **Activity Tracking**: Public activity feeds and contribution analytics

### PublicProjectGallery component

**Landing Page for Public Project Discovery**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] Discover Projects                              [Sign In] [Sign Up]     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Build AI-powered apps with the community                                      │
│ Explore, star, and contribute to public projects                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ 🔍 [Search projects...                    ] [All Categories ▼] [🔥 Trending] │
│                                                                             │
│ ┌─ Featured Projects ────────────────────────────────────────────────────┐   │
│ │ ┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐ │   │
│ │ │ ⭐ E-commerce    │ 🤖 AI Chatbot   │ 📱 Mobile App   │ 🎨 Design Tool  │ │   │
│ │ │ React + Stripe  │ OpenAI + Vector │ React Native    │ Figma Plugin    │ │   │
│ │ │ ⭐ 42 ✅ 23/25   │ ⭐ 38 ✅ 12/15   │ ⭐ 35 ✅ 8/12    │ ⭐ 29 ✅ 18/20   │ │   │
│ │ │ 💻 2 workstations│ 💻 1 workstation │ 💻 3 workstations│ 💻 1 workstation │ │   │
│ │ │ [View Project]  │ [View Project]  │ [View Project]  │ [View Project]  │ │   │
│ │ └─────────────────┴─────────────────┴─────────────────┴─────────────────┘ │   │
│ └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ ┌─ Browse by Category ──────────────────────────────────────────────────────┐   │
│ │ [🌐 Web Dev] [📱 Mobile] [🤖 AI/ML] [⚙️  DevTools] [🎮 Games] [More...] │   │
│ └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ ┌─ Recent Projects (12) ────────────────────────────────────────────────────┐   │
│ │ ┌─────────────────────────────────────────────────────────────────────┐   │   │
│ │ │ 📄 Todo App with AI Assistant                          ⭐ 15 ✅ 8/10  │   │   │
│ │ │ by @johndoe • React, OpenAI, TypeScript • Updated 2h ago            │   │   │
│ │ │ Build a smart todo app that suggests missions and priorities using AI   │   │   │
│ │ │ [View] [⭐ Star] [🍴 Use Template] [💬 3 comments]                   │   │   │
│ │ └─────────────────────────────────────────────────────────────────────┘   │   │
│ │                                                                         │   │
│ │ ┌─────────────────────────────────────────────────────────────────────┐   │   │
│ │ │ 🛒 Marketplace API                                     ⭐ 22 ✅ 15/18  │   │   │
│ │ │ by @sarah_dev • Node.js, PostgreSQL, Stripe • Updated 5h ago        │   │   │
│ │ │ Complete marketplace backend with payments, reviews, and analytics   │   │   │
│ │ │ [View] [⭐ Star] [💬 7 comments]                                      │   │   │
│ │ └─────────────────────────────────────────────────────────────────────┘   │   │
│ │                                                                         │   │
│ │ [Load More Projects...]                                                 │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### PublicProjectView component

**Public Project Detail Page**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Back] E-commerce Starter Kit                    [⭐ Star] [🍴 Use Template] │
├─────────────────────────────────────────────────────────────────────────────┤
│ by @ecommerce_expert • React, Stripe, PostgreSQL                            │
│ 42 stars • 23/25 missions completed • Last active: 2 hours ago                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ Project Overview ──────────────────────────────────────────────────────┐   │
│ │ Complete e-commerce solution with React frontend, Node.js backend,      │   │
│ │ Stripe payments, and PostgreSQL database. Includes user authentication, │   │
│ │ product catalog, shopping cart, and admin dashboard.                    │   │
│ │                                                                         │   │
│ │ 🏷️  Tags: react, nodejs, stripe, ecommerce, postgresql, api            │   │
│ │ 📊 Progress: 92% complete (23/25 missions)                                 │   │
│ │ 💻 Active Workstations: 2 (can contribute)                             │   │
│ │ 📈 Activity: High (5 missions completed this week)                        │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│ [📋 View Kanban] [💻 Contribute] [📖 Documentation] [💬 Discussions]         │
│                                                                             │
│ ┌─ Public Kanban Board (Read-Only) ──────────────────────────────────────┐   │
│ │ ┌─────────┬─────────┬─────────┬─────────┐                             │   │
│ │ │  TODO   │  DOING  │ REVIEW  │  DONE   │                             │   │
│ │ │ (2)     │ (0)     │ (0)     │ (23)    │                             │   │
│ │ ├─────────┼─────────┼─────────┼─────────┤                             │   │
│ │ │┌───────┐│         │         │┌───────┐│                             │   │
│ │ ││Mobile ││         │         ││User   ││                             │   │
│ │ ││App    ││         │         ││Auth   ││                             │   │
│ │ ││Support││         │         ││✅ Done││                             │   │
│ │ │└───────┘│         │         │└───────┘│                             │   │
│ │ │┌───────┐│         │         │┌───────┐│                             │   │
│ │ ││Payment││         │         ││Product││                             │   │
│ │ ││Gateway││         │         ││Catalog││                             │   │
│ │ ││P High ││         │         ││✅ Done││                             │   │
│ │ │└───────┘│         │         │└───────┘│                             │   │
│ │ └─────────┴─────────┴─────────┴─────────┘                             │   │
│ │                                                                       │   │
│ │ [📋 View Full Kanban] (opens in new layout)                          │   │
│ └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                                  [Join as Contributor]      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ProjectPermissionManager component

**Permission Management for Project Owners**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project Permissions - E-commerce Starter                               [×] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Project Access] [User Permissions] [Invitation Links]                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ PROJECT ACCESS TAB ──────────────────────────────────────────────────────┐│
│ │ Project Visibility:                                                      ││
│ │ ○ Private (Organization members only)                                    ││
│ │ ● Public (Discoverable by anyone)                                       ││
│ │   └─ Public URL: solounicorn.lol/projects/ecommerce-starter             ││
│ │                                                                          ││
│ │ Public Access Configuration:                                             ││
│ │ ┌────────────────────────────────────────────────────────────────────┐   ││
│ │ │ Anonymous Users Can:                                               │   ││
│ │ │ ☑ View project overview and description                           │   ││
│ │ │ ☑ View completed missions and progress                               │   ││
│ │ │ ☑ Read project memory/documentation                               │   ││
│ │ │ ☐ See workstation status (online/offline only)                   │   ││
│ │ └────────────────────────────────────────────────────────────────────┘   ││
│ │                                                                          ││
│ │ Contributor Permissions:                                                 ││
│ │ ┌────────────────────────────────────────────────────────────────────┐   ││
│ │ │ Contributors Can:                                                  │   ││
│ │ │ ☑ Create and edit missions                                           │   ││
│ │ │ ☑ Comment on missions and PRs                                        │   ││
│ │ │ ☑ Submit mission dependencies                                        │   ││
│ │ │ ☐ View workstation details                                        │   ││
│ │ └────────────────────────────────────────────────────────────────────┘   ││
│ │                                                                          ││
│ │ Advanced Settings:                                                       ││
│ │ Require approval for: [New contributors ▼]                             ││
│ │ Auto-invite: [☐] Automatically add org members as collaborators        ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│                                                      [Cancel] [Save]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**User Permissions Tab:**

```
┌─ USER PERMISSIONS TAB ────────────────────────────────────────────────────┐
│ Current Members (8):                                        [+ Invite User] │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 John Doe (Owner)                                    [Edit] [×]    │   │
│ │ john@company.com  •  Organization Owner                             │   │
│ │ Can: Admin, Execute, Read/Write, Workstations                      │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 Sarah Developer (Maintainer)                       [Edit] [×]    │   │
│ │ sarah@dev.com  •  Invited contributor                              │   │
│ │ Can: Execute missions, Read/Write, Workstations                       │   │
│ │ Override: [☑] Can invite users  [☐] Can manage repositories        │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐   │
│ │ 👤 Mike Contributor (Contributor)                     [Edit] [×]    │   │
│ │ mike@freelance.com  •  Public contributor                          │   │
│ │ Can: Read/Write missions, Comment                                      │   │
│ │ Status: ⏳ Pending invitation                                       │   │
│ └─────────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│ Permission Presets:                                                       │
│ [Contributor] [Collaborator] [Maintainer] [+ Custom Role]                │
└───────────────────────────────────────────────────────────────────────────┘
```

### PublicProjectContribute component

**Contribution Flow for Public Projects**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Contribute to E-commerce Starter                                      [×] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Request Access] [Create Mission] [View Guidelines]                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ REQUEST ACCESS TAB ──────────────────────────────────────────────────────┐│
│ │ Join as Contributor to this project                                      ││
│ │                                                                          ││
│ │ Your Role: [Contributor ▼] (Can create/edit missions, comment on work)     ││
│ │                                                                          ││
│ │ Why do you want to contribute?                                           ││
│ │ ┌────────────────────────────────────────────────────────────────────┐   ││
│ │ │ I'm interested in learning React and e-commerce development.       │   ││
│ │ │ I have experience with Stripe integration and would like to        │   ││
│ │ │ help improve the payment flow...                                   │   ││
│ │ │                                                                    │   ││
│ │ └────────────────────────────────────────────────────────────────────┘   ││
│ │                                                                          ││
│ │ Your Experience:                                                         ││
│ │ ☑ React/TypeScript  ☑ Node.js  ☐ Stripe  ☑ PostgreSQL  ☐ Docker      ││
│ │                                                                          ││
│ │ GitHub Profile (optional): [github.com/username                       ] ││
│ │                                                                          ││
│ │ ⚡ This project accepts contributors automatically                        ││
│ │ You'll be able to create missions and comment immediately after joining    ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│                                                        [Cancel] [Join Now] │
└─────────────────────────────────────────────────────────────────────────────┘
```

### PublicProjectTemplate component

**Use Project as Template Flow**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create Project from Template: E-commerce Starter                      [×] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Project Details] [Customization] [Workstation]                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ PROJECT DETAILS TAB ─────────────────────────────────────────────────────┐│
│ │ Your New Project:                                                        ││
│ │ Name: [My E-commerce App                                               ] ││
│ │ Description: [Online store for handmade crafts                        ] ││
│ │                                                                          ││
│ │ Template includes:                                                       ││
│ │ ✅ 25 pre-configured missions (User auth, Product catalog, Payments, etc.)  ││
│ │ ✅ Flow templates (Development, Testing, Deployment)                    ││
│ │ ✅ Project memory with tech stack documentation                         ││
│ │ ✅ Actor profiles (Frontend Dev, Backend Dev, Full-stack)               ││
│ │ ✅ Repository structure recommendations                                  ││
│ │                                                                          ││
│ │ Customizations:                                                          ││
│ │ ☑ Update mission descriptions for my use case                             ││
│ │ ☑ Modify tech stack recommendations                                     ││
│ │ ☐ Keep original project memory as-is                                   ││
│ │                                                                          ││
│ │ Visibility: [Private ▼] (You can make it public later)                 ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                             │
│                                                     [Back] [Next Step →]   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Mobile-First UI Design

### Kanban Board Mobile Layout

**Mobile**: Horizontal scrolling kanban board using shadcn components
```typescript
// Mobile kanban implementation
const MobileKanban = () => (
  <div className="overflow-x-auto">
    <div className="flex space-x-4 pb-4">
      <div className="min-w-80">
        <TodoColumn />
      </div>
      <div className="min-w-80">
        <DoingColumn />
      </div>
      <div className="min-w-80">
        <ReviewColumn />
      </div>
      <div className="min-w-80">
        <DoneColumn />
      </div>
    </div>
  </div>
);

// Desktop: 4-column grid layout
const DesktopKanban = () => (
  <div className="grid grid-cols-4 gap-4">
    <TodoColumn />
    <DoingColumn />
    <ReviewColumn />
    <DoneColumn />
  </div>
);
```

**Key Mobile Features**:
- Horizontal scroll with snap points
- Touch-friendly card interactions
- Full-screen modal popups
- Thumb-reachable navigation
- Same loop mission design as desktop (Regular Missions/Loop Missions sections)

## Pull Request Support UI/UX

### Overview

Solo Unicorn v3 introduces comprehensive Pull Request support enabling two distinct development workflows:

- **🚀 Direct Push Mode**: Fast iteration for early-stage projects
- **🔄 PR Mode**: Controlled development with GitHub integration

### Key Features

1. **Dual Workflow Support**: Seamlessly switch between direct push and PR modes
2. **GitHub Integration**: Auto-create PRs, sync comments, handle reviews
3. **AI Feedback Loop**: Agents read and respond to GitHub PR comments
4. **Flexible Configuration**: Per-project defaults with per-mission overrides
5. **Team Collaboration**: Multiple reviewers and real-time PR status

### Enhanced Mission Cards (PR Mode)

#### Review Column Card with PR Integration

```
┌─────────────────────────────────────┐
│ Implement OAuth integration      [⋮]│
├─────────────────────────────────────┤
│ P High [Review] 👀 PR #42 (pending) │
├─────────────────────────────────────┤
│ 🔗 [View GitHub PR] [💬 PR Comments] │
│ Branch: solo-unicorn/mission-oauth-456 │
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
│ Branch: solo-unicorn/mission-oauth-456 │
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
│ │   • Missions work directly on main branch                                 │ │
│ │   • No PR creation, immediate commits                                  │ │
│ │   • Best for: Early stage development, solo work                      │ │
│ │                                                                         │ │
│ │ ● PR Mode (Controlled development)                                     │ │
│ │   • Missions create individual branches                                   │ │
│ │   • Auto-create GitHub PRs when moving to Review                      │ │
│ │   • AI agents respond to GitHub PR comments                           │ │
│ │   • Best for: Production projects, team collaboration                 │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ PR Configuration (when PR Mode enabled)                                    │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Branch Prefix: [solo-unicorn/] (e.g., solo-unicorn/mission-123-auth)      │ │
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

### Mission Creation with PR Override

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create New Mission                                                             │
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
│                                            [Cancel]  [Create Mission]         │
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
- `⚡ Direct` - Mission using direct push mode
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
3. **Smart Mission Reopening**: Missions automatically move back to Doing for changes
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
