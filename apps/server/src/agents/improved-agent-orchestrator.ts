import { ClaudeCodeClient, ClaudeCodeSession, SessionOptions } from './claude-code-client';
import { PromptTemplateFactory, TaskContext } from './prompts/index';
import { db } from '../db/index';
import { tasks, sessions, repoAgents, actors, projects } from '../db/schema/simplified';
import { eq, and, sql } from 'drizzle-orm';

export interface AgentStatus {
  agentId: string;
  status: 'idle' | 'active' | 'rate_limited' | 'error';
  lastHeartbeat: Date;
  currentTaskId?: string;
  sessionId?: string;
}

export interface ImprovedAgentOrchestratorOptions {
  claudeCodeUrl: string;
  agentToken: string;
  taskPushEnabled?: boolean;
  heartbeatInterval?: number;
  availabilityTimeout?: number;
}

export class ImprovedAgentOrchestrator {
  private claudeCodeClient: ClaudeCodeClient;
  private isConnected = false;
  private agentStatuses = new Map<string, AgentStatus>();
  private taskPushEnabled: boolean;
  private heartbeatInterval: number;
  private availabilityTimeout: number;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private logger = {
    info: (msg: string, context?: any) => console.log(`[ImprovedOrchestrator] ${msg}`, context || ''),
    error: (msg: string, error?: any, context?: any) => console.error(`[ImprovedOrchestrator] ${msg}`, error?.message || error, context || ''),
    debug: (msg: string, context?: any) => {
      if (process.env.DEBUG_ORCHESTRATOR === 'true') {
        console.log(`[ImprovedOrchestrator-DEBUG] ${msg}`, context || '');
      }
    }
  };

  constructor(options: ImprovedAgentOrchestratorOptions) {
    this.claudeCodeClient = new ClaudeCodeClient({
      claudeCodeUrl: options.claudeCodeUrl,
      agentToken: options.agentToken
    });
    this.taskPushEnabled = options.taskPushEnabled ?? true;
    this.heartbeatInterval = options.heartbeatInterval ?? 30000; // 30 seconds
    this.availabilityTimeout = options.availabilityTimeout ?? 10000; // 10 seconds
  }

  async initialize() {
    try {
      await this.claudeCodeClient.connect();
      this.isConnected = true;
      this.logger.info('Agent Orchestrator initialized with push-based task assignment');
    } catch (error) {
      this.logger.error('Failed to connect to Claude Code UI', error);
      this.isConnected = false;
    }
    
    // Start monitoring agents and tasks
    this.startMonitoring();
  }

  private startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.updateAgentStatuses();
        
        if (this.taskPushEnabled) {
          await this.pushTasksToAvailableAgents();
        }
        
