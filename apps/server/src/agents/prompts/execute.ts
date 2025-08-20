/**
 * Execute Stage Prompt Template
 * Used when agents need to implement solutions
 */

import { defaultActorDescription } from './defaultActor';
import type { PromptParams } from './index';

export function generateExecutePrompt(context: PromptParams): string {
  const { task, actor, project } = context;

  const planSummary = task.plan ? JSON.stringify(task.plan) : 'No plan available';

  return `[execute] ${task.rawTitle || task.refinedTitle}
Implement the solution following the plan below.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="doing", stage="execute", agentSessionStatus="ACTIVE"
2. **Follow the Plan**: Implement the solution as specified in the plan above
3. **Commit Changes**: Make appropriate git commits when needed
4. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="done", stage=null, agentSessionStatus="NON_ACTIVE"

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? '**Project Context**: ' + project.memory : ''}

**Task to Implement**:
- **Title**: ${task.refinedTitle || task.rawTitle}
- **Description**: ${task.refinedDescription || task.rawDescription || 'No description provided'}

**Implementation Plan**:
${planSummary}`;
}
