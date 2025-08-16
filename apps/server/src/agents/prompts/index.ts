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

const defaultActorDescription = 'Startup founder and fullstack software engineer focused on speed to market. Think small. Ignore performance, cost, and scalability. Basic auth and access control is still essential. Obsessed with UX - less frictions; max magics.';

export interface PromptTemplate {
  stage: 'refine' | 'kickoff' | 'execute';
  generate(context: TaskContext): string;
}

export class RefinePrompt implements PromptTemplate {
  stage: 'refine' = 'refine';

  generate(context: TaskContext): string {
    const { rawTitle, rawDescription, actorDescription, projectMemory } = context;

    return `[${this.stage}] ${context.rawTitle}
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
5. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", stage="kickoff", isAiWorking=false, refinedTitle=[from above], refinedDescription=[from above]

**Your Role**: ${actorDescription || defaultActorDescription}
${projectMemory ? '**Project Context**: ' + projectMemory : ''}

**Task to Refine**:
- **Raw Title**: ${rawTitle}
- **Raw Description**: ${rawDescription || 'No description provided'}`;
  }
}

export class KickoffPrompt implements PromptTemplate {
  stage: 'kickoff' = 'kickoff';

  generate(context: TaskContext): string {
    const { refinedTitle, refinedDescription, actorDescription, projectMemory } = context;

    return `[${this.stage}] ${context.rawTitle}
**Do not write any code!**
Kickoff a task - create a comprehensive implementation plan and detailed specification.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", status="doing", stage="kickoff", isAiWorking=true
2. **List Solution Options**: List viable potential solution options
3. **Evaluate and Rank**: Compare the options considering in order of importance:
   - Most importantly - UX
   - Alignment with project goals
   - Design simplicity
   - Industry standards & best practices
   - Maintainability
4. **Select Final Approach**: Choose the best solution
5. **Create Plan**: Write a detailed plan including:
   - Spec
   - Detailed implementation steps
   - Potential risks and mitigations (only if necessary)
6. **Evaluate Plan Complexity**: After creating your plan, evaluate if it exceeds manageable limits:
   - Count implementation steps (exclude planning/analysis steps)
   - Estimate total lines of code changes across all files
   - If plan has >6 implementation steps OR >600 lines of code changes:
     * Split into smaller tasks (each <6 steps AND <600 lines)
     * Use Solo Unicorn MCP tool \`task_create\` for each split task with:
       - projectId="${context.projectId}"
       - repoAgentId=same as current task
       - actorId=same as current task
       - refinedTitle=specific task title
       - refinedDescription=specific task description
       - plan=specific subtask plan
       - priority=same as current task
       - stage="execute" (skip refine/kickoff)
       - dependsOn=[previous split task IDs for dependency chain]
     * Update current task to become a coordination task with updated plan
7. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", stage="execute", isAiWorking=false, plan=[from above]

**Your Role**: ${actorDescription || defaultActorDescription}
${projectMemory ? '**Project Context**: ' + projectMemory : ''}

**Task to Plan**:
- **Title**: ${refinedTitle || context.rawTitle}
- **Description**: ${refinedDescription || context.rawDescription || 'No description provided'}`;
  }
}

export class ExecutePrompt implements PromptTemplate {
  stage: 'execute' = 'execute';

  generate(context: TaskContext): string {
    const { refinedTitle, refinedDescription, plan, actorDescription, projectMemory, repoPath } = context;

    const planSummary = plan ? JSON.stringify(plan) : 'No plan available';

    return `[${this.stage}] ${context.rawTitle}
Implement the solution following the plan below.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", status="doing", stage="execute", isAiWorking=true
2. **Follow the Plan**: Implement the solution as specified in the plan above
3. **Commit Changes**: Make appropriate git commits when needed
4. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${context.id}", status="done", stage=null, isAiWorking=false

**Your Role**: ${actorDescription || defaultActorDescription}
${projectMemory ? '**Project Context**: ' + projectMemory : ''}

**Task to Implement**:
- **Title**: ${refinedTitle || context.rawTitle}
- **Description**: ${refinedDescription || context.rawDescription || 'No description provided'}

**Implementation Plan**:
${planSummary}
}`;
  }
}

export class PromptTemplateFactory {
  static create(stage: 'refine' | 'kickoff' | 'execute' | null): PromptTemplate {
    switch (stage) {
      case null:
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
