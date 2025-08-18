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
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="doing", stage="loop", isAiWorking=true
2. **Execute Task**: Perform the task as described (no clarify/plan stages for loop tasks)
3. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="done", stage="loop", isAiWorking=false

**Note**: This task will automatically return to the Loop column for future execution.

**Your Role**: ${actor.description || defaultActorDescription}
${project.memory ? `**Project Context**: ${JSON.stringify(project.memory)}` : ''}${task.plan ? `\n\n**Implementation Plan**:\n${JSON.stringify(task.plan, null, 2)}` : ''}`;
}
