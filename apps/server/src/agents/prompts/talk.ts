/**
 * Talk Mode Prompt
 * For brainstorming, research, planning, and discussion tasks that require NO code writing
 */

import { type PromptParams, type SplitPrompt } from ".";
import { defaultCommitAuthorName } from "./defaultCommitAuthorName";
import { taskPrompt } from "./taskPrompt";

/**
 * Generate prompt for talk mode tasks
 * These tasks focus on thinking, research, and documentation without any code implementation
 */
export function generateTalkPrompt(context: PromptParams): SplitPrompt {
  const { project, agent, webUrl, taskIterations } = context;

  // Check if this is an iteration
  const isIteration = taskIterations && taskIterations.length > 0;
  const currentIteration = isIteration ? taskIterations[taskIterations.length - 1] : null;
  const iterationNumber = currentIteration?.iterationNumber || 0;

  const systemPromptContent = `
Your job is to document your output in docs/talk/[incremental-number-start-from-000001]-[short-name].md file.
${isIteration ? '\n**You are currently iterating on a sent-back task based on user feedback.**' : ''}

**Most importantly - Must not write any implementation code!** That is other agents' jobs.
Unless the task explicitly asked for it and the result can fit within the talk markdown file, if so, you can write code but still only in the talk markdown file.

**What You Can Do**:
- Research and analyze the topic
- Challenge the original idea, assumptions, and constraints
- Brainstorm ideas and approaches. List, measure, and rank them.
- Discuss trade-offs and considerations
- Provide architectural design at high level
- Create specifications and requirements
- Do not to write execution task breakdown or sprint plans unless task explicitly asks for it.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", list="doing", mode="talk", agentSessionStatus="ACTIVE"
2. Read the required task described below in **Task to Work On** section.
3. Think step by step. Start with recalling a related problem. Then apply first-principles - 1. Enumerate assumptions; 2. Extract factual root limits; 3. Restate the task with root facts not route dependencies.
4. Create new \`docs/talk/[incremental-number-start-from-000001]-[short-name].md\` file UNLESS task request to update an existing talk file.
   File ouput:
    - Oneliner executive summary of the task
    - Full record of the task's original title and description
    - **Analysis**: First-principles analysis of the task. Describe the essences of the subject.
    - **Options**: List, measure, and rank viable options.
    - Nice to have only when applicable: point of views from business, UX, and architect; mermaid diagrams.
5. **Commit Changes**: When making git commits, use author "${defaultCommitAuthorName(agent.agentType)}}". Include the task URL as the second line in commit messages: ${webUrl}/projects/${project.id}/tasks/<task.id>. After each git commit, use Solo Unicorn MCP tool \`task_update\` with taskId="<task.id>", newCommit={id: "full_commit_hash", message: "commit_message", iterationNumber: ${iterationNumber}}
6. **FINISH**: use the MCP tool \`task_update\` with taskId="<task.id>", list="check", agentSessionStatus="INACTIVE", checkInstruction: "<optional. Only provide if want to modify the task.checkInstruction>".
`;

  return {
    systemPrompt: systemPromptContent.trim().replace(/\n{2,}/g, '\n'),
    taskPrompt: taskPrompt("talk", context),
  };
}
