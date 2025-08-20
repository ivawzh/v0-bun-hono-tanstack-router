/**
 * Plan Stage Prompt Template
 * Used when agents need to create implementation plans
 */

import { defaultActorDescription } from './defaultActor';
import { type PromptParams } from './index';

export function generatePlanPrompt(context: PromptParams): string {
  const { task, actor, project } = context;

  return `[plan] ${task.rawTitle || task.refinedTitle}
**Do not write any code!**
Plan a task - create a comprehensive implementation plan and detailed specification.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="doing", stage="plan", agentSessionStatus="ACTIVE"
2. **List Solution Options**: List viable potential solution options
3. **Evaluate and Rank**: Compare the options considering in order of importance:
   - Most importantly - UX
   - Alignment with project goals
   - Design simplicity
   - Industry standards & best practices
   - Maintainability
4. **Select Final Approach**: Choose the best solution
5. **Create Plan**: Write a detailed plan including:
   - Spec
   - Detailed implementation steps
   - Potential risks and mitigations (only if necessary)
6. **Evaluate Plan Complexity**: After creating your plan, evaluate if it exceeds manageable limits:
   - Count implementation steps (exclude planning/analysis steps)
   - Estimate total lines of code changes across all files
   - If plan has >6 implementation steps OR >600 lines of code changes:
     * **CRITICAL**: Split into smaller tasks following EXECUTION ORDER
     * **Step-by-step task creation process:**
       1. **First task**: Create the foundational/prerequisite task first using \`task_create\`:
          - createdByTaskId="${task.id}"
          - refinedTitle="[Step 1 title]"
          - refinedDescription="[Step 1 description]" 
          - plan="[Step 1 specific plan]"
          - priority=${task.priority}
          - stage="execute"
          - dependsOnTaskIds=[] (empty - this is the first task)
       2. **Note the returned task ID** from step 1
       3. **Second task**: Create next dependent task using \`task_create\`:
          - Same parameters as step 1
          - refinedTitle="[Step 2 title]"
          - refinedDescription="[Step 2 description]"
          - plan="[Step 2 specific plan]"
          - dependsOnTaskIds=[task_id_from_step_1]
       4. **Continue this pattern** for remaining tasks, always referencing previous task IDs
       5. **Final step**: Mark current task as done using \`task_update\` with:
          - taskId="${task.id}"
          - status="done"
          - agentSessionStatus="NON_ACTIVE"
          - plan="[summary of all split tasks created]"
7. **FINISH**: If not splitting cards, use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", stage="execute", agentSessionStatus="NON_ACTIVE", plan=[from above]

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? '**Project Context**: ' + project.memory : ''}

**Task to Plan**:
- **Title**: ${task.refinedTitle || task.rawTitle}
- **Description**: ${task.refinedDescription || task.rawDescription || 'No description provided'}`;
}
