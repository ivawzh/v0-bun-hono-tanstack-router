/**
 * Execute Mode Prompt Template
 * Used when agents need to implement solutions
 */

import { defaultActorDescription } from './defaultActor';
import { defaultCommitAuthorName } from './defaultCommitAuthorName';
import type { PromptParams } from './index';

export function generateExecutePrompt(context: PromptParams): string {
  const { task, actor, project, agent, webUrl, taskIterations } = context;

  const planSummary = task.plan ? JSON.stringify(task.plan) : 'No plan available';
  const commitAuthorName = defaultCommitAuthorName(agent.agentType);
  
  // Build iteration context if this task has been rejected before
  const iterationContext = taskIterations && taskIterations.length > 0 
    ? `\n\n**Previous Iterations & Feedback**:
${taskIterations.map(iteration => 
  `- **Iteration ${iteration.iterationNumber}**: ${iteration.feedbackReason} (rejected by ${iteration.rejectedBy})`
).join('\n')}

**Important**: This task has been previously rejected. Please carefully address the feedback above in your implementation.`
    : '';

  return `[execute] ${task.rawTitle || task.refinedTitle}
Implement the solution following the plan below.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", list="doing", mode="execute", agentSessionStatus="ACTIVE"
2. **Follow the Plan**: Implement the solution as specified in the plan above
3. **Commit Changes**: When making git commits, use author "${commitAuthorName}" to maintain consistent Solo Unicorn branding. Include the task URL as the second line in commit messages: ${webUrl}/projects/${project.id}/tasks/${task.id}
4. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", list="check", mode=null, agentSessionStatus="INACTIVE"

**Check Mode Expectations**:
- Your completed work will go to the check column for human review before final approval
- Ensure implementation is complete, tested, and production-ready
- Include clear commit messages explaining what was implemented
- Address all requirements from the plan and any previous feedback

**Your Role**: ${actor?.description || defaultActorDescription}
${project.memory ? '**Project Context**: ' + project.memory : ''}

**Task to Implement**:
- **Title**: ${task.refinedTitle || task.rawTitle}
- **Description**: ${task.refinedDescription || task.rawDescription || 'No description provided'}

**Implementation Plan**:
${planSummary}${iterationContext}`;
}
