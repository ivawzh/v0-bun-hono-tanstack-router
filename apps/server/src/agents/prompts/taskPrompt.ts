import type { Task } from "@/db/schema";
import { defaultActorDescription } from "./defaultActor";
import type { PromptParams } from "./index";

export function taskPrompt(mode: string, context: PromptParams, { insert }: { insert: string } = { insert: "" }) {
  const { task, actor, project } = context;
  const promptContent = `
[${mode}] ${task.rawTitle || task.refinedTitle}

**## Task information**
- **Task ID (task.id)**: ${task.id}
- **Task Priority (task.priority)**: ${task.priority}
- ${task.refinedTitle ? "**Refined Title (AI written)**: " + task.refinedTitle : ""}
- ${task.refinedDescription ? "**Refined Description (AI written)**: " + task.refinedDescription : ""}
- ${task.rawTitle ? "**Raw Title (Human written)**: " + task.rawTitle : ""}
- ${task.rawDescription ? "**Raw Description (Human written)**: " + task.rawDescription : ""}
- ${task.plan ? "**Task Plan ('task.plan'. AI written)**: " + JSON.stringify(task.plan) : ""}

${insert ? "## Extra information\n" + insert.trim() : ""}

**## Other information**
**Your acting character description**: ${actor?.description || defaultActorDescription}
${project.memory ? "**Project Context**: " + project.memory : ""}
`;

  return promptContent.trim().replace(/\n{2,}/g, '\n');
}
