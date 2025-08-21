/**
 * Plan Mode Prompt Template
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
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", list="doing", mode="plan", agentSessionStatus="ACTIVE"
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
   - Detailed implementation steps breakdown
   - You may provide detailed modifying files, line numbers, function names, etc to help future agent look up the codebase.
   - Potential risks and mitigations (only if necessary)
6. **Evaluate Plan Complexity**: After creating your plan, evaluate if it exceeds manageable limits:
   - Count implementation steps (exclude planning/analysis steps)
   - Estimate total lines of code changes across all files
   - If plan has >6 implementation steps OR >600 lines of code changes:
     * Split into smaller tasks using \`task_create\` with:
       - createdByTaskId="${task.id}", refinedTitle, refinedDescription, plan, priority=${task.priority}, mode="execute"
       - **Only use dependsOnTaskIds if tasks must execute in specific order**
       - For ordered tasks: Create first task without dependsOnTaskIds, note returned task ID, use it for next task, e.g. dependsOnTaskIds=[prerequisite_task_id]
       - For parallel tasks: Leave dependsOnTaskIds empty for all
     * Mark current task done: \`task_update\` with taskId="${task.id}", list="done", agentSessionStatus="INACTIVE"
7. **FINISH**: If not splitting cards, use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", mode="execute", agentSessionStatus="INACTIVE", plan=[from above]

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? '**Project Context**: ' + project.memory : ''}

**Task to Plan**:
- **Title**: ${task.refinedTitle || task.rawTitle}
- **Description**: ${task.refinedDescription || task.rawDescription || 'No description provided'}`;
}
