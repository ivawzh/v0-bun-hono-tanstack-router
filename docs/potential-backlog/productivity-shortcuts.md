# Productivity Shortcuts & Bulk Operations

## Overview

Supercharge Solo Unicorn with power-user features including comprehensive keyboard shortcuts, bulk operations, quick filters, and advanced navigation that enables experienced developers to manage large numbers of tasks with lightning speed.

**Priority**: Phase 1 (High Impact, Low Effort)
**User Impact**: 4/5 | **Effort**: 2/5 | **Magic**: 3/5 | **Mobile**: 2/5

## Current Power User Limitations

### Keyboard Navigation Gaps
1. **Mouse Dependency**: Most operations require mouse/touch interaction
2. **No Quick Navigation**: Can't jump between projects, boards, or tasks with keyboard
3. **Repetitive Actions**: Updating multiple similar tasks requires individual clicks
4. **No Command Palette**: No quick way to execute commands or find features

### Bulk Operation Challenges
- **Individual Updates**: Must edit each task's priority/status separately
- **No Multi-Select**: Can't select and operate on multiple tasks at once
- **Repetitive Creation**: Creating similar tasks requires full form each time
- **No Batch Actions**: Archive, delete, or move operations are one-by-one

## Proposed Solution

### Universal Keyboard Shortcuts
Transform every major action into keyboard-accessible operations with intuitive, discoverable shortcuts.

### Bulk Operations System
Enable power users to select and manipulate multiple tasks simultaneously with batch operations.

### Command Palette
Add searchable command interface for instant access to any feature or action.

### Quick Filters & Search
Rapid filtering and search capabilities to focus on relevant tasks instantly.

## Core Features

### 1. Comprehensive Keyboard Shortcuts

#### Global Navigation
```typescript
interface GlobalShortcuts {
  'Ctrl+T': 'quick-task-creation'           // Create task anywhere
  'Ctrl+K': 'command-palette'              // Open command palette
  'Ctrl+/': 'keyboard-shortcuts-help'      // Show shortcuts overlay
  'Ctrl+R': 'refresh-current-view'         // Refresh data
  'Ctrl+S': 'quick-save'                   // Save current state
  'Ctrl+Z': 'undo-last-action'            // Undo last operation
  'Ctrl+Shift+Z': 'redo-action'           // Redo operation
  'Escape': 'close-modal-or-cancel'       // Universal cancel
}
```

#### Task Management
```typescript
interface TaskShortcuts {
  'Enter': 'open-task-details'            // Open selected task
  'Space': 'toggle-task-ready'            // Toggle ready state
  'Delete': 'delete-selected-tasks'       // Delete selected
  'Ctrl+D': 'duplicate-task'              // Duplicate current
  'Ctrl+A': 'select-all-visible'          // Select all in column
  'Ctrl+Shift+A': 'select-all-project'    // Select all in project

  // Priority shortcuts
  '1': 'set-priority-1'                   // Set to P1 (lowest)
  '2': 'set-priority-2'                   // Set to P2
  '3': 'set-priority-3'                   // Set to P3 (medium)
  '4': 'set-priority-4'                   // Set to P4
  '5': 'set-priority-5'                   // Set to P5 (highest)

  // Status shortcuts
  'T': 'move-to-todo'                     // Move to Todo
  'D': 'move-to-doing'                    // Move to Doing
  'X': 'move-to-done'                     // Move to Done
  'L': 'move-to-loop'                     // Move to Loop
}
```

#### Board Navigation
```typescript
interface BoardShortcuts {
  'ArrowLeft': 'previous-column'          // Focus previous column
  'ArrowRight': 'next-column'             // Focus next column
  'ArrowUp': 'previous-task'              // Focus previous task
  'ArrowDown': 'next-task'                // Focus next task
  'Tab': 'next-interactive-element'      // Standard tab navigation
  'Shift+Tab': 'previous-interactive'    // Reverse tab navigation

  'Ctrl+1': 'focus-todo-column'          // Jump to Todo
  'Ctrl+2': 'focus-doing-column'         // Jump to Doing
  'Ctrl+3': 'focus-done-column'          // Jump to Done
  'Ctrl+4': 'focus-loop-column'          // Jump to Loop
}
```

