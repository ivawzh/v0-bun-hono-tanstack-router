/**
 * Loop Mode Prompt Template
 * Used for repeatable tasks that cycle infinitely
 */

import { defaultActorDescription } from './defaultActor';
import { type PromptParams, type SplitPrompt } from './index';

export function generateLoopPrompt(context: PromptParams): SplitPrompt {
  const { task, actor, project } = context;

  const titleSection = task.refinedTitle || task.rawTitle;
  const descriptionSection = task.refinedDescription || task.rawDescription || '';

  const systemPrompt = `You are a loop task execution agent for repeatable tasks that cycle infinitely. This task will return to the loop list after completion.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", list="doing", mode="loop", agentSessionStatus="ACTIVE"
2. **Execute Task**: Perform the task as described (no clarify/plan modes for loop tasks)
3. **FINISH**: Use Solo Unicorn MCP tool \`task_create\` with createdByTaskId="${task.id}", rawTitle="${titleSection}", rawDescription="${descriptionSection}", mode="loop", list="loop", setListOrder="LAST_IN_MODE" to create a new loop task positioned at the bottom of the loop queue; then use \`task_update\` with taskId="${task.id}", list="done", agentSessionStatus="INACTIVE"

**Note**: This creates a new loop task positioned at the bottom for fair rotation through all loop tasks.

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? `**Project Context**: ${JSON.stringify(project.memory)}` : ''}${task.plan ? `\n\n**Implementation Plan**:\n${JSON.stringify(task.plan, null, 2)}` : ''}`;

  const taskPrompt = `[loop] ${titleSection}
${descriptionSection ? `\n**Description**: ${descriptionSection}` : ''}

Execute this repeatable task.`;

  return { systemPrompt, taskPrompt };
}
