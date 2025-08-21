# Introduce "Check" Mode and List - Analysis and Recommendations

## Original Request

Introduce "check" mode and list functionality:
- Add "check" mode for tasks
- Create new "check" column (left of Done column)
- Remove "loop" column (integrate loop functionality into Todo)
- Tasks from execute mode go to check (not directly to done)
- Human verification required before moving to done
- Rejection capability with send-back reasons
- Support multiple iterations of send-back reasons
- UI components using shadcn for verification actions

## Analysis

### Core Problem
The current workflow sends completed tasks directly to "Done" without human verification. This creates a gap in quality control where:
1. Agents may complete tasks incorrectly
2. No human validation step before marking complete
3. No feedback mechanism for improving agent work
4. Limited iteration capability for refinement

### Key Requirements Analysis

**Workflow Changes:**
- Current: Todo → Doing → Done (+ Loop column)
- Proposed: Todo (includes loop) → Doing → Check → Done

**New Functionality Needed:**
1. Check mode/status for tasks
2. Check column in UI
3. Human verification interface
4. Rejection workflow with reasons
5. Multi-iteration send-back tracking
6. Loop integration into Todo column

**Data Structure Considerations:**
- Need to store verification status
- Track send-back reasons across iterations
- Maintain workflow state transitions
- Historical tracking of iterations

## Research & Findings

### Current System Analysis

**Existing Task States:**
- `list`: "todo" | "doing" | "done" | "loop"
- `mode`: "clarify" | "plan" | "execute" | "loop"

**Current Workflow Logic:**
1. Agent picks up task from todo/loop
2. Progresses through clarify → plan → execute
3. Moves directly to done upon completion

### Industry Patterns

**Quality Gates:**
- Code review systems (GitHub PRs)
- CI/CD pipelines with manual approvals
- Content moderation workflows
- QA testing phases

**Feedback Mechanisms:**
- Pull request reviews with change requests
- Issue tracking with iteration comments
- Approval workflows with rejection reasons

## Solution Options

### Option 1: Simple Check Mode (Recommended)
**Approach**: Add check as new mode and list state

**Pros:**
- Minimal disruption to existing system
- Clear separation of concerns
- Simple state transitions

**Cons:**
- Adds complexity to state machine
- Requires UI changes

**Implementation Concepts:**
- Add "check" to list enum
- Add "check" to mode enum  
- Update workflow logic
- Add verification UI

### Option 2: Status Flag Approach
**Approach**: Keep existing states, add verification status flag

**Pros:**
- No major workflow changes
- Simpler state transitions

**Cons:**
- Less clear workflow visualization
- Mixing concerns in single status

### Option 3: Nested Workflow States
**Approach**: Create sub-states within done status

**Pros:**
- Maintains existing workflow
- Extensible for future sub-states

**Cons:**
- Complex state management
- Harder to visualize in UI

## Recommended Solution Architecture

### Data Model Changes

**New Fields Needed:**
```
Task Enhancement:
- verificationStatus: "pending" | "approved" | "rejected"
- sendBackReasons: Array<SendBackIteration>
- currentIteration: number
```

**SendBackIteration Structure:**
```
SendBackIteration:
- iterationNumber: number
- reason: string
- rejectedAt: timestamp
- rejectedBy: userId
- previousMode: string
- previousList: string
```

### Workflow State Machine

**Enhanced Task States:**
- `list`: "todo" | "doing" | "check" | "done"
- `mode`: "clarify" | "plan" | "execute" | "check"

**State Transitions:**
1. todo/clarify → todo/plan → doing/execute → check/check
2. check/check → done (approved)
3. check/check → todo/plan (rejected, with reason)

### UI/UX Design Recommendations

**Column Layout:**
- Todo (includes loop tasks with ∞ indicator)
- Doing 
- Check (new)
- Done

**Check Column Features:**
- Verification pending indicator
- Preview of completed work
- Approve/Reject buttons (shadcn Button components)
- Send-back reason form (shadcn Textarea + Dialog)

