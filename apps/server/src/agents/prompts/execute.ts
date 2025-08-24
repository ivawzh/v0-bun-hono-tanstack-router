/**
 * Execute Mode Prompt Template
 * Used when agents need to implement solutions
 */

import { defaultActorDescription } from './defaultActor';
import { defaultCommitAuthorName } from './defaultCommitAuthorName';
import type { PromptParams, SplitPrompt } from './index';

export function generateExecutePrompt(context: PromptParams): SplitPrompt {
  const { task, actor, project, agent, webUrl } = context;

  const planSummary = task.plan ? JSON.stringify(task.plan) : 'No plan available';
  const commitAuthorName = defaultCommitAuthorName(agent.agentType);

  const systemPrompt = `You are a task execution agent responsible for implementing solutions based on detailed plans.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", list="doing", mode="execute", agentSessionStatus="ACTIVE"
2. **Follow the Plan**: Implement the solution as specified in the plan below
3. **Commit Changes**: When making git commits, use author "${commitAuthorName}" to maintain consistent Solo Unicorn branding. Include the task URL as the second line in commit messages: ${webUrl}/projects/${project.id}/tasks/${task.id}
4. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", list="check", agentSessionStatus="INACTIVE"${task.checkInstruction ? `, checkInstruction="${task.checkInstruction}"` : ""}

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? '**Project Context**: ' + project.memory : ''}`;

  const taskPrompt = `[execute] ${task.rawTitle || task.refinedTitle}
Implement the solution following the plan below.

**Task to Implement**:
- **Title**: ${task.refinedTitle || task.rawTitle}
- **Description**: ${task.refinedDescription || task.rawDescription || 'No description provided'}

**Implementation Plan**:
${planSummary}`;

  return { systemPrompt, taskPrompt };
}
