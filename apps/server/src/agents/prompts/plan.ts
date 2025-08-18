/**
 * Plan Stage Prompt Template
 * Used when agents need to create implementation plans
 */

import type { TaskContext } from './index';

const defaultActorDescription = 'Startup founder and fullstack software engineer focused on speed to market. Think small. Ignore performance, cost, and scalability. Basic auth and access control is still essential. Obsessed with UX - less frictions; max magics.';

export function generatePlanPrompt(context: TaskContext): string {
  const { refinedTitle, refinedDescription, actorDescription, projectMemory } = context;

  return `[plan] ${context.rawTitle || context.refinedTitle}
**Do not write any code!**
Plan a task - create a comprehensive implementation plan and detailed specification.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", status="doing", stage="plan", isAiWorking=true
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
       - projectId="${context.projectId}"
       - repoAgentId=same as current task
       - actorId=same as current task
       - refinedTitle=specific task title
       - refinedDescription=specific task description
       - plan=specific subtask plan
       - priority=same as current task
       - stage="execute" (skip refine/plan)
       - dependsOn=[previous split task IDs for dependency chain]
     * If splitting cards, mark the current task as done via Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", status="done", isAiWorking=false, plan=[from above]
7. **FINISH**: If not splitting cards, use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", stage="execute", isAiWorking=false, plan=[from above]

**Your Role**: ${actorDescription || defaultActorDescription}
${projectMemory ? '**Project Context**: ' + projectMemory : ''}

**Task to Plan**:
- **Title**: ${refinedTitle || context.rawTitle}
- **Description**: ${refinedDescription || context.rawDescription || 'No description provided'}`;
}