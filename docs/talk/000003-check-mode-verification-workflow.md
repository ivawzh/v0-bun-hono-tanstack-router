# Check Mode and Verification Workflow Implementation

**Executive Summary**: Transform agent-to-done workflow into agent-to-human-verification by introducing "check" mode/column, enabling quality gates and iterative feedback loops.

## Original Task
- **Title**: Introduce "check" mode and list
- **Description**: Introduce "check" mode and list. The task can be set to check mode. Check is a new column on the left hand side of done. Also remove the loop column on the right of Done, as loop now is part of todo column. In execute prompt instead of sending the task to list=done, now we should send them to list="check" mode=check instead. Then it will wait for human to verify the result. There will be button/switch/toggle whatever best fit and using shadcn component, for user to click and send to done column. If the user reject, user will provide send-back reason. the task then will be set mode=plan and list=todo again. Note, as the task can be sent back multiple times so that we need to send about effective way to store multiple send back reasons for each iteration. Also suggest list of names for these new fields and entities.

## Analysis

### First Principles: Why Verification Matters

This addresses a fundamental trust gap in AI-human collaboration. Like code review in software development, we need human oversight before considering work "complete." The core insight is that automation without verification creates false confidence - tasks appear done but may not meet human expectations.

**Essential Problems Being Solved:**
1. **Quality Control**: Agents may complete tasks incorrectly or incompletely
2. **Learning Loop**: No feedback mechanism for agents to improve
3. **Human Confidence**: Users lose trust when work bypasses verification
4. **Iteration Capability**: No way to refine work through multiple cycles

### Current State vs. Desired State

**Current Workflow:**
```
Todo → Doing (clarify → plan → execute) → Done
     ↖ Loop ↗
```

**Target Workflow:**
```
Todo (including loop tasks) → Doing → Check → Done
                                        ↓
                                 (reject) → back to Todo/plan
```

### Core Design Principles

1. **Verification as Default**: All agent work must pass through human review
2. **Iterative Refinement**: Support multiple send-back cycles
3. **Clear Feedback**: Each rejection needs actionable reasoning
4. **Minimal Friction**: Approval should be one-click when work is good
5. **History Preservation**: Track all iterations for learning

## Options Analysis

### Option A: List + Mode Approach (Recommended)
**Implementation**: `list: "check", mode: "check"`

**Strengths:**
- Clear state representation
- Follows existing patterns
- Easy to visualize in UI
- Agent logic remains simple

**Weaknesses:**
- Adds complexity to state machine
- Requires UI restructure

**Ranking**: 🥇 **9/10** - Best balance of clarity and implementation

### Option B: Status Flag Approach
**Implementation**: Keep existing states, add `verificationStatus` field

**Strengths:**
- Minimal state changes
- No workflow disruption
- Simple to implement

**Weaknesses:**
- Hidden complexity in UI
- Less clear workflow visualization
- Mixing concerns

**Ranking**: 🥈 **7/10** - Pragmatic but less elegant

### Option C: Sub-States Approach
**Implementation**: `list: "done", mode: "pending_verification"`

**Strengths:**
- Maintains column structure
- Extensible pattern

**Weaknesses:**
- Confusing semantics (not actually "done")
- Complex state transitions
- Poor UX visualization

**Ranking**: 🥉 **5/10** - Overly complex for the benefit

## Recommended Architecture

### Data Model

**New Task Fields:**
```typescript
interface Task {
  // Existing fields...
  
  // Verification workflow
  verificationStatus: 'pending' | 'approved' | 'rejected'
  checkHistory: CheckIteration[]
  currentIteration: number
}

interface CheckIteration {
  iterationNumber: number
  submittedAt: timestamp
  status: 'pending' | 'approved' | 'rejected'
  
  // Rejection details (when status === 'rejected')
  rejectionReason?: string
  rejectedAt?: timestamp
  rejectedBy?: string
  
  // Approval details (when status === 'approved')
  approvedAt?: timestamp
  approvedBy?: string
}
```

### State Machine Updates

**Enhanced Enums:**
- `list`: "todo" | "doing" | "check" | "done"  
- `mode`: "clarify" | "plan" | "execute" | "check"

**State Transitions:**
1. `todo/clarify` → `doing/plan` → `doing/execute` → `check/check`
2. `check/check` → `done/null` (approved)
3. `check/check` → `todo/plan` (rejected with reason)

**Loop Tasks:**
- Remain in `todo` column with special styling
- When completed: `check/check` → `todo/loop` (not `done`)

### UI/UX Implementation

**Column Layout:**
```
┌─────────┬─────────┬─────────┬─────────┐
│  Todo   │  Doing  │  Check  │  Done   │
│ (+ Loop)│         │   ⏳    │   ✅    │
└─────────┴─────────┴─────────┴─────────┘
```

