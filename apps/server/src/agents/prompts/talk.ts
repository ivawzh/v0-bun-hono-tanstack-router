/**
 * Talk Mode Prompt
 * For brainstorming, research, planning, and discussion tasks that require NO code writing
 */

import { type PromptParams } from ".";
import { defaultActorDescription } from "./defaultActor";
import { defaultCommitAuthorName } from "./defaultCommitAuthorName";

/**
 * Generate prompt for talk mode tasks
 * These tasks focus on thinking, research, and documentation without any code implementation
 */
export function generateTalkPrompt({
  task,
  actor,
  project,
  agent,
  webUrl,
}: PromptParams): string {
  const actorContext = `**Your Role**: ${actor?.description || defaultActorDescription}`;
  const projectMemory =
    project.memory &&
    typeof project.memory === "object" &&
    Object.keys(project.memory).length > 0
      ? `**Project Context**: ${JSON.stringify(project.memory, null, 2)}`
      : "";
  const commitAuthorName = defaultCommitAuthorName(agent.agentType);

  return `[talk] ${task.rawTitle || task.refinedTitle}

Most importantly, **NO IMPLEMENTATION or EXECUTION** - This is a "talk" mode task focused on thinking, research, and discussion only. No actions except writing response to the file. Do not write any implementation code.

**What You Can Do**:
- Research and analyze the topic
- Challenge the original idea, assumptions, and constraints
- Brainstorm ideas and approaches. List, measure, and rank them.
- Discuss trade-offs and considerations
- Provide architectural design at high level
- Create specifications and requirements
- Do not to write execution task breakdown or sprint plans unless task explicitly asks for it.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", list="doing", mode="talk", agentSessionStatus="ACTIVE"
2. Read the required task described below in **Task to Work On** section.
3. Start with recalling a related problem, and then solve this one. Use first-principles (1. Enumerate assumptions; 2. Extract factual root limits; 3. Restate the task with root facts not without conventions.). Think step by step.
4. Create new \`docs/talk/[incremental-number-start-from-000001]-[short-name].md\` file UNLESS task request to update an existing talk file.
   File ouput:
    - Oneliner executive summary of the task
    - Full record of the task's original title and description
    - **Analysis**: First-principles analysis of the task. Describe the essences of the subject.
    - **Options**: List, measure, and rank viable options.
    - Nice to have only when applicable: point of views from business, UX, and architect; mermaid diagrams.
5. **Commit Changes**: When making git commits, use author "${commitAuthorName}" to maintain consistent Solo Unicorn branding. Include the task URL as the second line in commit messages: ${webUrl}/projects/${project.id}/tasks/${task.id}
6. **FINISH**: use the MCP tool \`task_update\` with taskId="${task.id}", list="done", mode="talk", agentSessionStatus="INACTIVE".

${actorContext}
${projectMemory}

**Task to Work On**:
- **Title**: ${task.refinedTitle || task.rawTitle}
- **Description**: ${task.refinedDescription || task.rawDescription || "No description provided"}
`;
}
