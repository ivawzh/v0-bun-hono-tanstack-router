# Master Plan: Introduce "Check" Stage for Human Verification

## Analysis Summary

The user wants to add a new "Check" stage to allow human verification before tasks are marked as done. This is about adding a quality control step where humans can review AI work and provide feedback for iterations.

## Current Architecture Analysis

**Current Task Lifecycle:**
- Status: `todo` → `doing` → `done` / `loop`
- Stages: `clarify` → `plan` → `execute` (for regular tasks) / `loop` (for loop tasks)
- Execute stage currently transitions directly to `done` status

**Current Database Schema:**
- `status`: enum `["todo", "doing", "done", "loop"]`
- `stage`: enum `["clarify", "plan", "execute", "loop"]`
- Feedback storage: No current mechanism for human feedback/iterations

## Solution Options & Ranking

### Option 1: Add "Check" Column with Feedback System ⭐⭐⭐⭐⭐ (RECOMMENDED)
**Concept:** New 5-column board: Todo → Doing → Check → Done → Loop

**Pros:**
- Clear visual separation of verification stage
- Maintains current workflow logic
- Intuitive UX - humans see what needs checking
- Easy to implement with existing architecture
- Scalable feedback system

**Implementation:**
- Add `check` to status enum
- Add `check` to stage enum
- Add `feedbackHistory` jsonb field for iteration tracking
- Execute stage transitions to `check` status instead of `done`
- Human can approve (→ done) or reject with feedback (→ doing/clarify)

### Option 2: Add "Check" as Sub-Stage within "Done" Column ⭐⭐⭐
**Concept:** Keep 4 columns, add checking state within Done column

**Pros:**
- Minimal UI changes
- Preserves current column structure

**Cons:**
- Confusing UX - tasks appear "done" but aren't
- Less clear what needs human attention
- Harder to track verification workload

### Option 3: Modal-Based Verification ⭐⭐
**Concept:** Pop-up verification modal when tasks complete

**Pros:**
- No column changes needed
- Quick verification workflow

**Cons:**
- Can be missed or ignored
- Poor discoverability
- Not great for batch verification

## Recommended Solution: Option 1 - "Check" Column

### UX Design
```
Todo | Doing | Check | Done | Loop
     |       | [✓]   |      |
     |       | [❌]  |      |
```

**Check Column Features:**
- Tasks show implementation results summary
- Human can click ✓ (approve → done) or ❌ (reject with feedback)
- Feedback modal for rejection with specific issues
- Visual indicators for how long tasks have been waiting

### Database Changes

#### Schema Updates
```sql
-- Update enums
ALTER TYPE status_enum ADD VALUE 'check';
ALTER TYPE stage_enum ADD VALUE 'check';

-- Add feedback tracking
ALTER TABLE tasks ADD COLUMN feedback_history JSONB DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN iteration_count INTEGER DEFAULT 0;
```

#### Feedback History Structure
```json
{
  "feedbackHistory": [
    {
      "id": "uuid",
      "timestamp": "2024-01-01T10:00:00Z",
      "feedback": "The button styling doesn't match the design. Please use primary color.",
      "rejectedFromStage": "check",
      "sentBackToStage": "clarify"
    }
  ],
  "iterationCount": 3
}
```

### System Flow Changes

#### Modified Execute Prompt
Current execute prompt step 4:
```
4. **FINISH**: Use MCP tool task_update with status="done", stage=null
```

New execute prompt step 4:
```
4. **FINISH**: Use MCP tool task_update with status="check", stage="check"
```

#### New Check Stage Logic
1. Agent completes execute stage → task moves to Check column
2. Human reviews work in Check column
3. Human decides:
   - **Approve**: Click ✓ → status="done", stage=null
   - **Reject**: Click ❌ → modal for feedback → status="doing", stage="clarify", add to feedbackHistory

#### Feedback Integration
- When task returns to clarify stage, AI gets access to `feedbackHistory`
- Clarify prompt includes previous iterations and specific feedback
- Each iteration increments `iterationCount`

### UI Components Needed

#### 1. Check Column Component
- New column in kanban board
- Show tasks awaiting verification
- Approve/reject buttons on each card

#### 2. Feedback Modal
- Rich text input for feedback
- Quick feedback templates ("Doesn't match design", "Missing feature", "Bug found")
- Option to send back to clarify, plan, or execute stage

#### 3. Task Card Enhancements
- Show iteration count badge if > 0
- Show feedback summary preview
- Visual indicators for tasks waiting in check

#### 4. Enhanced Task Drawer
- Feedback history timeline view
- Previous implementation attempts
- Clear iteration tracking

### Prompt Changes Needed

#### Modified Execute Prompt
- Change final step to transition to check stage
- Add summary of work completed for human review

#### Enhanced Clarify Prompt
- Include feedback history if available
- Show iteration count and previous attempts
- Focus on addressing specific feedback points

#### New Check Stage Prompt (Optional)
- For AI to provide work summary to human
- Self-assessment of implementation quality

### Todo Column Split (Secondary Feature)

**Recommendation:** Handle in separate task as suggested. Quick concept:

```
Todo Column Layout:
┌─ Normal Tasks (collapsible) ─┐
│ [P1] Feature A               │
│ [P2] Bug fix B               │
└─────────────────────────────┘
┌─ Loop Tasks (collapsible) ───┐
│ [∞] Code review              │
│ [∞] Documentation update     │
└─────────────────────────────┘
```

## Implementation Priority

### Phase 1: Core Check Stage
1. Database schema updates
2. Backend API changes
3. Basic Check column UI
4. Modified execute prompt

### Phase 2: Feedback System
1. Feedback modal and storage
2. Enhanced task drawer with history
3. Improved clarify prompt with feedback

### Phase 3: UX Polish
1. Quick feedback templates
2. Iteration tracking badges
3. Performance indicators

## Risk Assessment

**Low Risk:**
- Database changes are additive
- Existing workflows remain unchanged
- Gradual rollout possible

**Medium Risk:**
- Need to handle tasks currently in execute stage
- UI changes may need user education

**Mitigation:**
- Migration script for existing tasks
- Feature flag for gradual rollout
- Clear UI indicators for new workflow

## Out of Scope

- Automated testing of AI implementations
- Complex approval workflows (just approve/reject)
- Integration with external review tools
- Detailed performance metrics (save for later)

This plan provides a clear path to implement human verification while maintaining the system's simplicity and user-focused design principles.