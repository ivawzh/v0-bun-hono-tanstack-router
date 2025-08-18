/**
 * Execute Stage Prompt Template
 * Used when agents need to implement solutions
 */

import type { TaskContext } from './index';

const defaultActorDescription = 'Startup founder and fullstack software engineer focused on speed to market. Think small. Ignore performance, cost, and scalability. Basic auth and access control is still essential. Obsessed with UX - less frictions; max magics.';

export function generateExecutePrompt(context: TaskContext): string {
  const { refinedTitle, refinedDescription, plan, actorDescription, projectMemory, repoPath } = context;

  const planSummary = plan ? JSON.stringify(plan) : 'No plan available';

  return `[execute] ${context.rawTitle || context.refinedTitle}
Implement the solution following the plan below.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", status="doing", stage="execute", isAiWorking=true
2. **Follow the Plan**: Implement the solution as specified in the plan above
3. **Commit Changes**: Make appropriate git commits when needed
4. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", status="done", stage=null, isAiWorking=false

**Your Role**: ${actorDescription || defaultActorDescription}
${projectMemory ? '**Project Context**: ' + projectMemory : ''}

**Task to Implement**:
- **Title**: ${refinedTitle || context.rawTitle}
- **Description**: ${refinedDescription || context.rawDescription || 'No description provided'}

**Implementation Plan**:
${planSummary}`;
}