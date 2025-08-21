# Check Mode and List Analysis

## Original Request

Introduce "check" mode and list:

The task can be set to check mode. Check is a new column on the left hand side of done. Also remove the loop column on the right of Done, as loop now is part of todo column. In execute prompt instead of sending the task to list=done, now we should send them to list="check" mode="check" instead. Then it will wait for human to verify the result. There will be button/switch/toggle using shadcn component, for user to click and send to done column. If the user reject, user will provide send-back reason. The task then will be set mode=plan and list=todo again. Note, as the task can be sent back multiple times, we need an effective way to store multiple send back reasons for each iteration.

## Analysis

### Current System State
- **Board Layout**: Currently uses 4 columns: Todo, Doing, Done, Loop
- **Task Flow**: Todo → Doing (clarify → plan → execute) → Done
- **Loop Flow**: Loop → Doing (loop mode) → Loop
- **Database**: Tasks have `list` enum with ["todo", "doing", "done", "loop"] and `mode` enum with ["clarify", "plan", "execute", "loop", "talk"]

### Proposed Changes
1. **New Column**: Add "Check" column between Doing and Done
2. **Remove Loop Column**: Move loop functionality into Todo column
3. **New Flow**: Todo → Doing → Check → Done (with rejection back to Todo)
4. **Multiple Rejections**: Track rejection history for iterative improvements

## Research & Findings

### Industry Verification Patterns
Based on research of existing task management and approval systems, several key patterns emerged:

1. **Sequential Approval Pattern**: Multi-stage verification with defined roles and approval chains
2. **Human-in-the-Loop Workflows**: AI executes → Human verifies → Approve/Reject cycle
3. **Review Column Pattern**: Dedicated review/verification state in Kanban workflows
4. **Conditional Approval Logic**: Multiple approval mechanisms (single, consensus, majority)
5. **Risk-Based Verification**: Different verification levels based on task complexity/risk

### Modern Trends
- **AI-Driven Recommendations**: AI suggests next actions based on review patterns
- **No-Code Workflow Design**: User-customizable approval workflows
- **Automated Status Updates**: Real-time synchronization between review stages
- **Multi-Form Approval**: Complex verification with multiple validation steps

## Data Model Design

### New Fields Required

#### Tasks Table Changes
```typescript
// Add to existing enum
list: text("list", { enum: ["todo", "doing", "check", "done"] })

// Add check mode to existing enum  
mode: text("mode", { enum: ["clarify", "plan", "execute", "check", "loop", "talk"] })

// New field for rejection tracking
rejectionHistory: jsonb("rejection_history").default([])
```

#### Rejection History Structure
```typescript
interface RejectionEntry {
  id: string;
  rejectedAt: timestamp;
  rejectedByUserId: uuid;
  reason: string;
  iteration: number; // Track which iteration this rejection occurred
  previousMode: string; // What mode it was in before rejection
  agentSessionId?: string; // Link to agent session that was rejected
}

interface RejectionHistory {
  entries: RejectionEntry[];
  totalRejections: number;
  currentIteration: number;
}
```

### Suggested Field Names

**Primary Fields:**
- `list` → Add "check" to existing enum
- `mode` → Add "check" to existing enum  
- `rejectionHistory` → New JSONB field

**Related Fields:**
- `checkRequestedAt` → Timestamp when moved to check
- `checkCompletedAt` → Timestamp when approved/rejected
- `lastRejectionReason` → Quick access to most recent rejection
- `iterationCount` → Simple counter for rejection cycles

## UI/UX Implications

### Board Layout Changes

**New 4-Column Layout:**
```
Todo | Doing | Check | Done
```

**Column Behaviors:**
1. **Todo**: Regular cards + Loop cards (indicated by ♻️ icon)
2. **Doing**: Active agent work (clarify → plan → execute)  
3. **Check**: Human verification pending (mode="check")
4. **Done**: Completed and approved cards

### Component Requirements

#### Check Column Components
- **CheckCard**: Display executed work awaiting verification
- **ApprovalActions**: Approve/Reject buttons with shadcn components
- **RejectionModal**: Input form for rejection reason
- **IterationHistory**: Show rejection history in card drawer

#### Suggested shadcn Components
- **Switch/Toggle**: Quick approve/reject toggle
- **Button + Dialog**: Detailed rejection with reason input
- **Alert/Badge**: Show iteration count and status
- **Accordion**: Collapsible rejection history
- **Textarea**: Multi-line rejection reason input

### Card Information Display

**Check Column Cards:**
- Priority and refined title
- "Awaiting Review" status indicator
- Agent that completed the work
- Iteration count badge (if > 1)
- Quick approve/reject actions
- "View Details" button for full review

**Enhanced Card Drawer:**
- Execution results summary
- Rejection history section
- Detailed approve/reject controls
- Link to view agent work (git commits, etc.)

