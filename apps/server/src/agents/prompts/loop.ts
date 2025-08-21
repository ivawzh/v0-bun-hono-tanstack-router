/**
 * Loop Stage Prompt Template
 * Used for repeatable tasks that cycle infinitely
 */

import { defaultActorDescription } from './defaultActor';
import { type PromptParams } from './index';

export function generateLoopPrompt(context: PromptParams): string {
  const { task, actor, project } = context;

  const titleSection = task.refinedTitle || task.rawTitle;
  const descriptionSection = task.refinedDescription || task.rawDescription || '';

  return `[loop] ${titleSection}
${descriptionSection ? `\n**Description**: ${descriptionSection}` : ''}

Execute this repeatable task. This is a loop task that will return to the loop column after completion.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", column="doing", mode="loop", agentSessionStatus="ACTIVE"
2. **Execute Task**: Perform the task as described (no clarify/plan stages for loop tasks)
3. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", column="done", mode="loop", agentSessionStatus="INACTIVE"

**Note**: This task will automatically cycle back to the Todo column (positioned after other loop tasks) for fair rotation through all loop tasks.

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? `**Project Context**: ${JSON.stringify(project.memory)}` : ''}${task.plan ? `\n\n**Implementation Plan**:\n${JSON.stringify(task.plan, null, 2)}` : ''}`;
}