### 2. Multi-Select & Bulk Operations

#### Selection System
```typescript
interface TaskSelection {
  mode: 'single' | 'multi' | 'range'
  selectedTasks: string[]                 // Task IDs
  lastSelected: string | null             // For range selection

  // Selection methods
  clickSelect: (taskId: string, withCtrl: boolean) => void
  rangeSelect: (fromId: string, toId: string) => void
  selectAll: (column?: string) => void
  clearSelection: () => void
}
```

#### Bulk Actions Interface
```
Selected: 5 tasks
┌─────────────────────────────────────┐
│ [Set Priority] [Move To] [Delete]   │
│ [Mark Ready] [Archive] [Duplicate]  │
└─────────────────────────────────────┘
```

#### Batch Operations
- **Priority Update**: Set priority for all selected tasks
- **Status Change**: Move multiple tasks between columns
- **Ready State**: Mark multiple tasks as ready/not ready
- **Assignment**: Assign different repo agent or actor to group
- **Archival**: Archive completed tasks in bulk
- **Duplication**: Create variants of selected tasks
- **Tag Operations**: Add/remove tags from multiple tasks

### 3. Command Palette System

#### Universal Command Interface
```
Ctrl+K opens:
┌─────────────────────────────────────┐
│ > [Search commands, tasks, or go to]│
├─────────────────────────────────────┤
│ 🎯 Create new task                  │
│ 📁 Switch to project: MyApp         │
│ 🔍 Filter by: High Priority         │
│ ⚙️  Open project settings          │
│ 📊 Show project analytics          │
│ 🗂️  Archive completed tasks        │
└─────────────────────────────────────┘
```

#### Smart Command Recognition
```typescript
interface CommandPalette {
  // Quick actions
  'new task': () => openTaskCreation()
  'settings': () => openProjectSettings()
  'switch project': () => showProjectSwitcher()

  // Smart search
  'find p1': () => filterByPriority(1)
  'show blocked': () => filterByBlockedTasks()
  'my tasks today': () => filterByDateAndAssignment()

  // Bulk operations
  'select all p5': () => selectTasksByPriority(5)
  'archive done': () => bulkArchiveCompletedTasks()
  'move to doing': () => moveSelectedTasks('doing')
}
```

### 4. Advanced Filtering & Search

#### Quick Filter Bar
```
[All] [P5] [P4] [P3] [P2] [P1] | [Ready] [AI Working] [Blocked] | [This Week] [Overdue]
```

#### Advanced Search Syntax
```bash
# Priority and status filters
priority:5 status:doing
p5 doing                          # Shorthand

# Text search with operators
title:"login bug" OR description:"authentication"
-archived +ready                  # Exclude archived, include ready

# Date and time filters
created:today
updated:last-week
due:tomorrow

# Assignment filters
agent:"Claude Code"
actor:"Backend Developer"
author:ai

# Combination queries
p5 ready created:today agent:"Claude Code"
```

#### Saved Filter Presets
```typescript
interface FilterPreset {
  name: string
  query: string
  shortcut?: string
  icon?: string
}

// Example presets
const defaultPresets = [
  { name: "My P5 Tasks", query: "p5 ready", shortcut: "Ctrl+Shift+5" },
  { name: "Blocked Items", query: "blocked", shortcut: "Ctrl+B" },
  { name: "This Week", query: "created:this-week", shortcut: "Ctrl+W" },
  { name: "AI Working", query: "ai-working", shortcut: "Ctrl+I" }
]
```

### 5. Rapid Task Creation Templates

#### Template Shortcuts
```typescript
interface QuickTemplates {
  '/bug': {
    title: 'Bug: ',
    description: 'Steps to reproduce:\n1. \n\nExpected:\n\nActual:\n',
    priority: 4,
    stage: 'clarify'
  },
  '/feature': {
    title: 'Feature: ',
    description: 'User story:\nAs a [user], I want to [goal] so that [benefit]\n\nAcceptance criteria:\n- ',
    priority: 3,
    stage: 'plan'
  },
  '/doc': {
    title: 'Documentation: ',
    description: 'Document [feature/process] to help [audience]\n\nSections needed:\n- ',
    priority: 2,
    stage: 'clarify'
  }
}
```

