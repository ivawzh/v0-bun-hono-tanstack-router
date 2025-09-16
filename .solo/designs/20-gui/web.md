# GUI design - web

## Design Principles
- Friendly-first copy and layout so users always know status and next step
- Mobile-first compositions that rely on shadcn/ui Kanban + DnD for touch interactions
- Monster Theme tokens for color, spacing, typography, and elevation
- Centered modals for primary flows; drawers avoided
- Consistent Ready toggle across cards, modals, and mobile UI

## Information Architecture

### Site Map / Screen Inventory
```mermaid
graph TD
  L[Launchpad / Org Switcher]
  L --> OD[Org Dashboard]
  L --> PW[Project Workspace]
  L --> WK[Workstations]
  L --> PG[Public Gallery]
  L --> CM[Community]
  L --> NO[Notifications]
  L --> ST[Settings]

  PW --> KB[Kanban Board]
  KB --> KB1[Todo Column]
  KB1 --> KB1a[Normal Missions]
  KB1 --> KB1b[Fallback Templates]
  KB --> KB2[Doing]
  KB --> KB3[Review]
  KB --> KB4[Done]

  PW --> MM[Mission Modal]
  PW --> PS[Project Settings]
  PW --> PR[PR Center]
  PW --> PL[Project Library]

  PG --> PG1[Gallery]
  PG --> PG2[Public Project Detail]
```

### Navigation
- **Top header:** Logo, project picker, dark/light toggle, user menu
- **Sub header:** Project name, PR mode indicator (🔄 / ⚡), active members, online workstations, Pause/Resume AI, Settings
- **Mobile:** Bottom tab bar mirrors top-level nav; horizontal scroll Kanban with shadcn/ui DnD gestures
- **Quick actions:** `+ Mission`, `Invite teammate`, `Edit project`

## Mission Board Pattern

### Kanban Board Layout
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] [Project ▼]                           [🌙/☀️] [👤 User ▼]            │
├──────────────────────────────────────────────────────────────────────────────┤
│ Project Name                👤👤👤 🟢 Workstations: 2  [⏸️ Pause] [⚙️ Settings] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌─────────┬─────────┬─────────┬─────────┐                                    │
│ │  TODO   │  DOING  │ REVIEW  │  DONE   │                                    │
│ ├─────────┼─────────┼─────────┼─────────┤                                    │
│ │┌───────┐│         │         │         │                                    │
│ ││Normal ▼││        │         │         │                                    │
│ │├───────┤│         │         │         │                                    │
│ ││┌─────┐││┌───────┐│┌───────┐│┌───────┐│                                    │
│ │││Mission │││ Mission  ││ Mission  ││ Mission  ││                                    │
│ │││P H   │││ P L    ││ P M    ││ P H    ││                                   │
│ │││Code  │││ Plan   ││ Review ││ Done   ││                                   │
│ │││🔄    │││🤖 AI   ││        ││        ││                                  │
│ │││Desc  │││ Desc   ││ Desc   ││ Desc   ││                                   │
│ │││Ready │││ Ready  ││ Review ││        ││                                   │
│ ││└─────┘││└───────┘│└───────┘│└───────┘│                                    │
│ │├───────┤│         │         │         │                                    │
│ ││Fallback▶││         │         │         │                                 │
│ │└───────┘│         │         │         │                                    │
│ └─────────┴─────────┴─────────┴─────────┘                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Todo column splits into **Normal missions** and **Fallback templates** (collapsible). Fallback items are reusable placeholders; selecting one opens a pre-filled Mission Modal, creates a mission in Todo, and leaves the template in place to fill idle agent time when no Ready missions exist.
- Doing, Review, Done columns follow traditional Kanban. Drag/drop updates `mission.list`.
- Ready toggle appears on every mission card footer (Todo/Doing) with the same styling as Mission Modal.

### Mission Card Structure

#### Todo / Doing Card
```
┌───────────────────────────────────────┐
│ Mission Title Here                [⋮] │
├───────────────────────────────────────┤
│ P High [Code]                         │
├───────────────────────────────────────┤
│ Branch: solo-unicorn/mission-auth-123 │
├───────────────────────────────────────┤
│ Description text… (3.5 lines, collapsible)│
│ ⋮                                      │
├───────────────────────────────────────┤
│ Ready status: ☐ Not Ready              │
│ [ Toggle Ready ]                       │
└───────────────────────────────────────┘
```
- Dropdown menu (⋮): View & Edit, Reset AI, Delete Mission.

#### Review Card (PR Mode)
```
┌─────────────────────────────────────┐
│ Mission Title Here                  │
├─────────────────────────────────────┤
│ P Medium [Plan]  👀 PR #42           │
├─────────────────────────────────────┤
│ Branch: solo-unicorn/mission-auth-123│
│ Description preview…                │
├─────────────────────────────────────┤
│ GitHub PR → https://github.com/...  │
│ [Approve] [Request Changes]         │
└─────────────────────────────────────┘
```

