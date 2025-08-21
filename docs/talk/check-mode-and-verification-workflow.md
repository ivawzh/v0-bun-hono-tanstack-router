# Check Mode and Verification Workflow

## Original Request

Introduce "check" mode and list to add human verification before task completion:

- Add "check" column between Doing and Done (remove Loop column from right)
- Move Loop functionality into Todo column  
- Tasks complete to "check" instead of "done"
- Human can approve (→ Done) or reject with reason (→ Todo, mode=plan)
- Support multiple rejection iterations with stored reasons

## Analysis

### Current Workflow
```
Todo → Doing (clarify → plan → execute) → Done
Loop → Doing (loop) → Loop
```

### Proposed Workflow
```
Todo (including Loop cards) → Doing → Check → Done
                                      ↓ (reject)
                                    Todo (mode=plan)
```

### Key Changes Required
1. **UI Layout**: 4 columns → 4 columns (Todo, Doing, Check, Done)
2. **Loop Integration**: Move Loop cards into Todo with special indicators
3. **Check State**: New intermediate state requiring human action
4. **Rejection Flow**: Feedback collection and iteration tracking
5. **Data Model**: New fields for check status and rejection history

## Research & Findings

### Current Data Model Context
Based on the existing schema, cards have:
- `mode`: clarify | plan | execute | loop
- `list`: todo | doing | done | loop
- `plan`: jsonb field for storing planning results
- Status tracking via `agentSessionStatus`

### User Experience Considerations
1. **Verification UX**: Quick approve/reject actions are critical
2. **Feedback Quality**: Structured rejection reasons help agents improve
3. **Iteration Tracking**: History helps identify recurring issues
4. **Loop Card Clarity**: Visual distinction needed in Todo column
5. **Mobile Experience**: Touch-friendly approve/reject interactions

### Technical Implications
1. **Agent Prompt Updates**: Execute prompt must target check instead of done
2. **MCP Tools**: Update task_update tool to handle check mode
3. **WebSocket Events**: New events for check state changes
4. **Database Migration**: New fields and mode/list enum updates

## Solution Options

### Option 1: Simple Check Mode (Recommended)
**Approach**: Minimal viable implementation with basic approval/rejection

**Data Model**:
```typescript
// New enum values
mode: 'clarify' | 'plan' | 'execute' | 'loop' | 'check'
list: 'todo' | 'doing' | 'done' | 'check'

// New fields
checkStatus: 'pending' | 'approved' | 'rejected' | null
currentRejectionReason: string | null
rejectionHistory: Array<{
  iteration: number,
  reason: string,
  rejectedAt: timestamp,
  rejectedBy: userId
}>
iterationCount: number // tracks plan → execute → check cycles
```

**UI Components**:
- Check column with pending cards
- Quick approve button (✓)
- Reject modal with reason input
- Rejection history accordion in card drawer

**Pros**: Simple, clear workflow, easy to implement
**Cons**: Basic features only

### Option 2: Enhanced Check Mode
**Approach**: Rich verification with detailed feedback and review criteria

**Additional Features**:
```typescript
checkCriteria: Array<{
  id: string,
  description: string,
  passed: boolean | null,
  notes: string
}>
reviewMetadata: {
  timeInCheck: duration,
  reviewStartedAt: timestamp,
  reviewCompletedAt: timestamp,
  reviewDuration: duration
}
```

**UI Enhancements**:
- Checklist-based review interface
- Detailed feedback forms
- Review analytics and timing
- Batch approve/reject actions

**Pros**: Comprehensive review process, detailed feedback
**Cons**: More complex, potential UX friction

### Option 3: Configurable Check Mode
**Approach**: Project-level settings for check behavior

**Configuration**:
```typescript
projectSettings: {
  checkMode: 'disabled' | 'optional' | 'required',
  autoApproveAfter: duration | null,
  requiredReviewers: number,
  checkCriteria: Array<CheckCriterion>
}
```

**Features**:
- Per-project check requirements
- Auto-approval timeouts
- Multiple reviewer support
- Custom review criteria

**Pros**: Flexible, scales with team needs
**Cons**: Complex configuration, over-engineering for solo use

## Recommendations

### Recommended Solution: Option 1 (Simple Check Mode)
Given the "least powerful principle" and solo developer focus, Option 1 provides the right balance of functionality without complexity.

### Field Naming Suggestions

**Core Fields**:
- `checkStatus`: 'pending' | 'approved' | 'rejected'
- `rejectionReason`: Current rejection feedback
- `rejectionHistory`: Historical rejection data
- `iterationCount`: Number of plan→execute→check cycles

**Alternative Names**:
- `verificationStatus` / `reviewStatus` (instead of checkStatus)
- `feedback` / `returnReason` (instead of rejectionReason)
- `reviewHistory` / `feedbackHistory` (instead of rejectionHistory)
- `cycleCount` / `revisionCount` (instead of iterationCount)

### UI Component Names
- `CheckColumn` - The verification column component
- `CheckCard` - Card display in check state
- `ApprovalActions` - Approve/reject button group
- `RejectionModal` - Feedback collection dialog
- `IterationHistory` - Rejection history display

### Database Schema Updates

**New Enum Values**:
```sql
ALTER TYPE task_mode ADD VALUE 'check';
ALTER TYPE task_list ADD VALUE 'check';
```

**New Columns**:
```sql
ALTER TABLE cards ADD COLUMN check_status TEXT;
ALTER TABLE cards ADD COLUMN rejection_reason TEXT;
ALTER TABLE cards ADD COLUMN rejection_history JSONB DEFAULT '[]';
ALTER TABLE cards ADD COLUMN iteration_count INTEGER DEFAULT 0;
```

## Implementation Strategy

### Phase 1: Data Model Updates
1. Database migration for new fields
2. Update TypeScript types and validation schemas
3. Update MCP tool interfaces

### Phase 2: Agent Prompt Updates
1. Modify execute prompt to target check list
2. Update task_update MCP tool for check mode
3. Add check mode handling to agent logic

### Phase 3: UI Implementation
1. Add Check column to board layout
2. Implement approval/rejection actions
3. Update card drawer with iteration history
4. Move Loop cards into Todo column with visual indicators

### Phase 4: Loop Integration
1. Update Loop card display in Todo column
2. Modify drag/drop logic for new layout
3. Update Loop card cycling logic

## Next Steps

1. **Database Design**: Finalize schema changes and create migration
2. **Agent Prompts**: Update execute prompt to use check workflow
3. **UI Mockups**: Design check column and approval/rejection interface
4. **MCP Updates**: Extend task_update tool for check mode support
5. **Testing Strategy**: Plan verification workflow testing scenarios

## Conclusion

The check mode introduces a valuable human verification step while maintaining Solo Unicorn's simplicity. The recommended simple approach balances functionality with usability, providing essential verification features without over-engineering. The key success factors are:

1. **Minimal Friction**: Quick approve actions for successful completions
2. **Useful Feedback**: Structured rejection reasons that help agents improve
3. **Clear Iteration**: Visible history of revision cycles
4. **Integrated Loop**: Seamless Loop card integration in Todo column

This enhancement transforms the workflow from fully automated completion to human-verified quality assurance, significantly improving output reliability while preserving the solo developer focus.