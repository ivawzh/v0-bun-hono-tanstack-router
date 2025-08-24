# Git Worktree Integration in Solo Unicorn

**Executive Summary**: Integrate git worktree to enable true concurrent AI development sessions per repository without conflicts, revolutionizing solo development productivity.

## Task Context

**Original Title**: git worktree in solo unicorn  
**Original Description**: i have no experience nor knowdge about git worktree before i start building solo unicorn. That drove me made some decisions on architecture of repo and repo concurrency. Can you please brainstorm how we can use git worktree in solo unicorn framework. compare to the current architecture setup limitations especailly on concurrent ai dev on the same repo. Please reimagine. tell me what benefits will be. How the UX will be. Also teach me what is git worktree please.

## Analysis: Understanding Git Worktree

### What is Git Worktree?

Git worktree allows multiple working directories (worktrees) to be attached to a single repository. Each worktree can have different branches checked out simultaneously.

**Core Concept:**
- Single `.git` repository shared across multiple working directories
- Each worktree has its own checked out branch
- Files, index, and refs are separate per worktree
- History and commits are shared in the central `.git`

**Example Structure:**
```
/home/user/repos/myapp/           # Main worktree (master branch)
/home/user/repos/myapp-feature1/  # Worktree 1 (feature1 branch) 
/home/user/repos/myapp-feature2/  # Worktree 2 (feature2 branch)
```

### Key Properties:
1. **Shared History**: All worktrees share the same git history
2. **Isolated Working State**: Each worktree has independent file states
3. **Branch Isolation**: Same branch cannot be checked out in multiple worktrees
4. **Atomic Operations**: Commits, pushes, pulls work normally per worktree

## Current Solo Unicorn Architecture Limitations

### Existing Concurrency Constraints:
1. **Single Active Session**: Only one Claude Code session per repo to avoid conflicts
2. **Sequential Processing**: Tasks wait in queue for repo availability
3. **Conflict Risk**: Git merge conflicts if multiple sessions worked simultaneously
4. **Resource Waste**: AI agents sit idle while repo is occupied

### Current Architecture Analysis:
- `maxConcurrencyLimit` per repo (typically 1)
- `agentSessionStatus` tracking (INACTIVE/PUSHING/ACTIVE)
- Session coordination via file registry and hooks
- **Result**: Artificial bottleneck limiting AI productivity

## Git Worktree Integration Vision

### Core Architecture Transformation

**From**: 1 Repo → 1 Working Directory → 1 Active Session  
**To**: 1 Repo → N Worktrees → N Concurrent Sessions

### Implementation Strategy:

#### 1. Dynamic Worktree Management
```typescript
interface WorktreeManager {
  createTaskWorktree(taskId: string, baseBranch?: string): Promise<string>
  deleteTaskWorktree(taskId: string): Promise<void>
  getAvailableWorktree(repoId: string): Promise<string | null>
  listActiveWorktrees(repoId: string): Promise<WorktreeInfo[]>
}
```

#### 2. Task-Specific Worktrees
- Each task gets dedicated worktree: `/repo-path/.solo-unicorn/worktrees/task-{taskId}/`
- Auto-created branch: `solo-unicorn/task-{taskId}`
- Isolated development environment per AI session

#### 3. Merge Strategy
- **Feature Branch Workflow**: Each task develops on separate branch
- **Auto-merge**: Successful tasks auto-merge to main via GitHub/GitLab API
- **Conflict Resolution**: Failed merges move to human review queue

## Benefits Analysis

### 1. Productivity Multiplication
- **Before**: 1 task per repo sequentially
- **After**: N concurrent tasks per repo (limited by system resources, not git)
- **Impact**: 3-5x faster project completion

### 2. Resource Optimization
- AI agents work in parallel instead of queuing
- CPU/Memory becomes limiting factor, not git conflicts
- Better utilization of Claude Code rate limits across tasks

### 3. Risk Isolation
- Each task contained in separate worktree
- Failed experiments don't affect other work
- Easy rollback per task without affecting others

### 4. Simplified Conflict Management
- Conflicts only occur during merge, not during development
- Human review focused on logical conflicts, not git mechanics
- Automatic conflict detection before human handoff

## User Experience Transformation

### Current UX Pain Points:
- Tasks wait indefinitely for repo availability
- No visibility into why tasks are queued
- Single point of failure per repository

### New UX with Worktrees:

