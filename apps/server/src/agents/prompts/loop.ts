/**
 * Loop Stage Prompt Template
 * Used for repeatable tasks that cycle infinitely
 */

import type { TaskContext } from './index';

const defaultActorDescription = 'Startup founder and fullstack software engineer focused on speed to market. Think small. Ignore performance, cost, and scalability. Basic auth and access control is still essential. Obsessed with UX - less frictions; max magics.';

export function generateLoopPrompt(context: TaskContext): string {
  const { rawTitle, refinedTitle, rawDescription, refinedDescription, plan, actorDescription, projectMemory } = context;

  const titleSection = refinedTitle || rawTitle;
  const descriptionSection = refinedDescription || rawDescription || '';

  return `[loop] ${titleSection}
${descriptionSection ? `\n**Description**: ${descriptionSection}` : ''}

Execute this repeatable task. This is a loop task that will return to the loop column after completion.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", status="doing", stage="loop", isAiWorking=true
2. **Execute Task**: Perform the task as described (no refine/plan stages for loop tasks)
3. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", status="done", stage="loop", isAiWorking=false

**Note**: This task will automatically return to the Loop column for future execution.

**Your Role**: ${actorDescription || defaultActorDescription}
${projectMemory ? `**Project Context**: ${JSON.stringify(projectMemory)}` : ''}${plan ? `\n\n**Implementation Plan**:\n${JSON.stringify(plan, null, 2)}` : ''}`;
}