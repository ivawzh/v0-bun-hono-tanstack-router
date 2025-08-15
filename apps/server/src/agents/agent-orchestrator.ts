import { ClaudeCodeClient } from './claude-code-client';
import type { SessionOptions } from './claude-code-client';
import { PromptTemplateFactory } from './prompts/index';
import type { TaskContext } from './prompts/index';
import { db } from '../db/index';
import { tasks, sessions, repoAgents, actors, projects, agentClients } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface AgentStatus {
  agentId: string;
  status: 'idle' | 'active' | 'rate_limited' | 'error';
  lastHeartbeat: Date;
  currentTaskId?: string;
  sessionId?: string;
}

export type AgentClientVacancy = 'Busy' | 'Free' | null;

export interface AgentOrchestratorOptions {
  claudeCodeUrl: string;
  agentToken: string;
  taskPushEnabled?: boolean;
  heartbeatInterval?: number;
  availabilityTimeout?: number;
}

export class AgentOrchestrator {
  private claudeCodeClient: ClaudeCodeClient;
  private isConnected = false;
  private agentStatuses = new Map<string, AgentStatus>();
  private taskPushEnabled: boolean;
  private heartbeatInterval: number;
  private availabilityTimeout: number;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private taskPushingInterval: NodeJS.Timeout | null = null;
  private logger = {
    info: (msg: string, context?: any) => console.log(`[AgentOrchestrator] ${msg}`, context || ''),
    error: (msg: string, error?: any, context?: any) => console.error(`[AgentOrchestrator] ${msg}`, error?.message || error, context || ''),
    debug: (msg: string, context?: any) => {
      if (process.env.DEBUG_ORCHESTRATOR === 'true') {
        console.log(`[ImprovedOrchestrator-DEBUG] ${msg}`, context || '');
      }
    }
  };

