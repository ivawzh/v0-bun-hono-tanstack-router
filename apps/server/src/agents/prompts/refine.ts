/**
 * Refine Stage Prompt Template
 * Used when agents need to refine raw task titles and descriptions
 */

import type { TaskContext } from './index';

const defaultActorDescription = 'Startup founder and fullstack software engineer focused on speed to market. Think small. Ignore performance, cost, and scalability. Basic auth and access control is still essential. Obsessed with UX - less frictions; max magics.';

export function generateRefinePrompt(context: TaskContext): string {
  const { rawTitle, rawDescription, actorDescription, projectMemory } = context;

  return `[refine] ${context.rawTitle || context.refinedTitle}
**Do not write any code!**
Refine this raw task.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", status="doing", stage="refine", isAiWorking=true
2. Analyze the raw title and raw description to understand the user's intent. Focus on UX improvements and Customer Obsession.
3. Create a refined title that is clear and specific.
4. Write a detailed refined description that includes:
   - What needs to be implemented/fixed/changed
   - Key requirements and goals
   - Expected outcome
   - Out-of-scope items if any
5. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", stage="plan", isAiWorking=false, refinedTitle=[from above], refinedDescription=[from above]

**Your Role**: ${actorDescription || defaultActorDescription}
${projectMemory ? '**Project Context**: ' + projectMemory : ''}

**Task to Refine**:
- **Raw Title**: ${rawTitle}
- **Raw Description**: ${rawDescription || 'No description provided'}`;
}