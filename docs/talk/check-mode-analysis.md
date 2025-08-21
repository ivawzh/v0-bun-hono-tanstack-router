# Check Mode and List Feature Analysis

## Original Request
Introduce "check" mode and list feature to Solo Unicorn's task management workflow. The feature includes:
- New "check" column positioned left of Done column
- Remove Loop column from right of Done, integrate Loop functionality into Todo
- Execute mode sends tasks to `list="check"` with `mode="check"` instead of directly to Done
- Human verification process with approve/reject actions
- Support for multiple send-back iterations with reasons
- Field name and entity suggestions

## Analysis

### Current System Architecture

**Current Workflow:**
- Todo → Doing → Done (regular cards)
- Loop → Doing → Loop (repeatable cards) 
- Doing has 3 modes: clarify → plan → execute

**Current Database Schema:**
- `list` field: enum ["todo", "doing", "done", "loop"]
- `mode` field: enum ["clarify", "plan", "execute", "loop", "talk"]
- Tasks have `refinedTitle`, `refinedDescription`, `plan` (jsonb), `rawTitle`, `rawDescription`
- Agent session management with `agentSessionStatus`

**Current Execute Prompt Flow:**
```
1. START: task_update(list="doing", mode="execute", agentSessionStatus="ACTIVE")
2. Follow implementation plan
3. FINISH: task_update(list="done", mode=null, agentSessionStatus="INACTIVE")
```

### Integration Requirements Analysis

**Database Schema Changes:**
1. Expand `list` enum to include "check"
2. Expand `mode` enum to include "check" 
3. Add iteration tracking for multiple send-back cycles
4. Add rejection reasons storage
5. Add human verification timestamps

**UI Layout Changes:**
1. Reorder columns: Todo → Doing → Check → Done
2. Remove dedicated Loop column
3. Integrate Loop cards into Todo column with visual indicators
4. Add Check column with approval/rejection controls

**Agent Prompt Changes:**
1. Update Execute prompt to send to Check instead of Done
2. Create new Check mode prompt for human verification workflow
3. Handle rejection flow back to Plan mode

## Research & Findings

### Key Design Challenges

1. **Iteration History**: Need efficient storage for multiple reject/approve cycles
2. **State Transitions**: Complex state management with multiple paths
3. **UI Consistency**: Maintaining simple 4-column board while adding functionality
4. **Agent Integration**: Seamless agent workflow modifications
5. **Loop Integration**: Merging Loop functionality into Todo without complexity

### Current System Strengths
- Clean JSONB storage for flexible data (plan, state, settings)
- Robust MCP tool integration for agent communication
- Well-structured database relations
- Clear separation of raw vs refined content

### Technical Requirements
- Database migration for schema changes
- Frontend component updates for new column
- Agent prompt template modifications
- MCP tool parameter validation updates
- WebSocket broadcast updates for real-time UI

## Field Names and Entity Design

### Recommended Field Names

**New Database Fields:**
```typescript
// Add to tasks table
checkIterations: jsonb("check_iterations").default([]), // Array of iteration objects
currentCheckIteration: integer("current_check_iteration").default(0),
lastCheckedAt: timestamp("last_checked_at"),
lastCheckedByUserId: uuid("last_checked_by_user_id").references(() => users.id),
humanVerificationStatus: text("human_verification_status"), // "pending", "approved", "rejected"
```

**Check Iteration Object Structure:**
```typescript
interface CheckIteration {
  iterationNumber: number;
  submittedAt: string; // ISO timestamp
  submittedByAgentId: string;
  status: "pending" | "approved" | "rejected";
  
  // Human review data (when status becomes approved/rejected)
  reviewedAt?: string; // ISO timestamp  
  reviewedByUserId?: string;
  rejectionReason?: string; // Only present when rejected
  approvalNotes?: string; // Optional approval notes
  
  // Task state snapshot at submission
  taskStateSnapshot: {
    refinedTitle: string;
    refinedDescription: string;
    plan: any; // Copy of plan at submission time
  };
}
```

**Alternative Field Names Considered:**
- `verificationCycles` vs `checkIterations` → checkIterations is clearer
- `reviewHistory` vs `checkIterations` → checkIterations is more specific
- `humanFeedback` vs `rejectionReason` → rejectionReason is more precise
- `verificationRounds` vs `checkIterations` → checkIterations aligns with iteration concept

## Solution Options and Rankings