  constructor(options: AgentOrchestratorOptions) {
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

    // Start task pushing
    this.startTaskPushing();
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

  private startTaskPushing() {
    if (this.taskPushingInterval) {
      clearInterval(this.taskPushingInterval);
    }

    this.taskPushingInterval = setInterval(async () => {
      try {
        await this.checkAndPushTasks();
      } catch (error) {
        this.logger.error('Error checking and pushing tasks', error);
      }
    }, 1000); // Every 1 second
  }

  private async calculateAgentClientVacancy(agentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE'): Promise<AgentClientVacancy> {
    try {
      // Get agent client from database
      const agentRecords = await db.select().from(agentClients).where(eq(agentClients.type, agentType));

      if (agentRecords.length === 0) {
        // No agent record found, consider as Free
        return null;
      }

      const agent = agentRecords[0];
      const state = agent.state as any || {};
      const now = new Date().getTime();

      // Check rate limit
      if (state.rateLimitResetAt) {
        const resetTime = new Date(state.rateLimitResetAt).getTime();
        if (resetTime > now) {
          // Still rate limited
          return 'Busy';
        }
      }

      // Check if we recently pushed a task (must be more than 20 seconds ago to be free)
      if (state.lastTaskPushedAt) {
        const lastPushTime = new Date(state.lastTaskPushedAt).getTime();
        const timeSinceLastPush = now - lastPushTime;

        if (timeSinceLastPush <= 20 * 1000) { // Less than 20 seconds
          return 'Busy';
        }
      }

      // Check last message time (must be more than 1 minute ago to be free)
      if (state.lastMessagedAt) {
        const lastMessageTime = new Date(state.lastMessagedAt).getTime();
        const timeSinceLastMessage = now - lastMessageTime;

        if (timeSinceLastMessage <= 60 * 1000) { // Less than 1 minute
          return 'Busy';
        }

        // Check if session completed at same time as last message and more than 5 seconds ago
        if (state.lastSessionCompletedAt) {
          const sessionCompletedTime = new Date(state.lastSessionCompletedAt).getTime();
          const timeSinceCompletion = now - sessionCompletedTime;

          // If session completed at same time as last message (within 1 second tolerance)
          if (Math.abs(sessionCompletedTime - lastMessageTime) <= 1000) {
            if (timeSinceCompletion <= 5 * 1000) { // Less than 5 seconds since completion
              return 'Busy';
            }
          }
        }
      }

      return 'Free';
    } catch (error) {
      this.logger.error('Error calculating agent vacancy', error);
      return 'Free'; // Default to free on error
    }
  }

  private async checkAndPushTasks() {
    // Check if any targeted agent clients are free and push tasks to them
    const agentTypes: ('CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE')[] = ['CLAUDE_CODE', 'CURSOR_CLI', 'OPENCODE'];

    for (const agentType of agentTypes) {
      const vacancy = await this.calculateAgentClientVacancy(agentType);

      if (vacancy === 'Free') {
        // Agent is free, try to push tasks to it
        this.logger.debug(`[AgentOrchestrator] Agent ${agentType} is free, checking for tasks to push`);

        // Trigger task push for this specific agent type
        await this.pushTasksToSpecificAgentType(agentType);
      }
    }
  }

  private async pushTasksToSpecificAgentType(targetAgentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE') {
    try {
      // Get ready tasks ordered by priority for the specific agent type
      const readyTasks = await db
        .select({
          task: tasks,
          repoAgent: repoAgents,
          actor: actors,
          project: projects,
          agentClient: agentClients
        })
        .from(tasks)
        .innerJoin(repoAgents, eq(tasks.repoAgentId, repoAgents.id))
        .innerJoin(agentClients, eq(repoAgents.agentClientId, agentClients.id))
        .leftJoin(actors, eq(tasks.actorId, actors.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.ready, true),
            eq(tasks.isAiWorking, false),
            eq(agentClients.type, targetAgentType)
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
          sql`CAST(${tasks.columnOrder} AS DECIMAL)`,
          tasks.createdAt
        )
        .limit(1); // Only get the highest priority task

      if (readyTasks.length === 0) {
        this.logger.debug(`No ready tasks found for agent type ${targetAgentType}`);
        return;
      }

      const taskData = readyTasks[0];

      // Check if we can assign to an available agent
      const availableAgents = Array.from(this.agentStatuses.values()).filter(status => {
        const isIdle = status.status === 'idle';
        const hasNoCurrentTask = !status.currentTaskId;
        const isTargetAgent = status.agentId === taskData.repoAgent.id;
        const isConnected = this.isConnected;

        return isIdle && hasNoCurrentTask && isTargetAgent && isConnected;
      });

      if (availableAgents.length > 0) {
        const availableAgent = availableAgents[0];

        this.logger.info(`[AgentOrchestrator]Pushing task to ${targetAgentType} agent`, {
          taskId: taskData.task.id,
          taskTitle: taskData.task.rawTitle,
          agentId: availableAgent.agentId,
          priority: taskData.task.priority
        });

        // Assign the task to the available agent
        await this.assignTaskToAgent(taskData, availableAgent);

        // Mark agent as busy in our tracking
        availableAgent.currentTaskId = taskData.task.id;
        availableAgent.status = 'active';
      }
    } catch (error) {
      this.logger.error(`[AgentOrchestrator]Error pushing tasks to ${targetAgentType}`, error);
    }
  }

  private async updateAgentStatuses() {
    try {
      // Get all repo agents from database with agent client info
      const allAgents = await db.query.repoAgents.findMany({
        with: {
          agentClient: true
        }
      });

      for (const agent of allAgents) {
        const existingStatus = this.agentStatuses.get(agent.id);
        const now = new Date();

        // Determine agent status based on agentClient state and connection
        const agentState = agent.agentClient?.state as any || {};
        let currentStatus: 'idle' | 'active' | 'rate_limited' | 'error' = 'idle';

        // Check if rate limited
        if (agentState.rateLimitResetAt) {
          const resetTime = new Date(agentState.rateLimitResetAt).getTime();
          if (resetTime > now.getTime()) {
            currentStatus = 'rate_limited';
          }
        }

        // Check if recently active based on last message time
        if (agentState.lastMessagedAt) {
          const lastMessageTime = new Date(agentState.lastMessagedAt).getTime();
          const timeSinceLastMessage = now.getTime() - lastMessageTime;
          
          if (timeSinceLastMessage <= 60 * 1000) { // Less than 1 minute
            currentStatus = 'active';
          }
        }

        // For Claude Code agents, rely on agentClient state and MCP communication
        if (agent.agentClient?.type === 'CLAUDE_CODE' && this.isConnected) {
          // Check if it was recently active and might have just completed
          if (existingStatus?.status === 'active' &&
              now.getTime() - existingStatus.lastHeartbeat.getTime() < 10000) { // 10 seconds
            this.logger.debug('Agent recently completed work, using state-derived status', { agentId: agent.id, derivedStatus: currentStatus });
          }
        }

        // Check if agent has been inactive for too long
        if (existingStatus &&
            now.getTime() - existingStatus.lastHeartbeat.getTime() > this.availabilityTimeout &&
            currentStatus === 'active') {
          // Mark as potentially stale only if currently active
          this.logger.debug('Agent potentially stale', {
            agentId: agent.id,
            lastHeartbeat: existingStatus.lastHeartbeat,
            timeout: this.availabilityTimeout
          });
          // Force to idle if stale
          currentStatus = 'idle';
        }

        // Note: Status is now tracked in memory only, not persisted to database

        // Update our tracking
        this.agentStatuses.set(agent.id, {
          agentId: agent.id,
          status: currentStatus,
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
      // First, trigger a fresh status update to get latest availability
      await this.updateAgentStatuses();

      // Get available agents (idle status and no current task)
      const availableAgents = Array.from(this.agentStatuses.values()).filter(status => {
        const isIdle = status.status === 'idle';
        const hasNoCurrentTask = !status.currentTaskId;
        // For Claude Code agents, also check if we're connected to the WebSocket
        const isConnected = this.isConnected;

        this.logger.debug('Agent availability check', {
          agentId: status.agentId,
          isIdle,
          hasNoCurrentTask,
          isConnected,
          status: status.status
        });

        return isIdle && hasNoCurrentTask && isConnected;
      });

      if (availableAgents.length === 0) {
        this.logger.debug('No available agents for task assignment', {
          totalAgents: this.agentStatuses.size,
          isConnected: this.isConnected
        });
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
            eq(tasks.status, 'todo'),
            eq(tasks.isAiWorking, false)
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
          sql`CAST(${tasks.columnOrder} AS DECIMAL)`,
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
          updatedAt: new Date()
        })
        .where(eq(tasks.id, task.id));

      // Note: Agent status is now tracked in agentClients.state via MCP calls

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

      // Generate prompt for refine stage
      const prompt = PromptTemplateFactory.generatePrompt('refine', taskContext);

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
        agentSessionId: sessionId,
        taskId: task.id,
        repoAgentId: repoAgent.id,
        status: 'active',
        startedAt: new Date()
      }).returning();

      // Update agent client's lastTaskPushedAt timestamp in state to prevent duplicate task pushing
      const agentClient = await db.query.agentClients.findFirst({
        where: eq(agentClients.id, repoAgent.agentClientId)
      });
      
      if (agentClient) {
        const currentState = agentClient.state as any || {};
        await db
          .update(agentClients)
          .set({ 
            state: { 
              ...currentState, 
              lastTaskPushedAt: new Date().toISOString() 
            }, 
            updatedAt: new Date() 
          })
          .where(eq(agentClients.id, repoAgent.agentClientId));
      }

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

      // Note: Agent status reset is now handled via MCP calls to agentClients.state

      // Clear from tracking
      agentStatus.currentTaskId = undefined;
      agentStatus.status = 'idle';
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

          // Reset associated task if it exists
          if (session.taskId) {
            await db
              .update(tasks)
              .set({ status: 'todo', stage: null, ready: false, updatedAt: now })
              .where(eq(tasks.id, session.taskId));
          }

          // Note: Agent status reset is now handled via MCP calls to agentClients.state

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

  // Called when a task becomes ready (triggered by toggle ready mutation)
  async onTaskReady(taskId: string) {
    this.logger.info('Task marked as ready, checking for available agents', { taskId });

    // Trigger immediate task assignment check
    if (this.taskPushEnabled) {
      setTimeout(() => this.pushTasksToAvailableAgents(), 500);
    }
  }

  async shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.taskPushingInterval) {
      clearInterval(this.taskPushingInterval);
    }
    this.claudeCodeClient.disconnect();
    this.agentStatuses.clear();
  }
}