        await this.cleanupStaleData();
      } catch (error) {
        this.logger.error('Error in monitoring cycle', error);
      }
    }, this.heartbeatInterval);

    // Initial run
    setTimeout(() => this.updateAgentStatuses(), 1000);
  }

  private async updateAgentStatuses() {
    try {
      // Get all repo agents from database
      const allAgents = await db.query.repoAgents.findMany();
      
      for (const agent of allAgents) {
        const existingStatus = this.agentStatuses.get(agent.id);
        const now = new Date();
        
        // Check if agent has been inactive for too long
        if (existingStatus && 
            now.getTime() - existingStatus.lastHeartbeat.getTime() > this.availabilityTimeout) {
          // Mark as potentially stale
          this.logger.debug('Agent potentially stale', { 
            agentId: agent.id, 
            lastHeartbeat: existingStatus.lastHeartbeat,
            timeout: this.availabilityTimeout 
          });
        }

        // Update our tracking with database status
        this.agentStatuses.set(agent.id, {
          agentId: agent.id,
          status: agent.status,
          lastHeartbeat: existingStatus?.lastHeartbeat || now,
          currentTaskId: existingStatus?.currentTaskId,
          sessionId: existingStatus?.sessionId
        });
      }
    } catch (error) {
      this.logger.error('Error updating agent statuses', error);
    }
  }

  private async pushTasksToAvailableAgents() {
    try {
      // Get available agents (idle status and recent heartbeat)
      const availableAgents = Array.from(this.agentStatuses.values()).filter(status => {
        const isIdle = status.status === 'idle';
        const isRecent = Date.now() - status.lastHeartbeat.getTime() < this.availabilityTimeout;
        return isIdle && isRecent && !status.currentTaskId;
      });

      if (availableAgents.length === 0) {
        this.logger.debug('No available agents for task assignment');
        return;
      }

      // Get ready tasks ordered by priority
      const readyTasks = await db
        .select({
          task: tasks,
          repoAgent: repoAgents,
          actor: actors,
          project: projects
        })
        .from(tasks)
        .innerJoin(repoAgents, eq(tasks.repoAgentId, repoAgents.id))
        .leftJoin(actors, eq(tasks.actorId, actors.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.ready, true),
            eq(tasks.status, 'todo')
          )
        )
        .orderBy(
          sql`CASE ${tasks.priority}
              WHEN 'P5' THEN 1
              WHEN 'P4' THEN 2
              WHEN 'P3' THEN 3
              WHEN 'P2' THEN 4
              WHEN 'P1' THEN 5
              ELSE 6
            END`,
          tasks.createdAt
        );

      // Assign tasks to available agents
      for (const taskData of readyTasks) {
        const { task, repoAgent } = taskData;
        
        // Find available agent for this repo
        const availableAgent = availableAgents.find(agent => 
          agent.agentId === repoAgent.id && !agent.currentTaskId
        );

        if (availableAgent) {
          this.logger.info('Pushing task to available agent', {
            taskId: task.id,
            taskTitle: task.rawTitle,
            agentId: availableAgent.agentId,
            priority: task.priority
          });

          // Start the task assignment process
          await this.assignTaskToAgent(taskData, availableAgent);
          
          // Mark agent as busy in our tracking
          availableAgent.currentTaskId = task.id;
          availableAgent.status = 'active';
        }
      }
    } catch (error) {
      this.logger.error('Error pushing tasks to agents', error);
    }
  }

  private async assignTaskToAgent(taskData: any, agentStatus: AgentStatus) {
    const { task, repoAgent, actor, project } = taskData;

    try {
      // Update task status to doing with refine stage
      await db
        .update(tasks)
        .set({
          status: 'doing',
          stage: 'refine',
          updatedAt: new Date()
        })
        .where(eq(tasks.id, task.id));

      // Update agent status to active
      await db
        .update(repoAgents)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(repoAgents.id, agentStatus.agentId));

      // Create task context for prompt generation
      const taskContext: TaskContext = {
        id: task.id,
        projectId: task.projectId,
        rawTitle: task.rawTitle,
        rawDescription: task.rawDescription,
        refinedTitle: task.refinedTitle,
        refinedDescription: task.refinedDescription,
        plan: task.plan,
        priority: task.priority,
        attachments: task.attachments,
        actorDescription: actor?.description,
        projectMemory: project.memory,
        repoPath: repoAgent.repoPath
      };

      // Generate initial prompt with MCP workflow instructions
      const prompt = this.generateTaskPrompt(taskContext, 'refine');

      // Create session options with MCP tools
      const sessionOptions: SessionOptions = {
        projectPath: repoAgent.repoPath,
        cwd: repoAgent.repoPath,
        toolsSettings: {
          allowedTools: [
            'Read', 'Task', 'TodoWrite', 'Glob', 'Grep',
            'task.start', 'task.complete', 'cards.update', 
            'context.read', 'memory.update', 'agent.setAvailable'
          ],
          disallowedTools: [],
          skipPermissions: false
        },
        permissionMode: 'default'
      };

      // Start Claude session
      const sessionId = await this.claudeCodeClient.startSession(prompt, sessionOptions);

      // Create session record in database
      const [session] = await db.insert(sessions).values({
        claudeSessionId: sessionId,
        taskId: task.id,
        repoAgentId: repoAgent.id,
        status: 'active',
        startedAt: new Date()
      }).returning();

      // Update agent tracking
      agentStatus.sessionId = sessionId;

      this.logger.info('Task successfully assigned to agent', {
        taskId: task.id,
        agentId: agentStatus.agentId,
        sessionId,
        stage: 'refine'
      });

    } catch (error) {
      this.logger.error('Failed to assign task to agent', error, {
        taskId: task.id,
        agentId: agentStatus.agentId
      });
      
      // Reset task status on error
      await db
        .update(tasks)
        .set({ status: 'todo', stage: null, updatedAt: new Date() })
        .where(eq(tasks.id, task.id));

      // Reset agent status
      await db
        .update(repoAgents)
        .set({ status: 'idle', updatedAt: new Date() })
        .where(eq(repoAgents.id, agentStatus.agentId));

      // Clear from tracking
      agentStatus.currentTaskId = undefined;
      agentStatus.status = 'idle';
    }
  }

  private generateTaskPrompt(taskContext: TaskContext, stage: 'refine' | 'kickoff' | 'execute'): string {
    const basePrompt = PromptTemplateFactory.generatePrompt(stage, taskContext);
    
    const mcpInstructions = `
# MCP Workflow Instructions

You are working on a task in Solo Unicorn's agent orchestration system. Follow this workflow:

## Stage Workflow

### 1. Start Stage
- **FIRST ACTION**: Use \`task.start\` MCP tool to register that you're starting work on this task
- Include: taskId="${taskContext.id}", stage="${stage}"
- This updates the task status and creates/updates your session

### 2. Perform Stage Work
${this.getStageSpecificInstructions(stage)}

### 3. Complete Stage  
- **FINAL ACTION**: Use \`task.complete\` MCP tool to finish the stage
- Options:
  - \`markDone: true\` - If task is completely finished (execute stage only)
  - \`nextStage: "kickoff"\` - If advancing from refine to kickoff
  - \`nextStage: "execute"\` - If advancing from kickoff to execute
  - \`stageComplete: true\` - If just completing current stage

### 4. Signal Availability
- After completing the task or if you encounter errors, use \`agent.setAvailable\` to signal you're ready for new work

## Important Notes
- Always start with \`task.start\` and end with \`task.complete\`
- Use \`cards.update\` to save intermediate progress
- Use \`context.read\` to get additional task/project information if needed
- Use \`memory.update\` to update project memory with learnings

Current Task: ${taskContext.rawTitle}
Current Stage: ${stage}
Task ID: ${taskContext.id}
`;

    return mcpInstructions + '\n\n' + basePrompt;
  }

  private getStageSpecificInstructions(stage: string): string {
    switch (stage) {
      case 'refine':
        return `- Understand and clarify the task requirements
- Update task with refined title and description using \`cards.update\`
- Gather any needed context with \`context.read\``;
      
      case 'kickoff':
        return `- Analyze solution options and select the best approach  
- Create a detailed implementation plan
- Update task plan using \`cards.update\``;
      
      case 'execute':
        return `- Implement the solution according to the plan
- Make code changes, run tests, commit work
- Update project memory if needed with \`memory.update\``;
      
      default:
        return '- Follow the task requirements';
    }
  }

  private async cleanupStaleData() {
    const now = new Date();
    const staleTimeout = 30 * 60 * 1000; // 30 minutes

    try {
      // Clean up stale sessions
      const staleSessions = await db.query.sessions.findMany({
        where: eq(sessions.status, 'active')
      });

      for (const session of staleSessions) {
        const sessionAge = now.getTime() - session.startedAt.getTime();
        if (sessionAge > staleTimeout) {
          await db
            .update(sessions)
            .set({ status: 'failed', completedAt: now })
            .where(eq(sessions.id, session.id));

          // Reset associated task
          await db
            .update(tasks)
            .set({ status: 'todo', stage: null, ready: false, updatedAt: now })
            .where(eq(tasks.id, session.taskId));

          // Reset agent status
          await db
            .update(repoAgents)
            .set({ status: 'idle', updatedAt: now })
            .where(eq(repoAgents.id, session.repoAgentId));

          this.logger.info('Cleaned up stale session', {
            sessionId: session.id,
            taskId: session.taskId,
            ageMinutes: Math.round(sessionAge / 60000)
          });
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up stale data', error);
    }
  }

  // Called by MCP server when agent reports availability
  async onAgentAvailable(agentId: string) {
    this.logger.debug('Agent reported available', { agentId });
    
    const agentStatus = this.agentStatuses.get(agentId);
    if (agentStatus) {
      agentStatus.status = 'idle';
      agentStatus.lastHeartbeat = new Date();
      agentStatus.currentTaskId = undefined;
      agentStatus.sessionId = undefined;
    }

    // Trigger immediate task push check for this agent
    if (this.taskPushEnabled) {
      setTimeout(() => this.pushTasksToAvailableAgents(), 1000);
    }
  }

  // Called by MCP server when task is started
  async onTaskStarted(agentId: string, taskId: string, sessionId?: string) {
    this.logger.debug('Task started by agent', { agentId, taskId, sessionId });
    
    const agentStatus = this.agentStatuses.get(agentId);
    if (agentStatus) {
      agentStatus.status = 'active';
      agentStatus.currentTaskId = taskId;
      agentStatus.sessionId = sessionId;
      agentStatus.lastHeartbeat = new Date();
    }
  }

  // Called by MCP server when task is completed
  async onTaskCompleted(agentId: string, taskId: string, success: boolean) {
    this.logger.debug('Task completed by agent', { agentId, taskId, success });
    
    const agentStatus = this.agentStatuses.get(agentId);
    if (agentStatus) {
      agentStatus.currentTaskId = undefined;
      agentStatus.sessionId = undefined;
      agentStatus.lastHeartbeat = new Date();
      
      // Agent will explicitly call setAvailable, but we can mark as idle here too
      if (success) {
        agentStatus.status = 'idle';
      }
    }
  }

  async shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.claudeCodeClient.disconnect();
    this.agentStatuses.clear();
  }
}