#### 1. Board View Enhancement
```
Todo: [Ready tasks immediately picked up]
Doing: [Multiple tasks executing concurrently per repo]
  ├─ Task A (repo/worktree-1) ●●○ Execute
  ├─ Task B (repo/worktree-2) ●○○ Plan  
  └─ Task C (repo/worktree-3) ●●● Execute
Merging: [Tasks awaiting merge to main]
Done: [Completed & merged]
```

#### 2. Real-time Concurrency Indicators
- Live count: "3/5 concurrent tasks running"
- Worktree status per task
- Merge queue visibility

#### 3. Conflict Resolution Flow
- Auto-merge successful tasks
- Queue conflicted tasks for human review
- Side-by-side diff UI for conflict resolution
- One-click approval for clean merges

### Mobile Experience:
- Swipe-to-approve merge conflicts
- Push notifications for merge failures
- Voice input for conflict resolution decisions

## Technical Implementation

### 1. Worktree Lifecycle
```typescript
class TaskWorktreeManager {
  async createForTask(task: Task): Promise<string> {
    const worktreePath = `${task.repo.path}/.solo-unicorn/worktrees/task-${task.id}`
    const branchName = `solo-unicorn/task-${task.id}`
    
    // Create worktree with new branch
    await git.worktree.add(worktreePath, branchName, { create: true })
    
    return worktreePath
  }

  async mergeToMain(taskId: string): Promise<MergeResult> {
    // Attempt auto-merge
    // If conflicts, move to human review
    // If success, cleanup worktree
  }
}
```

### 2. Claude Code Integration
- Spawn Claude Code in worktree directory instead of main repo
- Environment variables include worktree path
- Session hooks track worktree-specific progress

### 3. Database Schema Evolution
```typescript
// Add to Card table
interface Card {
  worktreePath?: string
  branchName?: string
  mergeStatus: 'pending' | 'merged' | 'conflicts' | 'failed'
}

// Add to Repository table  
interface Repository {
  maxWorktrees: number // Replace maxConcurrencyLimit
  activeWorktrees: number
}
```

## Options Analysis

### Option 1: Full Worktree Integration (Recommended)
**Pros**: Maximum concurrency, clean isolation, mature git feature
**Cons**: Learning curve, additional disk space per task
**Ranking**: 🥇 Best for productivity gains

### Option 2: Branch-per-Task (Without Worktree)
**Pros**: Simpler implementation, familiar git workflow
**Cons**: Still requires sequential execution, merge conflicts
**Ranking**: 🥈 Incremental improvement

### Option 3: Fork-based Concurrency
**Pros**: Complete isolation, works with any git host
**Cons**: Complex GitHub API integration, repository sprawl
**Ranking**: 🥉 Over-engineered

### Option 4: Status Quo (Current)
**Pros**: Simple, working, no changes needed
**Cons**: Severe productivity bottleneck, poor resource utilization
**Ranking**: ❌ Blocks scaling

## Architecture Considerations

### Business Impact:
- **Customer Value**: 3-5x faster development cycles
- **Competitive Advantage**: Only AI orchestrator with true concurrency
- **User Retention**: Eliminates primary frustration (waiting for tasks)

### UX Perspective:
- **Friction Reduction**: No more task queuing
- **Magic Factor**: Multiple AI agents working simultaneously
- **Reactive UI**: Live progress on concurrent tasks

### Technical Perspective:
- **Scalability**: Limited by system resources, not git
- **Reliability**: Isolated failures don't cascade
- **Maintainability**: Clear separation of concerns per task

## Implementation Roadmap

### Phase 1: Core Worktree Engine
1. Worktree creation/deletion utilities
2. Task-to-worktree mapping
3. Branch naming conventions

### Phase 2: Claude Code Integration  
1. Modify agent spawning for worktree paths
2. Update session hooks for worktree tracking
3. Environment variable injection

### Phase 3: Merge Management
1. Auto-merge pipeline for clean tasks
2. Conflict detection and human queue
3. UI for merge conflict resolution

### Phase 4: UX Enhancement
1. Real-time concurrency indicators
2. Merge queue visualization
3. Mobile conflict resolution

## Conclusion

Git worktree integration represents a paradigm shift from artificial sequential constraints to natural concurrent development. This transformation directly addresses Solo Unicorn's core value proposition: maximizing AI agent productivity.

**Key Insight**: Current architecture treats git conflicts as inevitable. Worktrees make them impossible during development and manageable at merge time.

**Recommendation**: Implement full worktree integration as the foundation for Solo Unicorn's next evolution - from task management to true concurrent AI orchestration platform.