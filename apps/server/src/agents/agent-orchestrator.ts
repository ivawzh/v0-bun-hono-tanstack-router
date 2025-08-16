import { ClaudeCodeClient } from './claude-code-client';
import type { SessionOptions } from './claude-code-client';
import { PromptTemplateFactory } from './prompts/index';
import type { TaskContext } from './prompts/index';
import { db } from '../db/index';
import { tasks, sessions, repoAgents, actors, projects, agentClients, taskDependencies } from '../db/schema';
import { eq, and, sql, ne, desc, notExists } from 'drizzle-orm';

export type AgentClientVacancy = 'Busy' | 'Free' | null;

export interface AgentOrchestratorOptions {
  claudeCodeUrl: string;
  agentToken: string;
  taskPushEnabled?: boolean;
}

/**
 * AgentOrchestrator manages the automatic assignment of tasks to available AI agents.
 *
 * Core functionality:
 * - Checks every second for vacant agent clients
 * - When an agent client is free, finds the highest priority ready task assigned to that client type
 * - Feeds tasks to agents with dynamically selected prompts based on current stage (refine/plan/execute)
 * - Agents communicate back via MCP to update task status, stage, and progress
 *
 * Task selection criteria:
 * - status != 'done', ready=true and isAiWorking=false
 * - Ordered by priority (5 highest to 1 lowest), then status (doing > todo), then column order, then creation time
 * - Must be assigned to the specific free agent client type
 *
 * Agent vacancy determination:
 * - Considers rate limits, recent task assignments, and message activity
 * - Prevents duplicate task pushing with cooldown periods
 *
 * Session Management:
 * - Tasks can resume existing Claude Code sessions for context continuity
 * - Real session IDs are obtained from Claude Code UI via WebSocket messages
 * - Session-task binding enables persistent context across stage transitions
 */
export class AgentOrchestrator {
  private claudeCodeClient: ClaudeCodeClient;
  private isConnected = false;
  private taskPushEnabled: boolean;
  private taskPushingInterval: NodeJS.Timeout | null = null;
  private logger = {
    info: (msg: string, context?: any) => console.log(`[AgentOrchestrator] ${msg}`, context || ''),
    error: (msg: string, error?: any, context?: any) => console.error(`[AgentOrchestrator] ${msg}`, error?.message || error, context || ''),
    debug: (msg: string, context?: any) => {
      if (process.env.DEBUG_ORCHESTRATOR === 'true') {
        console.log(`[AgentOrchestrator-DEBUG] ${msg}`, context || '');
      }
    }
  };

  constructor(options: AgentOrchestratorOptions) {
    this.claudeCodeClient = new ClaudeCodeClient({
      claudeCodeUrl: options.claudeCodeUrl,
      agentToken: options.agentToken
    });
    this.taskPushEnabled = options.taskPushEnabled ?? true;
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

    // Start task pushing every second
    this.startTaskPushing();
  }

  private startTaskPushing() {
    if (this.taskPushingInterval) {
      clearInterval(this.taskPushingInterval);
    }

    this.taskPushingInterval = setInterval(async () => {
      try {
        if (this.taskPushEnabled) {
          await this.checkAndPushTasks();
        }
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
      return null;
    }
  }

  private async checkAndPushTasks() {
    // Get agent types that actually have repo agents assigned to them (excluding paused agents)
    const agentTypesInUse = await db
      .select({ agentType: agentClients.type })
      .from(agentClients)
      .innerJoin(repoAgents, eq(repoAgents.agentClientId, agentClients.id))
      .where(eq(repoAgents.isPaused, false))
      .groupBy(agentClients.type);

    const activeAgentTypes = agentTypesInUse.map(row => row.agentType);

    for (const agentType of activeAgentTypes) {
      const vacancy = await this.calculateAgentClientVacancy(agentType);

      if (vacancy === 'Free') {
        // Agent is free, find and assign the top priority task for this agent type
        this.logger.info(`Agent ${agentType} is free, checking for tasks to push`);
        await this.assignTopTaskToAgentType(agentType);
      }
    }
  }

  private async assignTopTaskToAgentType(targetAgentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE') {
    try {
      // Get the highest priority ready task for the specific agent type
      // Exclude tasks that have incomplete dependencies
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
            ne(tasks.status, 'done'),
            eq(agentClients.type, targetAgentType),
            eq(repoAgents.isPaused, false),
            // Only tasks with no incomplete dependencies
            notExists(
              db.select()
                .from(taskDependencies)
                .innerJoin(tasks as any, eq(taskDependencies.dependsOnTaskId, (tasks as any).id))
                .where(
                  and(
                    eq(taskDependencies.taskId, tasks.id),
                    ne((tasks as any).status, 'done')
                  )
                )
            )
          )
        )
        .orderBy(
          desc(tasks.priority), // Higher numbers = higher priority (5 > 4 > 3 > 2 > 1)
          sql`CASE WHEN ${tasks.status} = 'doing' THEN 2 WHEN ${tasks.status} = 'todo' THEN 1 ELSE 0 END DESC`, // Status weight: doing > todo
          sql`CAST(${tasks.columnOrder} AS DECIMAL)`,
          tasks.createdAt
        )
        .limit(1); // Only get the highest priority task

      if (readyTasks.length === 0) {
        this.logger.debug(`No ready tasks found for agent type ${targetAgentType}`);
        return;
      }

      const taskData = readyTasks[0];

      if (this.isConnected) {
        this.logger.info(`Assigning task to ${targetAgentType} agent`, {
          taskId: taskData.task.id,
          taskTitle: taskData.task.rawTitle,
          priority: taskData.task.priority
        });

        // Assign the task to the agent
        await this.assignTaskToAgent(taskData);
      }
    } catch (error) {
      this.logger.error(`Error assigning task to ${targetAgentType}`, error);
    }
  }