#### Smart Duplication
- **Duplicate with Variations**: Copy task but increment title ("Bug: Login 1", "Bug: Login 2")
- **Template Creation**: Convert existing task into reusable template
- **Pattern Recognition**: Suggest templates based on recent task patterns

## UX Implementation

### Visual Feedback System
- **Selection Indicators**: Clear visual highlighting for selected tasks
- **Keyboard Focus**: Visible focus states for keyboard navigation
- **Action Previews**: Show what bulk action will affect before confirming
- **Undo Notifications**: Clear undo options for bulk operations

### Help & Discovery
- **Contextual Hints**: Show relevant shortcuts in tooltips
- **Keyboard Overlay**: Full shortcuts reference (Ctrl+/)
- **Progressive Disclosure**: Introduce advanced features gradually
- **Command Palette Help**: Built-in help and examples

### Performance Optimization
- **Virtualized Lists**: Handle large task lists efficiently
- **Debounced Search**: Smooth real-time filtering
- **Optimistic Updates**: Instant feedback for bulk operations
- **Efficient Selection**: Fast multi-select even with thousands of tasks

## Technical Implementation

### Keyboard Event Handling
```typescript
class KeyboardShortcutManager {
  private shortcuts = new Map<string, ShortcutHandler>()

  registerGlobalShortcuts(shortcuts: GlobalShortcuts): void
  registerContextualShortcuts(context: string, shortcuts: ContextShortcuts): void
  handleKeyboardEvent(event: KeyboardEvent): boolean
  showShortcutHelp(): void
}
```

### Bulk Operations Engine
```typescript
class BulkOperationsManager {
  private selection = new Set<string>()

  selectTasks(taskIds: string[], mode: SelectionMode): void
  executeBulkAction(action: BulkAction, taskIds: string[]): Promise<Result>
  createUndoSnapshot(action: BulkAction): UndoSnapshot
  validateBulkOperation(action: BulkAction, tasks: Task[]): ValidationResult
}
```

### Command Palette System
```typescript
class CommandPaletteEngine {
  private commands = new Map<string, Command>()

  registerCommand(name: string, handler: CommandHandler): void
  search(query: string): CommandResult[]
  executeCommand(command: string, args?: any[]): Promise<void>
  buildSearchIndex(): SearchIndex
}
```

## Success Metrics

### Power User Adoption
- **Keyboard Shortcut Usage**: 60%+ of active users use keyboard shortcuts
- **Bulk Operations**: 40%+ of users perform bulk operations weekly
- **Command Palette**: 50%+ of users discover command palette
- **Advanced Search**: 30%+ of users create custom filters

### Productivity Impact
- **Task Management Speed**: 3x faster task operations for power users
- **Multi-Task Operations**: 80% reduction in time for bulk updates
- **Navigation Efficiency**: 50% faster navigation between projects/tasks
- **Discovery Rate**: Users discover 5+ new productivity features per month

### User Satisfaction
- **Power User NPS**: 9+ Net Promoter Score from experienced users
- **Feature Stickiness**: 90%+ retention of users who adopt shortcuts
- **Learning Curve**: Users become proficient with shortcuts within 1 week

## Implementation Priority

### Phase 1A: Foundation (Week 1)
- Basic keyboard shortcuts for navigation and task operations
- Simple multi-select with visual feedback
- Command palette core infrastructure

### Phase 1B: Power Features (Week 2)
- Bulk operations for common actions
- Advanced search syntax and filtering
- Template system and quick creation

### Phase 1C: Polish (Week 3)
- Keyboard shortcut help system
- Performance optimization for large datasets
- Advanced bulk operations and undo system

This Productivity Shortcuts & Bulk Operations feature transforms Solo Unicorn from a simple task manager into a power-user tool that scales efficiently from small personal projects to complex, large-scale development workflows.
