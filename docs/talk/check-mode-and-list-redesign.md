# Check Mode and List Redesign Analysis

## Original Request

Introduce "check" mode and list with the following requirements:
- Add "check" mode for tasks requiring human verification
- Add "check" column to the left of "done" column
- Remove "loop" column from the right of "done" (integrate loop into todo)
- Execute prompt sends tasks to list="check" mode="check" instead of directly to done
- Human verification with approve/reject functionality using shadcn components
- Rejection sends task back to mode="plan" list="todo" with send-back reason
- Support multiple rejection iterations with effective storage of reasons
- Need naming suggestions for new fields and entities

## Analysis

### Current Workflow Issues
The current 4-column board (Todo → Doing → Done → Loop) has a critical UX gap:
- Tasks go directly from execution to "done" without human verification
- No opportunity for quality control or feedback
- Completed work may not meet expectations but is already marked "done"

### Proposed Workflow Benefits
- **Quality Gate**: Human verification before marking complete
- **Feedback Loop**: Clear rejection path with reasoning
- **Iterative Improvement**: Multiple cycles of improvement based on feedback
- **Accountability**: Human oversight of AI agent work

## Research & Findings

### Workflow State Analysis

**Current States:**
```
Todo (ready) → Doing (clarify/plan/execute) → Done ✓
Loop → Doing (loop) → Loop (infinite cycle)
```

**Proposed States:**
```
Todo (ready/loop) → Doing (clarify/plan/execute) → Check (check) → Done ✓
                                                     ↓ (reject)
                                           Todo (plan) ← rejection reason
```

### Column Layout Evolution

**Before:** 4 columns
```
Todo | Doing | Done | Loop
```

**After:** 4 columns (restructured)
```
Todo | Doing | Check | Done
```

### Loop Integration Strategy
Instead of separate Loop column, integrate into Todo with visual indicators:
- Regular tasks: Standard priority (P1-P5)
- Loop tasks: Special indicator (∞) within Todo column
- Loop tasks have lower pickup priority when regular tasks exist

## Naming Suggestions

### New Fields & Entities

**Task Fields:**
- `checkResult`: "approved" | "rejected" | null
- `rejectionReasons`: Array<{iteration: number, reason: string, timestamp: Date}>
- `checkRequestedAt`: Date when task was sent to check
- `checkedAt`: Date when human made check decision
- `rejectionCount`: number (for UI display and logic)
- `currentRejectionReason`: string (latest rejection reason for easy access)

**Alternative Naming Options:**

**For Check Result:**
- `verificationStatus` vs `checkResult` vs `reviewStatus`
- `humanVerification` vs `qualityCheck` vs `approval`

**For Rejection Storage:**
- `rejectionHistory` vs `rejectionReasons` vs `feedbackHistory`
- `sendBackReasons` vs `revisionRequests` vs `rejectionLog`

**Recommended Names:**
- `checkResult`: Clear and concise
- `rejectionHistory`: More descriptive than "reasons"
- `checkRequestedAt`: Matches existing timestamp patterns

### UI Component Names

**Check Column:**
- "Awaiting Review" vs "Check" vs "Review" vs "Verify"
- **Recommendation**: "Check" (matches mode name, concise)

**Action Buttons:**
- Approve: "Approve" | "Accept" | "Mark Done" | "✓ Complete"
- Reject: "Reject" | "Send Back" | "Request Changes" | "↺ Revise"
- **Recommendation**: "Approve" & "Send Back" (clear actions)

## Solution Options & Rankings

### Option 1: Simple Check Mode (Recommended)
**Approach:**
- Add check column between Doing and Done
- Single approve/reject decision
- Rejection sends back to Todo with plan mode
- Store rejection history as array

**Pros:**
- Simple mental model
- Clear workflow progression
- Minimal UI complexity
- Easy to implement

**Cons:**
- No granular feedback options
- Binary approve/reject only

**Ranking: 1st** - Best balance of simplicity and functionality

### Option 2: Multi-Stage Review
**Approach:**
- Check mode with sub-modes (review-code, review-functionality, review-documentation)
- Granular approval per aspect
- Weighted approval system

**Pros:**
- Detailed feedback capability
- Professional review process
- Comprehensive quality control

**Cons:**
- Complex UX
- Over-engineering for solo developer use case
- Violates "least powerful principle"

**Ranking: 3rd** - Too complex for current needs

### Option 3: Inline Review System
**Approach:**
- No separate check column
- Review UI appears in Done column
- Temporary "pending review" state

**Pros:**
- No additional column needed
- Simpler board layout

**Cons:**
- Confusing to have "done" items that aren't really done
- Poor visual separation of states
- Harder to track review pipeline

**Ranking: 2nd** - Simpler but less clear

## Data Storage Strategy

### Rejection History Structure

