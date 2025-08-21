/**
 * Talk Mode Prompt
 * For brainstorming, research, planning, and discussion tasks that require NO code writing
 */

import { type PromptParams } from '.';

/**
 * Generate prompt for talk mode tasks
 * These tasks focus on thinking, research, and documentation without any code implementation
 */
export function generateTalkPrompt({ task, actor, project }: PromptParams): string {
  const actorContext = actor ? `
**Your Role**: ${actor.name}
${actor.description}
` : `
**Your Role**: Assistant focused on research, analysis, and strategic thinking
`;

  const projectMemory = project.memory && typeof project.memory === 'object' && Object.keys(project.memory).length > 0
    ? `**Project Context**: ${JSON.stringify(project.memory, null, 2)}`
    : '';

  return `[talk] ${task.refinedTitle || task.rawTitle}

${actorContext}

${projectMemory}

**Task to Work On**:
- **Title**: ${task.refinedTitle || task.rawTitle}
- **Description**: ${task.refinedDescription || task.rawDescription || 'No description provided'}

**CRITICAL INSTRUCTIONS - TALK MODE RULES**:
🚫 **NO CODE WRITING ALLOWED** - This is a "talk" mode task focused on thinking, research, and discussion only
🚫 **NO IMPLEMENTATION** - Do not write, modify, or suggest specific code implementations
🚫 **NO TECHNICAL EXECUTION** - Focus purely on conceptual work, analysis, and planning

**What You CAN Do**:
✅ Research and analyze the topic
✅ Brainstorm ideas and approaches
✅ Create strategic plans and recommendations
✅ Document findings and insights
✅ Discuss trade-offs and considerations
✅ Provide architectural guidance at high level
✅ Create specifications and requirements

**Required Output**:
1. **Analysis**: Break down the request and analyze the key aspects
2. **Research**: Gather relevant information and context
3. **Findings**: Document your insights and discoveries
4. **Recommendations**: Provide clear, actionable recommendations
5. **Next Steps**: Suggest what should happen next (if applicable)

**Document Creation**:
You MUST create a markdown document to record your work:
- Create file at: \`doc/talk/[descriptive-name].md\` (relative to project root)
- Use a descriptive filename based on the task topic
- Include all analysis, findings, and recommendations
- Structure with clear headings and sections

**Example Document Structure**:
\`\`\`markdown
# [Task Title]

## Original Request
[The original task request]

## Analysis
[Your analysis of the topic]

## Research & Findings
[What you discovered]

## Recommendations
[Your recommendations]

## Next Steps
[Suggested follow-up actions]

## Conclusion
[Summary of key points]
\`\`\`

**Remember**: This is pure thinking work. No code, no implementation, just research, analysis, and strategic thinking. Your output should be comprehensive documentation that provides value through insights and recommendations.

When complete, update your task list to "done" while maintaining mode="talk" using the MCP tool.`;
}
