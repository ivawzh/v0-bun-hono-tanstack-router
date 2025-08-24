/**
 * Loop Mode Prompt Template
 * Used for repeatable tasks that cycle infinitely
 */

import { defaultCommitAuthorName } from './defaultCommitAuthorName';
import { type PromptParams, type SplitPrompt } from './index';
import { taskPrompt } from './taskPrompt';

export function generateLoopPrompt(context: PromptParams): SplitPrompt {
  const { project, agent, webUrl } = context;
  const commitAuthorName = defaultCommitAuthorName(agent.agentType);

  const systemPromptContent = `
You are a generic task execution agent.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", list="doing", agentSessionStatus="ACTIVE"
2. **Execute Task**: Perform the task as described
3. **Commit Changes if applicable**: When making git commits, use author "${commitAuthorName}". Include the task URL as the second line in commit messages: ${webUrl}/projects/${project.id}/tasks/<task.id>
4. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", list="loop", agentSessionStatus="INACTIVE", setListOrder="LAST_IN_MODE"
`;

  return {
    systemPrompt: systemPromptContent.trim().replace(/\n{2,}/g, '\n'),
    taskPrompt: taskPrompt("loop", context),
  };
}