**Option A: Array of Objects (Recommended)**
```typescript
interface RejectionEntry {
  iteration: number;      // 1, 2, 3... for tracking cycles
  reason: string;         // Human-provided feedback
  timestamp: Date;        // When rejection occurred
  mode: string;          // What mode task was in when rejected
}

rejectionHistory: RejectionEntry[]
```

**Option B: Simple String Array**
```typescript
rejectionReasons: string[]  // Just the reasons, lose metadata
```

**Option C: Single Current Reason**
```typescript
currentRejectionReason: string | null  // Only keep latest
```

**Recommendation: Option A** - Provides full audit trail while maintaining simplicity

### Database Schema Changes

**New Task Fields:**
```sql
-- Add to existing tasks table
ALTER TABLE tasks ADD COLUMN check_result VARCHAR(20); -- 'approved', 'rejected', null
ALTER TABLE tasks ADD COLUMN rejection_history JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN check_requested_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN checked_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN rejection_count INTEGER DEFAULT 0;
```

## UI/UX Design Considerations

### Check Column Design
- Visual distinction from other columns (different color scheme)
- Clear indication that human action is required
- Count of items awaiting review in column header

### Task Card in Check Mode
- Display execution summary/results
- Clear approve/reject buttons
- Previous rejection history (collapsible)
- Link to view implementation details

### Rejection Flow UX
1. User clicks "Send Back"
2. Modal appears with textarea for feedback reason
3. Optional: Suggest common rejection reasons (checkboxes + custom)
4. Submit sends task back to Todo with plan mode
5. Clear visual indication in Todo that task was rejected

### shadcn Component Selection
- **Modal/Dialog**: For rejection reason input
- **Textarea**: For rejection feedback
- **Button variants**: Primary for approve, secondary for reject
- **Badge**: For showing rejection count
- **Collapsible**: For showing rejection history
- **Alert**: For displaying previous rejection reasons in task cards

## Integration Points

### Agent Prompt Updates
- Execute prompt: Send to check mode instead of done
- Check mode prompt: New prompt for tasks awaiting verification
- Plan mode prompt: Include previous rejection feedback when task is sent back

### MCP Tool Updates
- `task_update`: Support check mode and rejection data
- New fields in task update schema
- Validation for check mode transitions

### WebSocket Events
- New event types for check mode transitions
- Real-time updates when human approves/rejects
- Notification system for tasks awaiting review

## Migration Strategy

### Phase 1: Backend Changes
1. Add new database fields
2. Update task model and validation
3. Update MCP tools to support check mode
4. Update agent prompts

### Phase 2: Frontend Changes
1. Add Check column to board
2. Remove Loop column, integrate into Todo
3. Implement check mode UI components
4. Add approve/reject functionality

### Phase 3: Agent Integration
1. Update agent execution logic
2. Test check mode workflow
3. Update prompt templates
4. Deploy and monitor

## Recommendations

### Primary Recommendations

1. **Implement Simple Check Mode (Option 1)**
   - Clean separation of concerns
   - Intuitive workflow progression
   - Appropriate complexity for solo developer use case

2. **Use Comprehensive Rejection History**
   - Store full audit trail with timestamps and iteration numbers
   - Enables learning and improvement tracking
   - Supports debugging of recurring issues

3. **Integrate Loop into Todo Column**
   - Simplify board layout from 5 to 4 columns
   - Use visual indicators (∞ symbol) to distinguish loop tasks
   - Maintain loop functionality with cleaner UX

4. **Implement Robust Error Handling**
   - Handle edge cases (multiple rapid approvals/rejections)
   - Validate state transitions
   - Prevent data inconsistencies

### UI Component Recommendations

- **Check Column**: Distinct visual styling, urgent color scheme
- **Approval Flow**: Quick approve button, detailed reject modal
- **History Display**: Collapsible rejection history in task drawer
- **Notification**: Clear indication of tasks awaiting review

## Next Steps

1. **Create Technical Specification**
   - Detailed API changes required
   - Database migration scripts
   - Component specifications

2. **Update Agent Prompts**
   - Modify execute prompt to use check mode
   - Create check mode prompt template
   - Update plan mode to handle rejection feedback

3. **Implementation Planning**
   - Break down into development tasks
   - Estimate effort required
   - Plan rollout strategy

4. **User Testing Strategy**
   - Define success metrics for check mode
   - Plan user feedback collection
   - Identify potential UX issues

## Conclusion

The introduction of check mode addresses a critical gap in the current workflow by providing human oversight before task completion. The recommended approach balances functionality with simplicity, maintains the existing mental model while adding necessary quality control.

Key benefits:
- **Quality Assurance**: Human verification prevents suboptimal completions
- **Iterative Improvement**: Feedback loop enables better outcomes
- **Maintained Simplicity**: 4-column board with clear progression
- **Comprehensive Tracking**: Full audit trail of rejections and improvements

This change transforms the workflow from "fire and forget" to "verify and improve," significantly enhancing the value proposition of the AI-assisted development system.