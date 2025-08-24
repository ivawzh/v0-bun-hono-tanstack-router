/**
 * Execute Mode Prompt Template
 * Used when agents need to implement solutions
 */

import { defaultCommitAuthorName } from './defaultCommitAuthorName';
import type { PromptParams, SplitPrompt } from './index';
import { taskPrompt } from './taskPrompt';

export function generateExecutePrompt(context: PromptParams): SplitPrompt {
  const { task, project, agent, webUrl, taskIterations } = context;
  
  // Check if this is an iteration
  const isIteration = taskIterations && taskIterations.length > 0;
  const currentIteration = isIteration ? taskIterations[taskIterations.length - 1] : null;
  const iterationNumber = currentIteration?.iterationNumber || 0;

  const systemPromptContent = `
You are a task execution agent responsible for implementing solutions based on detailed plans.
${isIteration ? '\n**You are currently iterating on a sent-back task based on user feedback.**' : ''}

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", list="doing", mode="execute", agentSessionStatus="ACTIVE"
2. ${isIteration ? '**Follow the most recent feedback(s)**: consider if we need to update the task\'s refined title, refined description, or plan. If so, use MCP tool \`task_update\` with taskId="<task.id>", refinedTitle="...", refinedDescription="...", plan="...", agentSessionStatus="ACTIVE" to update the task. When updating plan, mark the previous steps completed, and then append new steps.' : '**Follow the Plan**: Implement the solution as specified in the task plan (task.plan)'}
3. **Commit Changes if applicable**: When making git commits, use author "${defaultCommitAuthorName(agent.agentType)}}". Include the task URL as the second line in commit messages: ${webUrl}/projects/${project.id}/tasks/<task.id>. After each git commit, use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", newCommit={id: "full_commit_hash", message: "commit_message", iterationNumber: ${iterationNumber}}
4. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", list="check", agentSessionStatus="INACTIVE", checkInstruction: "<optional. Only provide if want to modify the task.checkInstruction>"}
`;

  return {
    systemPrompt: systemPromptContent.trim().replace(/\n{2,}/g, '\n'),
    taskPrompt: taskPrompt("execute", context),
  };
}
