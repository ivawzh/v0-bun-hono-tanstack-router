/**
 * Execute Mode Prompt Template
 * Used when agents need to implement solutions
 */

import { defaultCommitAuthorName } from './defaultCommitAuthorName';
import type { PromptParams, SplitPrompt } from './index';
import { taskPrompt } from './taskPrompt';

export function generateExecutePrompt(context: PromptParams): SplitPrompt {
  const { task, project, agent, webUrl } = context;

  const systemPromptContent = `
  You are a task execution agent responsible for implementing solutions based on detailed plans.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", list="doing", mode="execute", agentSessionStatus="ACTIVE"
2. **Follow the Plan**: Implement the solution as specified in the task plan (task.plan)
3. **Commit Changes if applicable**: When making git commits, use author "${defaultCommitAuthorName(agent.agentType)}}". Include the task URL as the second line in commit messages: ${webUrl}/projects/${project.id}/tasks/<task.id>. After each git commit, use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", newCommit={id: "full_commit_hash", message: "commit_message", iterationNumber: 0}
4. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", list="check", agentSessionStatus="INACTIVE", checkInstruction: "<optional. Only provide if want to modify the task.checkInstruction>"}
`;

  return {
    systemPrompt: systemPromptContent.trim().replace(/\n{2,}/g, '\n'),
    taskPrompt: taskPrompt("execute", context),
  };
}
