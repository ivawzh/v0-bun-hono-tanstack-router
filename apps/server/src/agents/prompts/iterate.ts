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

  if (!taskIterations || taskIterations.length < 0) {
    throw new Error(`No task iterations found for iterate mode task: ${task.id}`);
  }

  const prevIterations = taskIterations.slice(0, -1);
  const currentIteration = taskIterations[taskIterations.length - 1];

  const systemPromptContent = `
You are a task iteration agent responsible for iterating on a sent-back task based on user feedback.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", list="doing", mode="iterate", agentSessionStatus="ACTIVE"
2. **Follow the most recent feedback(s)**: consider if we need to update the task's refined title, refined description, or plan. If so, use MCP tool \`task_update\` with taskId="<task.id>", refinedTitle="...", refinedDescription="...", plan="...", agentSessionStatus="ACTIVE" to update the task. When updating plan, mark the previous steps completed, and then append new steps.
3. **Commit Changes**: When making git commits, use author "${defaultCommitAuthorName(agent.agentType)}". Include the task URL as the second line in commit messages: ${webUrl}/projects/${project.id}/tasks/<task.id>
4. **Track Commits**: After each git commit, use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>" and newCommit parameter: {id: "full_commit_hash", message: "commit_message", iterationNumber: ${currentIteration.iterationNumber}}
5. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", list="check", agentSessionStatus="INACTIVE"
`;

const taskPrompt = `[iterate] ${task.rawTitle || task.refinedTitle}

**Task ID (task.id)**: ${task.id}

**Current iteration number**:#${currentIteration.iterationNumber}
**MOST IMPORTANT - Current iteration feedback**: ${currentIteration.feedback}

**Your acting character description**: ${actor?.description || defaultActorDescription}
${project.memory ? "**Project Context**: " + project.memory : ""}

---------

**ALL INFORMATION BELOW ARE OLD FROM PREVIOUS ITERATIONS**

**Old task information**:
- ${task.refinedTitle ? "**Refined Title (AI written)**: " + task.refinedTitle : ""}
- ${task.refinedDescription ? "**Refined Description (AI written)**: " + task.refinedDescription : ""}
- ${task.rawTitle ? "**Raw Title (Human written)**: " + task.rawTitle : ""}
- ${task.rawDescription ? "**Raw Description (Human written)**: " + task.rawDescription : ""}

**Old Task Plan ('task.plan'. AI written) we Implemented from the previous iteration(s)**:
${planSummary}

**Old feedback from the previous iteration(s)**:
${prevIterations.map(iteration => `- **Iteration ${iteration.iterationNumber}**: ${iteration.feedback.length > 500 ? iteration.feedback.slice(0, 500) + '(truncated...)' : iteration.feedback}`).join('\n')}`;

  return {
    systemPrompt: systemPromptContent.trim().replace(/\n{2,}/g, '\n'),
    taskPrompt: taskPrompt.trim().replace(/\n{2,}/g, '\n'),
  };
}