## Solution Options Analysis

### Option 1: Simple Toggle Approach
**Implementation:**
- Single toggle switch: Approve ✓ / Reject ✗
- Simple text input for rejection reason
- Basic iteration counter

**Pros:**
- Minimal UI complexity
- Fast user interaction
- Easy to implement

**Cons:**
- Limited rejection detail
- No approval workflow customization
- Basic history tracking

**Ranking: 3/5** - Good for MVP but limited scalability

### Option 2: Detailed Review Interface
**Implementation:**
- Comprehensive review form with categories
- Rich text rejection reasons with templates
- Detailed execution summary display
- Advanced iteration analytics

**Pros:**
- Comprehensive feedback system
- Rich history tracking
- Professional workflow experience

**Cons:**
- Complex implementation
- Slower user interaction
- Over-engineered for current needs

**Ranking: 2/5** - Too complex for current simplicity principles

### Option 3: Hybrid Approach (Recommended)
**Implementation:**
- Quick actions: Approve button + Reject dropdown
- Rejection modal with predefined reasons + custom input
- Collapsible iteration history
- Smart defaults and progressive disclosure

**Pros:**
- Balances simplicity with functionality
- Scalable for future enhancements
- Follows existing UI patterns
- Maintains speed for common actions

**Cons:**
- Moderate implementation complexity
- Requires careful UX design

**Ranking: 5/5** - Optimal balance for current needs

### Option 4: AI-Assisted Review
**Implementation:**
- AI pre-analyzes execution results
- Suggests approval/rejection with reasoning
- Human can override AI recommendation
- Learning system improves over time

**Pros:**
- Reduces human review burden
- Intelligent recommendations
- Continuous improvement

**Cons:**
- Requires AI integration
- Complex fallback scenarios
- Potential over-automation

**Ranking: 4/5** - Promising but premature for current scope

## Recommendations

### Immediate Implementation (Phase 1)
1. **Database Schema**: Add "check" to list/mode enums, add rejectionHistory JSONB field
2. **Basic UI**: Implement Option 3 (Hybrid Approach) with:
   - Simple approve button (green checkmark)
   - Reject dropdown with common reasons + custom option
   - Basic iteration counter display
3. **Flow Logic**: Execute → Check → (Approve → Done | Reject → Todo with mode=plan)

### Enhanced Features (Phase 2)
1. **Rich History**: Expandable rejection history in card drawer
2. **Templates**: Predefined rejection reason templates
3. **Analytics**: Track rejection patterns and improvement trends
4. **Notifications**: Optional notifications for check requests

### Future Considerations (Phase 3)
1. **AI Integration**: Smart review suggestions based on execution analysis
2. **Conditional Flows**: Different approval requirements based on task complexity
3. **Multi-Reviewer**: Optional multiple approver workflows for critical tasks
4. **Integration**: Link to external tools (git diffs, test results, etc.)

## Implementation Strategy

### Database Migration
```sql
-- Add new enum values
ALTER TYPE task_list_enum ADD VALUE 'check';
ALTER TYPE task_mode_enum ADD VALUE 'check';

-- Add rejection history field
ALTER TABLE tasks ADD COLUMN rejection_history JSONB DEFAULT '[]';
```

### Agent Prompt Updates
- Update execute mode prompt to send completed tasks to list="check" mode="check"
- Add instructions for handling rejection feedback in plan mode
- Include rejection history context in subsequent planning

### UI Component Hierarchy
```
CheckColumn
├── CheckCard (displays awaiting review tasks)
├── ApprovalActions (approve/reject controls)
├── RejectionDialog (reason input modal)
└── IterationBadge (shows rejection count)
```

## Next Steps

1. **Finalize Data Model**: Confirm JSONB structure for rejection history
2. **Create Database Migration**: Implement schema changes
3. **Update Agent Prompts**: Modify execute mode to use check workflow
4. **Build UI Components**: Create check column and approval interface
5. **Update MCP Tools**: Ensure task_update supports new check mode
6. **Testing**: Validate end-to-end check → approve/reject flows
7. **Documentation**: Update user guides and API documentation

## Conclusion

The check mode and list feature represents a natural evolution of the Solo Unicorn workflow, introducing human oversight without sacrificing the system's core simplicity. The hybrid approach balances immediate functionality needs with future scalability, following established UX patterns while maintaining the project's "least powerful principle" philosophy.

The proposed implementation provides:
- **Quality Control**: Human verification of AI work before completion
- **Iterative Improvement**: Rejection feedback drives better subsequent attempts  
- **Audit Trail**: Complete history of review decisions and reasoning
- **Workflow Flexibility**: Adaptable to different review requirements

This enhancement transforms Solo Unicorn from a pure automation system to a collaborative human-AI workflow platform while preserving its essential simplicity and focus.