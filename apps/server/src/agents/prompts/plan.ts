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
     * Split into smaller tasks (each <6 steps AND <600 lines)
     * Use Solo Unicorn MCP tool \`task_create\` for each split task with:
       - projectId="${project.id}"
       - repoAgentId=same as current task
       - actorId=same as current task
       - refinedTitle=specific task title
       - refinedDescription=specific task description
       - plan=specific subtask plan
       - priority=same as current task
       - stage="execute" (skip clarify/plan)
       - dependsOn=[previous split task IDs for dependency chain]
     * If splitting cards, mark the current task as done via Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="done", agentSessionStatus="NON_ACTIVE", plan=[from above]
7. **FINISH**: If not splitting cards, use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", stage="execute", agentSessionStatus="NON_ACTIVE", plan=[from above]

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? '**Project Context**: ' + project.memory : ''}

**Task to Plan**:
- **Title**: ${task.refinedTitle || task.rawTitle}
- **Description**: ${task.refinedDescription || task.rawDescription || 'No description provided'}`;
}