**Check Column Components:**
- **CheckCard**: Shows task summary and completion preview
- **VerificationActions**: Approve/Reject buttons
- **SendBackDialog**: Rejection reason form
- **IterationBadge**: Shows current iteration count
- **CheckHistory**: Expandable history of all iterations

**Shadcn Components:**
- `Button` (variant="default" for approve, variant="destructive" for reject)
- `Dialog` + `DialogContent` for rejection form
- `Textarea` for detailed feedback
- `Badge` for iteration indicators
- `Alert` for status messages
- `Collapsible` for history expansion

### Field Naming Conventions

**Task Fields:**
- `verificationStatus` - Current verification state
- `checkHistory` - Array of all verification attempts
- `currentIteration` - Counter for tracking cycles
- `lastSubmittedAt` - Timestamp of latest agent completion
- `lastCheckedBy` - User who performed last verification

**Iteration Fields:**
- `iterationNumber` - Sequential counter (1, 2, 3...)
- `rejectionReason` - Human feedback text
- `rejectedAt` / `approvedAt` - Action timestamps
- `actionBy` - User ID who took action

**Database Entities:**
- `TaskCheckHistory` - Separate table for iteration tracking
- `VerificationAction` - Event log for all verification activities

## Implementation Strategy

### Phase 1: Backend Foundation
1. **Database Schema**: Add verification fields to tasks table
2. **State Enums**: Update list/mode enums
3. **API Endpoints**: Create verification endpoints
4. **State Machine**: Update transition logic

### Phase 2: Agent Integration  
1. **Execute Prompt**: Change target from `done` to `check`
2. **MCP Tools**: Update `task_update` to handle check mode
3. **Loop Logic**: Update loop task completion flow

### Phase 3: UI Implementation
1. **Check Column**: Add new column to board
2. **Verification Controls**: Implement approve/reject interface
3. **History Tracking**: Show iteration history
4. **Responsive Design**: Ensure 4-column layout works on mobile

### Phase 4: Loop Migration
1. **Visual Integration**: Move loop tasks into Todo column
2. **Styling Updates**: Special indicators for loop tasks
3. **Column Removal**: Remove separate Loop column
4. **Agent Logic**: Update loop task selection

## Business Perspective

**Value Proposition:**
- **Quality Assurance**: Human oversight prevents low-quality completions
- **Trust Building**: Users gain confidence in agent capabilities
- **Learning Loop**: Feedback improves future agent performance
- **Risk Mitigation**: Catches errors before they impact production

**User Experience Benefits:**
- **Control**: Users maintain final authority over completions
- **Transparency**: Clear visibility into agent work quality
- **Iteration**: Ability to refine work through feedback cycles
- **Peace of Mind**: Nothing bypasses human review

## Technical Considerations

### Performance Impact
- **Minimal**: One additional column, standard CRUD operations
- **Database**: Simple fields, no complex queries
- **UI**: Standard React components, no heavy operations

### Migration Complexity
- **Low Risk**: Additive changes, no breaking modifications
- **Backward Compatible**: Existing tasks continue normal flow
- **Gradual Rollout**: Can enable per-project or per-user

### Edge Cases
- **Concurrent Verification**: Handle multiple users reviewing same task
- **Agent Failures**: What happens if agent can't handle rejection
- **Loop Task Completions**: Ensure loop tasks return to Todo, not Done
- **Mobile UX**: 4 columns may need accordion/tab interface

## Success Metrics

**Quality Metrics:**
- Rejection rate (expect 10-20% initially, decreasing over time)
- Iteration cycles per task (target: 1.2 average)
- Time from check to approval (target: <5 minutes)

**User Satisfaction:**
- Confidence in completed work (survey)
- Reduction in manual rework
- Increased agent adoption

**System Health:**
- No performance degradation
- Smooth state transitions
- Error-free verification flow

## Conclusion

The check mode introduces essential quality control while maintaining Solo Unicorn's core automation benefits. By requiring human verification, we transform from "blind automation" to "supervised automation" - the sweet spot for AI-human collaboration.

**Key Success Factors:**
1. **One-click approval** for good work (minimal friction)
2. **Clear rejection feedback** for improvement cycles
3. **Visual clarity** in 4-column board layout
4. **Mobile optimization** for check actions
5. **Seamless loop integration** into Todo column

This enhancement addresses the #1 concern with AI agents: "How do I know the work is actually done correctly?" The answer becomes: "Because you verified it yourself."

The verification workflow creates a feedback loop that will improve agent performance over time while giving users confidence that nothing slips through without their approval. This transforms Solo Unicorn from a task executor into a quality-controlled task orchestration platform.