### Option 1: Full Implementation (Recommended ⭐⭐⭐⭐⭐)

**Approach:**
- Add Check column between Doing and Done
- Store iteration history in JSONB array
- Update agent prompts to use Check workflow
- Move Loop functionality to Todo with visual indicators

**Pros:**
- Complete feature implementation as requested
- Maintains data history for analysis
- Clean user experience with clear workflow
- Follows existing JSONB pattern for flexibility

**Cons:**
- Most complex implementation
- Requires multiple component updates
- Database migration needed

**Implementation Effort:** High
**User Value:** Very High

### Option 2: Simplified Check Mode (⭐⭐⭐⭐)

**Approach:**
- Add Check column with basic approve/reject
- Store only current rejection reason, no full history
- Simplified iteration tracking (just counter)

**Pros:**
- Simpler implementation
- Covers core use case
- Faster to implement

**Cons:**
- Loses iteration history
- Less data for improvement analysis
- May need extension later

**Implementation Effort:** Medium
**User Value:** High

### Option 3: Modal-Based Verification (⭐⭐⭐)

**Approach:**
- Keep current 4-column layout
- Show verification modal when task completes
- Store verification data in task record

**Pros:**
- No column layout changes
- Simpler UI updates
- Familiar modal pattern

**Cons:**
- Doesn't match requested column-based design
- Less visible workflow state
- Modal can be dismissed/ignored

**Implementation Effort:** Low
**User Value:** Medium

### Option 4: Two-Stage Done Column (⭐⭐)

**Approach:**
- Split Done column into "Pending Review" and "Approved" sections
- Tasks move through both sections

**Pros:**
- No new column needed
- Visual separation within existing column

**Cons:**
- Confusing single-column dual-state
- Doesn't address Loop column removal
- Poor user experience

**Implementation Effort:** Medium
**User Value:** Low

## Recommendations

### Primary Recommendation: Option 1 - Full Implementation

**Why This Option:**
1. **Matches Requirements**: Fully implements requested check column and Loop integration
2. **Future-Proof**: Comprehensive iteration tracking enables analytics and improvements  
3. **User Experience**: Clear visual workflow with human verification step
4. **Data Integrity**: Maintains complete audit trail of all iterations
5. **Scalable**: Framework supports future enhancements (notifications, automation, etc.)

**Implementation Plan:**
1. **Database Migration**: Add check list value, iteration fields
2. **Backend Updates**: MCP tools, validation, state management
3. **Agent Prompts**: Update execute prompt, add check mode prompt
4. **Frontend Components**: New Check column, Loop integration in Todo
5. **Testing**: Comprehensive workflow testing

### Secondary Recommendation: Phased Approach

If full implementation timeline is a concern:

**Phase 1**: Basic Check column with simple approve/reject (Option 2)
**Phase 2**: Add full iteration tracking and enhanced features (upgrade to Option 1)

This allows faster initial delivery while preserving path to full feature set.

## Next Steps

### Immediate Actions Required:
1. **Stakeholder Approval**: Confirm Option 1 approach and field names
2. **Database Design Review**: Finalize schema changes and migration strategy
3. **UI Mockups**: Create visual designs for new Check column layout
4. **Agent Workflow Design**: Detail prompt changes and MCP tool updates
5. **Implementation Planning**: Break down work into specific development tasks

### Technical Considerations:
1. **Migration Strategy**: Plan for zero-downtime database updates
2. **Data Validation**: Ensure existing tasks handle new schema gracefully
3. **Performance**: Index new fields for efficient queries
4. **WebSocket Events**: Define real-time update events for Check interactions
5. **Error Handling**: Robust validation for iteration data structure

### Success Metrics:
1. **User Adoption**: Percentage of tasks using Check workflow
2. **Iteration Patterns**: Average iterations before approval  
3. **Quality Improvement**: Correlation between Check usage and task success
4. **Performance**: Check column response times and interaction smoothness

## Conclusion

The Check mode feature represents a significant workflow enhancement that adds human verification to AI-generated work. Option 1 (Full Implementation) provides the most comprehensive solution that fully addresses the requirements while building a foundation for future improvements.

The recommended field names and database structure provide flexibility for iteration tracking while maintaining the system's existing JSONB patterns for complex data storage. The integration of Loop functionality into the Todo column simplifies the overall board layout while preserving the repeatable task capability.

Success depends on careful implementation of the database migration, thoughtful UI design for the Check column interactions, and comprehensive testing of the agent workflow changes.