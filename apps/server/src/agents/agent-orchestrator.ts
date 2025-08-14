import { ClaudeCodeClient, ClaudeCodeSession, SessionOptions } from './claude-code-client';
import { PromptTemplateFactory, TaskContext } from './prompts/index';
import { db } from '../db/index';
import { tasks, sessions, repoAgents, actors, projects } from '../db/schema/simplified';
import { eq, and } from 'drizzle-orm';

export interface AgentOrchestratorOptions {
  claudeCodeUrl: string;
  agentToken: string;
}

export class AgentOrchestrator {
  private claudeCodeClient: ClaudeCodeClient;
  private isConnected = false;
  private lastReconnectAttempt = 0;
  private activeSessions = new Map<string, {
    taskId: string;
    repoAgentId: string;
    stage: 'refine' | 'kickoff' | 'execute';
    sessionId?: string;
  }>();

  constructor(options: AgentOrchestratorOptions) {
    this.claudeCodeClient = new ClaudeCodeClient({
      claudeCodeUrl: options.claudeCodeUrl,
      agentToken: options.agentToken
    });
  }

  async initialize() {
    try {
      await this.claudeCodeClient.connect();
      this.isConnected = true;
      console.log('🤖 Agent Orchestrator initialized');
    } catch (error) {
      console.error('❌ Failed to connect to Claude Code UI:', error.message);
      this.isConnected = false;
      // Continue without connection - will retry automatically
    }
    
    // Start monitoring for ready tasks regardless of connection status
    this.startTaskMonitoring();
  }

  private async startTaskMonitoring() {
    // Poll for ready tasks every 10 seconds
    setInterval(async () => {
      try {
        // Try to reconnect if not connected (every 30 seconds)
        if (!this.isConnected) {
          const now = Date.now();
          if (now - this.lastReconnectAttempt > 30000) { // Only try every 30 seconds
            this.lastReconnectAttempt = now;
            const success = await this.claudeCodeClient.retryConnection();
            if (success) {
              this.isConnected = true;
              console.log('🔄 Reconnected to Claude Code UI - task processing resumed');
            }
          }
        }
        
        await this.processReadyTasks();
      } catch (error) {
        console.error('Error processing ready tasks:', error);
      }
    }, 10000);

    // Process immediately on startup
    setTimeout(() => this.processReadyTasks(), 1000);
  }

  private async processReadyTasks() {
    // Skip processing if not connected to Claude Code UI
    if (!this.isConnected) {
      return;
    }
    
    try {
      // Get ready tasks that are not currently being processed
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
        .orderBy(tasks.priority, tasks.createdAt);

      for (const readyTask of readyTasks) {
        // Check if this task is already being processed
        const isActive = Array.from(this.activeSessions.values())
          .some(session => session.taskId === readyTask.task.id);

        if (!isActive) {
          await this.startTaskProcessing(readyTask);
        }
      }
    } catch (error) {
      console.error('Error fetching ready tasks:', error);
    }
  }

  private async startTaskProcessing(taskData: any) {
    const { task, repoAgent, actor, project } = taskData;

    console.log(`🚀 Starting task processing: ${task.refinedTitle || task.rawTitle}`);

    try {
      // Update task status to doing
      await db
        .update(tasks)
        .set({
          status: 'doing',
          stage: 'refine'
        })
        .where(eq(tasks.id, task.id));

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

      // Create session options
      const sessionOptions: SessionOptions = {
        projectPath: repoAgent.repoPath,
        cwd: repoAgent.repoPath,
        toolsSettings: {
          allowedTools: ['Read', 'Task', 'TodoWrite', 'cards.update', 'context.read', 'memory.update'],
          disallowedTools: [],
          skipPermissions: false
        },
        permissionMode: 'default'
      };

      // Start Claude session
      const sessionId = await this.claudeCodeClient.startSession(prompt, sessionOptions);

      // Track the session
      this.activeSessions.set(sessionId, {
        taskId: task.id,
        repoAgentId: repoAgent.id,
        stage: 'refine',
        sessionId
      });

      // Create session record in database
      await db.insert(sessions).values({
        id: sessionId,
        taskId: task.id,
        repoAgentId: repoAgent.id,
        status: 'starting',
        startedAt: new Date()
      });

      console.log(`📝 Started refine session for task: ${task.rawTitle}`);

    } catch (error) {
      console.error(`❌ Failed to start task processing for ${task.rawTitle}:`, error);
      
      // Reset task status on error
      await db
        .update(tasks)
        .set({
          status: 'todo',
          stage: null
        })
        .where(eq(tasks.id, task.id));
    }
  }

