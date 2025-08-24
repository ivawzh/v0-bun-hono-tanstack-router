/**
 * Iterate Mode Prompt Template
 * Used when agents need to implement solutions based on feedback
 */

import { defaultActorDescription } from './defaultActor';
import { defaultCommitAuthorName } from './defaultCommitAuthorName';
import type { PromptParams, SplitPrompt } from './index';

export function generateIteratePrompt(context: PromptParams): SplitPrompt {
  const { task, actor, project, agent, webUrl, taskIterations } = context;

  const planSummary = task.plan ? JSON.stringify(task.plan) : 'No plan available';
  const commitAuthorName = defaultCommitAuthorName(agent.agentType);

  if (!taskIterations || taskIterations.length < 0) {
    throw new Error(`No task iterations found for iterate mode task: ${task.id}`);
  }

  const prevIterations = taskIterations.slice(0, -1);
  const currentIteration = taskIterations[taskIterations.length - 1];

  const systemPrompt = `This is a task that has been sent back for revision. Iterate based on the user feedback below.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", list="doing", mode="iterate", agentSessionStatus="ACTIVE"
2. **Follow the most recent feedback(s)**: consider if we need to update the task's refined title, refined description, or plan. If so, use MCP tool \`task_update\` with taskId="${task.id}", refinedTitle="...", refinedDescription="...", plan="...", agentSessionStatus="ACTIVE" to update the task. When updating plan, mark the previous steps completed, and then append new steps.
3. **Commit Changes**: When making git commits, use author "${commitAuthorName}" to maintain consistent Solo Unicorn branding. Include the task URL as the second line in commit messages: ${webUrl}/projects/${project.id}/tasks/${task.id}
4. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", list="check", mode="check", agentSessionStatus="INACTIVE"${task.checkInstruction ? `, checkInstruction="${task.checkInstruction}"` : ""}

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? '**Project Context**: ' + project.memory : ''}`;

  const taskPrompt = `[iterate] ${task.rawTitle || task.refinedTitle}

**Current iteration number**:#${currentIteration.iterationNumber}
**MOST IMPORTANT - current iteration feedback**:
${currentIteration.feedback}

---------

**NOTE ALL INFORMATION BELOW ARE OLD FROM PREVIOUS ITERATIONS**

**Old task information**:
- **Title**: ${task.refinedTitle || task.rawTitle}
- **Description**: ${task.refinedDescription || task.rawDescription || 'No description provided'}

**Old Plan We Implemented from the previous iteration(s)**:
${planSummary}

**Old feedback from the previous iteration(s)**:
${prevIterations.map(iteration => `- **Iteration ${iteration.iterationNumber}**: ${iteration.feedback.length > 500 ? iteration.feedback.slice(0, 500) + '(truncated...)' : iteration.feedback}`).join('\n')}`;

  return { systemPrompt, taskPrompt };
}