  private async assignTaskToAgent(taskData: any) {
    const { task, repoAgent, actor, project } = taskData;

    try {
      // Check if task already has an active session that can be resumed
      const existingSession = await db.query.sessions.findFirst({
        where: eq(sessions.taskId, task.id)
      });

      let sessionId = null;
      let shouldCreateNewSession = true;

      if (existingSession?.agentSessionId) {
        // Try to resume existing session
        sessionId = existingSession.agentSessionId;
        shouldCreateNewSession = false;
        this.logger.info('Resuming existing session', {
          taskId: task.id,
          sessionId: sessionId
        });
      }

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

      // Determine current stage - if task has no stage set, start with refine
      const currentStage = task.stage || 'refine';

      // Generate prompt dynamically based on current task stage
      const prompt = PromptTemplateFactory.generatePrompt(currentStage, taskContext);

      // Create session options with MCP tools
      const sessionOptions: SessionOptions = {
        projectPath: repoAgent.repoPath,
        cwd: repoAgent.repoPath,
        sessionId: sessionId || undefined,
        resume: !!sessionId,
        soloUnicornTaskId: task.id,
        toolsSettings: {
          allowedTools: [
            "Bash(git log:*)",
            "Bash(git diff:*)",
            "Bash(git status:*)",
            "Write",
            "Read",
            "Edit",
            "Glob",
            "Grep",
            "MultiEdit",
            "Task",
            "WebSearch",
            "WebFetch",
            "TodoRead",
            "TodoWrite",
            // Solo Unicorn MCP tools
            "mcp__solo-unicorn__task_update",
            "mcp__solo-unicorn__agent_rateLimit",
            "mcp__solo-unicorn__project_memory_update",
            "mcp__solo-unicorn__project_memory_get",
            "mcp__solo-unicorn__task_create"
          ],
          disallowedTools: [],
          skipPermissions: true
        },
        permissionMode: 'default'
      };

      // Start or resume Claude session
      await this.claudeCodeClient.startSession(prompt, sessionOptions);

      // If resuming existing session, update status to active
      if (!shouldCreateNewSession) {
        await db
          .update(sessions)
          .set({
            status: 'active'
          })
          .where(eq(sessions.taskId, task.id));
      }
      // Note: For new sessions, session record will be created when we receive session-created message

      // Update agent client's lastTaskPushedAt timestamp to prevent duplicate task pushing
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

      this.logger.info('Task successfully assigned to agent', {
        taskId: task.id,
        sessionId: sessionId || 'pending',
        stage: currentStage,
        resumed: !shouldCreateNewSession
      });

    } catch (error) {
      this.logger.error('Failed to assign task to agent', error, {
        taskId: task.id
      });

      // Reset task status on error
      await db
        .update(tasks)
        .set({ status: 'todo', stage: null, updatedAt: new Date() })
        .where(eq(tasks.id, task.id));
    }
  }

  async shutdown() {
    if (this.taskPushingInterval) {
      clearInterval(this.taskPushingInterval);
    }
    this.claudeCodeClient.disconnect();
  }
}