  async advanceTaskStage(taskId: string, currentStage: 'refine' | 'kickoff' | 'execute') {
    try {
      let nextStage: 'kickoff' | 'execute' | null = null;
      
      switch (currentStage) {
        case 'refine':
          nextStage = 'kickoff';
          break;
        case 'kickoff':
          nextStage = 'execute';
          break;
        case 'execute':
          // Task is complete
          await this.completeTask(taskId);
          return;
      }

      if (nextStage) {
        await this.startStage(taskId, nextStage);
      }
    } catch (error) {
      console.error(`Error advancing task ${taskId} from ${currentStage}:`, error);
    }
  }

  private async startStage(taskId: string, stage: 'kickoff' | 'execute') {
    try {
      // Get task data
      const taskData = await db
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
        .where(eq(tasks.id, taskId))
        .limit(1);

      if (taskData.length === 0) {
        throw new Error(`Task ${taskId} not found`);
      }

      const { task, repoAgent, actor, project } = taskData[0];

      // Update task stage
      await db
        .update(tasks)
        .set({ stage })
        .where(eq(tasks.id, taskId));

      // Create task context
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

      // Generate prompt for the new stage
      const prompt = PromptTemplateFactory.generatePrompt(stage, taskContext);

      // Create session options
      const sessionOptions: SessionOptions = {
        projectPath: repoAgent.repoPath,
        cwd: repoAgent.repoPath,
        toolsSettings: {
          allowedTools: stage === 'execute' 
            ? ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'cards.update', 'memory.update']
            : ['Read', 'Task', 'TodoWrite', 'cards.update', 'context.read', 'memory.update'],
          disallowedTools: [],
          skipPermissions: false
        },
        permissionMode: 'default'
      };

      // Start new Claude session for this stage
      const sessionId = await this.claudeCodeClient.startSession(prompt, sessionOptions);

      // Update session tracking
      this.activeSessions.set(sessionId, {
        taskId,
        repoAgentId: repoAgent.id,
        stage,
        sessionId
      });

      console.log(`📝 Started ${stage} session for task: ${task.refinedTitle || task.rawTitle}`);

    } catch (error) {
      console.error(`Error starting ${stage} stage for task ${taskId}:`, error);
    }
  }

  private async completeTask(taskId: string) {
    try {
      // Update task status to done
      await db
        .update(tasks)
        .set({
          status: 'done',
          stage: null
        })
        .where(eq(tasks.id, taskId));

      // Remove from active sessions
      for (const [sessionId, session] of this.activeSessions) {
        if (session.taskId === taskId) {
          this.activeSessions.delete(sessionId);
        }
      }

      console.log(`✅ Task ${taskId} completed`);

    } catch (error) {
      console.error(`Error completing task ${taskId}:`, error);
    }
  }

  // Method to be called by MCP server when agent updates task
  async onTaskUpdated(taskId: string, updates: any) {
    console.log(`📝 Task ${taskId} updated:`, updates);

    // Check if this update indicates stage completion
    const activeSession = Array.from(this.activeSessions.values())
      .find(session => session.taskId === taskId);

    if (activeSession) {
      // Logic to determine if stage is complete based on updates
      // This would need to be implemented based on specific update patterns
      
      // For now, we'll advance stage when certain fields are updated
      if (updates.refinedTitle && updates.refinedDescription && activeSession.stage === 'refine') {
        await this.advanceTaskStage(taskId, 'refine');
      } else if (updates.plan && activeSession.stage === 'kickoff') {
        await this.advanceTaskStage(taskId, 'kickoff');
      }
    }
  }

  async shutdown() {
    this.claudeCodeClient.disconnect();
    this.activeSessions.clear();
  }
}