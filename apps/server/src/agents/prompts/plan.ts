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
2. Think step by step. Start with recalling a related problem. Then apply first-principles - 1. Enumerate assumptions; 2. Extract factual root limits; 3. Restate the task with root facts not route dependencies.
3. **List Solution Options**: List viable potential solution options
4. **Evaluate and Rank**: Compare the options considering in order of importance:
   - Most importantly - UX
   - Alignment with project goals
   - Design simplicity
   - Industry standards & best practices
   - Maintainability
5. **Select Final Approach**: Choose the best solution
6. **Create Plan**: Write a plan as detailed as possible. The plan will include:
   - Spec
   - Detailed implementation steps breakdown
   - You may provide detailed modifying files, line numbers, function names, etc to help future agent look up the codebase.
   - Potential risks and mitigations (only if necessary)
7. **Generate Check Instructions**: Based on your plan, create 2-4 concise bullet-point QA instructions that will help humans review and approve the task when it moves to Check column. Focus on key validation points like functionality, integration, testing, and quality.
8. **Evaluate Plan Complexity**: After creating your plan, evaluate if it exceeds manageable limits:
   - Count implementation steps (exclude planning/analysis steps)
   - Estimate total lines of code changes across all files
   - If plan has >6 implementation steps OR >600 lines of code changes:
     * Split into smaller tasks using \`task_create\` with:
       - Clear and detailed context for the new task - what, why, how, etc. Also provide parent task and immediate prerequisite tasks' context. Be extra clear because the agent will execute the new task only based on this context.
       - Full plan in same format as step 5.
       - createdByTaskId="${task.id}", refinedTitle, refinedDescription, plan, priority=${task.priority}, mode="execute"
       - **Only use dependsOnTaskIds if tasks must execute in specific order**
       - For ordered tasks: Create first task without dependsOnTaskIds, note returned task ID, use it for next task, e.g. dependsOnTaskIds=[prerequisite_task_id]
       - For parallel tasks: Leave dependsOnTaskIds empty for all
     * Mark current task done: \`task_update\` with taskId="${task.id}", list="done", agentSessionStatus="INACTIVE"
   - If not splitting cards, use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", mode="execute", agentSessionStatus="INACTIVE", plan=[from above], checkInstruction=[check instructions from step 7]

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? '**Project Context**: ' + project.memory : ''}

**Task to Plan**:
- **Title**: ${task.refinedTitle || task.rawTitle}
- **Description**: ${task.refinedDescription || task.rawDescription || 'No description provided'}`;
}