**Loop Integration:**
- Loop tasks remain in Todo column
- Visual distinction (∞ symbol, different color)
- Special handling in agent pickup logic

### Field and Entity Naming Suggestions

**Task Fields:**
- `verificationStatus` or `checkStatus`
- `sendBackHistory` or `rejectionHistory` 
- `currentIteration` or `iterationCount`
- `lastRejectedAt`
- `lastRejectedReason`

**New Enums:**
- `VerificationStatus`: "pending" | "approved" | "rejected"
- `TaskList`: "todo" | "doing" | "check" | "done"

**Database Tables/Models:**
- `TaskSendBack` or `TaskRejection`
- `VerificationHistory` or `TaskIteration`

## Implementation Considerations

### Technical Challenges

**State Management:**
- Ensure atomic state transitions
- Handle concurrent modifications
- Maintain data consistency

**UI Complexity:**
- Responsive design for 4 columns
- Mobile optimization
- Clear visual feedback

**Agent Integration:**
- Update agent prompts to use check mode
- Handle state transition logic
- MCP tool updates

### Migration Strategy

**Phase 1: Backend Changes**
- Add new database fields
- Update state enums
- Modify transition logic

**Phase 2: Agent Updates**
- Update execute prompt logic
- Add check mode handling
- Test agent workflows

**Phase 3: UI Implementation**
- Add check column
- Implement verification controls
- Update drag/drop logic

**Phase 4: Loop Integration**
- Remove loop column
- Integrate into todo column
- Update loop task styling

## Recommendations

### Primary Recommendation: Option 1 (Simple Check Mode)

**Rationale:**
1. **Clear Separation**: Check mode provides clear quality gate
2. **User Control**: Human verification ensures quality
3. **Iterative Improvement**: Send-back mechanism enables refinement
4. **Minimal Disruption**: Builds on existing patterns

**Key Features:**
- Check column between Doing and Done
- Approve/Reject actions with shadcn components
- Send-back history tracking
- Loop integration into Todo column

### UI Component Recommendations

**Verification Interface:**
- `CheckCard` component showing task summary
- `VerificationActions` with approve/reject buttons
- `SendBackDialog` for rejection reasons
- `IterationHistory` showing previous feedback

**Shadcn Components to Use:**
- `Button` for approve/reject actions
- `Dialog` for send-back reason input
- `Textarea` for detailed feedback
- `Badge` for iteration indicators
- `Alert` for status messages

## Next Steps

### Immediate Actions
1. **Design Review**: Validate UI/UX mockups with stakeholders
2. **Database Schema**: Finalize data model changes
3. **API Design**: Define endpoints for verification workflow
4. **Agent Prompt Updates**: Modify execute mode logic

### Implementation Phases
1. **Backend Foundation** (Week 1): Database and API changes
2. **Agent Integration** (Week 2): Update prompts and MCP tools  
3. **UI Implementation** (Week 3): Check column and verification controls
4. **Loop Integration** (Week 4): Remove loop column, integrate styling
5. **Testing & Polish** (Week 5): End-to-end testing and refinement

### Success Metrics
- Reduced task completion errors
- Improved human satisfaction with agent work
- Clear feedback loop for agent improvement
- Seamless workflow transitions

## Conclusion

The introduction of check mode and list provides essential quality control in the agent workflow. The recommended approach balances simplicity with functionality, ensuring human oversight without disrupting the core automation benefits.

The solution maintains the project's principles of UX obsession and least powerful principle while adding necessary verification capabilities. The iterative feedback mechanism will improve both agent performance and human confidence in the system.

Key success factors:
1. Clear visual distinction of check column
2. Intuitive verification interface
3. Comprehensive send-back tracking
4. Seamless loop integration into todo column
5. Smooth state transitions and error handling

This enhancement transforms Solo Unicorn from a fully automated system to a human-supervised automation platform, providing the best of both worlds.