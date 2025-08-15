export interface TaskContext {
  id: string;
  projectId: string;
  rawTitle: string;
  rawDescription?: string;
  refinedTitle?: string;
  refinedDescription?: string;
  plan?: any;
  priority: string;
  attachments?: any[];
  actorDescription?: string;
  projectMemory?: string;
  repoPath: string;
}

export interface PromptTemplate {
  stage: 'refine' | 'kickoff' | 'execute';
  generate(context: TaskContext): string;
}

export class RefinePrompt implements PromptTemplate {
  stage: 'refine' = 'refine';

  generate(context: TaskContext): string {
    const { rawTitle, rawDescription, actorDescription, projectMemory } = context;
    
    return `You are working on task refinement for the Solo Unicorn project management system.

**Your Role**: ${actorDescription || 'Full-Stack Engineering Agent focused on working solutions over perfect code'}

**Project Context**:
${projectMemory || 'No additional project context provided'}

**Task to Refine**:
- **Raw Title**: ${rawTitle}
- **Raw Description**: ${rawDescription || 'No description provided'}
- **Priority**: P${context.priority} (1=Lowest, 5=Highest)

**Your Task - Stage 1: REFINE**
You need to understand and refine this raw task into clear, actionable requirements.

**Instructions**:
1. Analyze the raw title and description to understand the user's intent
2. Create a refined title that is clear and specific
3. Write a detailed refined description that includes:
   - What needs to be implemented/fixed/changed
   - Key requirements and constraints
   - Expected outcome
4. Use your MCP tools to update the task with refined information

**MCP Tools Available**:
- Use \`cards.update\` to update the task with refined title and description
- Use \`context.read\` to get more project information if needed

Please start by refining this task. Focus on clarity and actionability.`;
  }
}

export class KickoffPrompt implements PromptTemplate {
  stage: 'kickoff' = 'kickoff';

  generate(context: TaskContext): string {
    const { refinedTitle, refinedDescription, actorDescription, projectMemory } = context;
    
    return `You are working on solution planning for the Solo Unicorn project management system.

**Your Role**: ${actorDescription || 'Full-Stack Engineering Agent focused on working solutions over perfect code'}

**Project Context**:
${projectMemory || 'No additional project context provided'}

**Task to Plan**:
- **Title**: ${refinedTitle || context.rawTitle}
- **Description**: ${refinedDescription || context.rawDescription || 'No description provided'}
- **Priority**: P${context.priority} (1=Lowest, 5=Highest)

**Your Task - Stage 2: KICKOFF**
You need to create a detailed implementation plan with solution options.

**Instructions**:
1. **Analyze the Requirements**: Review the refined task details
2. **List Solution Options**: Propose 2-3 different approaches to solve this task
3. **Evaluate and Rank**: Compare the options considering:
   - Implementation complexity
   - Time to completion
   - Maintainability
   - Alignment with project goals
4. **Select Final Approach**: Choose the best solution and explain why
5. **Create Implementation Spec**: Write a detailed specification including:
   - Step-by-step implementation plan
   - Key components to create/modify
   - Dependencies and prerequisites
   - Testing approach
   - Potential risks and mitigations

**MCP Tools Available**:
- Use \`cards.update\` to save your plan in the task's plan field
- Use \`context.read\` to explore the codebase if needed
- Use \`memory.update\` to update project memory with learnings

Please start by creating a comprehensive implementation plan for this task.`;
  }
}

export class ExecutePrompt implements PromptTemplate {
  stage: 'execute' = 'execute';

  generate(context: TaskContext): string {
    const { refinedTitle, refinedDescription, plan, actorDescription, projectMemory, repoPath } = context;
    
    const planSummary = plan ? JSON.stringify(plan, null, 2) : 'No plan available';
    
    return `You are working on task implementation for the Solo Unicorn project management system.

**Your Role**: ${actorDescription || 'Full-Stack Engineering Agent focused on working solutions over perfect code'}

**Project Context**:
${projectMemory || 'No additional project context provided'}

**Repository Path**: ${repoPath}

**Task to Implement**:
- **Title**: ${refinedTitle || context.rawTitle}
- **Description**: ${refinedDescription || context.rawDescription || 'No description provided'}
- **Priority**: P${context.priority} (1=Lowest, 5=Highest)

**Implementation Plan**:
\`\`\`json
${planSummary}
\`\`\`

**Your Task - Stage 3: EXECUTE**
Now implement the solution according to the plan created in the kickoff stage.

**Instructions**:
1. **Follow the Plan**: Implement the solution as specified in the plan above
2. **Write Code**: Create, modify, or fix the necessary code files
3. **Test Implementation**: Ensure the solution works as expected
4. **Commit Changes**: Make appropriate git commits as you progress
5. **Update Task**: Mark the task as complete when finished

**Key Guidelines**:
- Follow existing code patterns and conventions in the codebase
- Write clean, maintainable code
- Add appropriate comments where needed
- Test your changes before committing
- Make atomic commits with clear messages

**MCP Tools Available**:
- Use standard coding tools (Read, Write, Edit, Bash, etc.)
- Use \`cards.update\` to update task status when complete
- Use \`memory.update\` to record any important learnings

Please start implementing the solution. Focus on delivering working code that solves the problem effectively.`;
  }
}

export class PromptTemplateFactory {
  static create(stage: 'refine' | 'kickoff' | 'execute'): PromptTemplate {
    switch (stage) {
      case 'refine':
        return new RefinePrompt();
      case 'kickoff':
        return new KickoffPrompt();
      case 'execute':
        return new ExecutePrompt();
      default:
        throw new Error(`Unknown stage: ${stage}`);
    }
  }

  static generatePrompt(stage: 'refine' | 'kickoff' | 'execute', context: TaskContext): string {
    const template = this.create(stage);
    return template.generate(context);
  }
}