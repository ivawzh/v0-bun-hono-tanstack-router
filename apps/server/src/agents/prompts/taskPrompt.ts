import { defaultActorDescription } from "./defaultActor";
import type { PromptParams } from "./index";
import { match } from "ts-pattern";

export function taskPrompt(
  mode: string,
  context: PromptParams,
  { insert }: { insert: string } = { insert: "" }
) {
  const { task, actor, project, taskIterations } = context;

  // Check if this is an iteration (has taskIterations with feedback)
  const isIteration = taskIterations && taskIterations.length > 0;

  const promptContent = match(isIteration)
  .with(false, () => {
    // Default format for regular (non-iteration) tasks
    return `
[${mode}] ${task.rawTitle || task.refinedTitle}

**## Task information**
- **Task ID (task.id)**: ${task.id}
- **Task Priority (task.priority)**: ${task.priority}
- ${task.refinedTitle ? "**Refined Title (AI written)**: " + task.refinedTitle : ""}
- ${task.refinedDescription ? "**Refined Description (AI written)**: " + task.refinedDescription : ""}
- ${task.rawTitle ? "**Raw Title (Human written)**: " + task.rawTitle : ""}
- ${task.rawDescription ? "**Raw Description (Human written)**: " + task.rawDescription : ""}
- ${task.plan ? "**Task Plan ('task.plan'. AI written)**: " + JSON.stringify(task.plan) : ""}
- ${task.checkInstruction ? "**Human Review Instructions ('task.checkInstruction'. AI written)**: " + JSON.stringify(task.checkInstruction) : ""}

${insert ? "## Extra information\n" + insert.trim() : ""}

**## Other information**
**Your acting character description**: ${actor?.description || defaultActorDescription}
${project.memory ? "**Project Context**: " + project.memory : ""}
`;
  })
    .with(true, () => {
      // Display iteration-aware format similar to old iterate prompt
      const prevIterations = taskIterations.slice(0, -1);
      const currentIteration = taskIterations[taskIterations.length - 1];
      const planSummary = task.plan
        ? JSON.stringify(task.plan)
        : "No plan available";

      return `
[${mode}] ${task.rawTitle || task.refinedTitle}

**Task ID (task.id)**: ${task.id}

**Current iteration number (currentIteration.iterationNumber)**: #${currentIteration.iterationNumber}
**MOST IMPORTANT - Current iteration feedback**: ${currentIteration.feedback}

**Your acting character description**: ${actor?.description || defaultActorDescription}
${project.memory ? "**Project Context**: " + project.memory : ""}

---------

**ALL INFORMATION BELOW ARE OLD FROM PREVIOUS ITERATIONS**

**Old task information**:
- ${task.refinedTitle ? "**Refined Title (AI written)**: " + task.refinedTitle : ""}
- ${task.refinedDescription ? "**Refined Description (AI written)**: " + task.refinedDescription : ""}
- ${task.rawTitle ? "**Raw Title (Human written)**: " + task.rawTitle : ""}
- ${task.rawDescription ? "**Raw Description (Human written)**: " + task.rawDescription : ""}

**Old Task Plan ('task.plan'. AI written) we Implemented from the previous iteration(s)**:
${planSummary}

${task.checkInstruction ? "**Human Review Instructions ('task.checkInstruction'. AI written)**: " + JSON.stringify(task.checkInstruction) : ""}

**Old feedback from the previous iteration(s)**:
${prevIterations.map((iteration) => `- **Iteration ${iteration.iterationNumber}**: ${iteration.feedback.length > 500 ? iteration.feedback.slice(0, 500) + "(truncated...)" : iteration.feedback}`).join("\n")}

${insert ? "## Extra information\n" + insert.trim() : ""}
`;
    })
    .exhaustive();

  return promptContent.trim().replace(/\n{2,}/g, "\n");
}
