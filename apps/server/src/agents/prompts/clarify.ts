/**
 * clarify Stage Prompt Template
 * Used when agents need to clarify raw task titles and descriptions
 */

import type { PromptParams } from './index';

const defaultActorDescription = 'Startup founder and fullstack software engineer focused on speed to market. Think small. Ignore performance, cost, and scalability. Basic auth and access control is still essential. Obsessed with UX - less frictions; max magics.';

export function generateRefinePrompt(context: PromptParams): string {
  const { task, actor, project } = context;

  return `[clarify] ${task.rawTitle || task.refinedTitle}
**Do not write any code!**
clarify this raw task.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", column="doing", mode="clarify", agentSessionStatus="ACTIVE"
2. Analyze the raw title and raw description to understand the user's intent. Focus on UX improvements and Customer Obsession.
3. Create a refined title that is clear and specific.
4. Write a detailed refined description that includes:
   - What needs to be implemented/fixed/changed
   - Key requirements and goals
   - Expected outcome
   - Out-of-scope items if any
5. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", mode="plan", agentSessionStatus="INACTIVE", refinedTitle=[from above], refinedDescription=[from above]

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? '**Project Context**: ' + project.memory : ''}

**Task to clarify**:
- **Raw Title**: ${task.rawTitle}
- **Raw Description**: ${task.rawDescription || 'No description provided'}`;
}