#### Done Card
```
┌─────────────────────────────────────┐
│ Mission Title Here                  │
├─────────────────────────────────────┤
│ P Low [Code]  ✅ Merged              │
├─────────────────────────────────────┤
│ Branch: solo-unicorn/mission-auth-123│
│ Description preview…                │
├─────────────────────────────────────┤
│ Merged by sarah@example.com         │
└─────────────────────────────────────┘
```

## Mission Modal (Popup)

Mission Modal replaces the “Mission Room”. Content is identical to the original MissionPopup design.
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Mission Title Here                                    [⟳ Refresh]  [×]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Tabs: Overview | Activity | Flow | Files | Review | History                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Overview                                                                    │
│ • Priority: P High                                                          │
│ • Stage: Plan                                                               │
│ • Process: Queueing                                                         │
│ • Ready status: [ Toggle Ready ]                                            │
│ • Repository: solo-unicorn/mission-auth-123                                 │
│ • Branch: mission-auth-123                                                  │
│ • Actor: Claude Code                                                        │
│ • Flow: Normal (Clarify → Plan → Code)                                      │
│ • Dependencies: Mission #123                                                │
│ • Description: …                                                            │
│ • Acceptance Criteria: …                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Activity log (Agent + Human events)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Flow tab: edit stages, toggle reviews, skip stage                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ Files tab: list changed files + view diff                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Review tab: Approve / Request changes with feedback box                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ History tab: timeline of mission state                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Mission Creation Modal
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Create New Mission                                                       [×] │
├─────────────────────────────────────────────────────────────────────────────┤
│ Title, Description (+ attachments)                                         │
│ Priority, List, Repository, Workstation, Actor                             │
│ Flow (primary): stages with enable/review toggles                           │
│ Dependencies (optional)                                                    │
│ Ready toggle (default off)                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Project & Organization Views

### Project Settings – PR Configuration
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project Settings — PR Mode                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ Branch Prefix: [solo-unicorn/]                                             │
│ Target Branch: [main ▼]                                                    │
│ Require Review: [✓]                                                         │
│ Auto-merge: [✓]                                                             │
│ Delete Branch After Merge: [✓]                                              │
│ PR Template: [Edit Template…]                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Workstation View
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Workstations                                             [Register Workstation] │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🟢 Delta (macOS)  •  Agents: Claude Code  •  Active Missions: 1             │
│ Ready to accept fallback templates when backlog is empty.                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 🟡 Echo (Linux)   •  Agents: Cursor       •  Active Missions: 0             │
│ Recommend toggling Ready on queued missions to keep agents busy.           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Organization Page
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Organization: My Org                                   [⚙️ Settings]        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Projects grid, Workstations list, Team members list                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Organization Settings
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Organization Settings                                                 [×]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ [General] [Members] [Security] [Integrations]                                │
├─────────────────────────────────────────────────────────────────────────────┤
│ General: Name, Domain, Logo; Defaults (project template, workstation reg)    │
│ Members: Invite/manage roles (Owner/Admin/Member)                            │
│ Security: Token policies; SSO providers (via Monster Auth)                   │
│ Integrations: GitHub linking; repo access guidance                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Public Surfaces

### Public Project Gallery
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [LOGO] Discover Projects                              [Sign In] [Sign Up]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Search + Category filter + Featured + Recent projects with stats             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Public Project View
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [← Back] Project Title                      [⭐ Star] [🍴 Use Template]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Overview, Tags, Progress, Activity, Read-only Kanban, Permission-aware CTA  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Access Request Modal
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Request Access                                                          [×] │
├─────────────────────────────────────────────────────────────────────────────┤
│ Levels: ○ Contributor  ○ Collaborator                                       │
│ Why do you want to contribute? (optional)                                   │
│ GitHub Profile (optional): github.com/[username]                            │
│ Project may auto-approve Contributor requests                               │
│                                                       [Cancel] [Request]     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Project Permissions Panel
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project Permissions                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Visibility: [Private ▼ | Public]                                            │
│ Anonymous Users Can: [✓ Read completed missions] [✓ Read docs] [✓ Repo info] │
│ Workstation Visibility: [Hidden | Status Only | Full Details]                │
│ Contributors Can: [✓ Create/Edit missions] [✓ Comment]                       │
│ Collaborators Can: [✓ Review] [✓ View workstation details]                   │
│ Maintainers Can: [✓ Execute missions] [✓ Manage repositories]                │
│ Owners: Full control                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Mobile Patterns
- Uses shadcn/ui Kanban with DnD for horizontal scroll; cards stack vertically within each column.
- Ready toggle sits at bottom of each card with large tap target.
- Mission Modal becomes full-screen sheet on mobile.
- Todo column preserves Normal vs Fallback accordion sections (default closed for Fallback).
- PR review experiences link out to GitHub but show status chips on cards.

## States & Feedback
- **Ready toggle:** consistent component across card footers and modal; label clarifies effect on AI eligibility.
- **Fallback templates:** remain even after mission creation; show last-used timestamp to indicate freshness.
- **Errors:** Inline banners and toasts with retry; fallback failure links to template edit.
- **Notifications:** Severity badges (⚠️, ✅) align with Monster Theme colors.
