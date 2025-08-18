/**
 * V2 Claude Code Client Function Modules
 * Enhanced Claude Code integration with multi-repo support
 */

import WebSocket from 'ws';
import { getTaskAdditionalRepositories } from '../../services/v2/repositories';
import { db } from '../../db';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema/index';
import { generatePrompt } from '../prompts/index';
import type { TaskContext, TaskStage } from '../prompts/index';

interface ClaudeCodeSessionOptions {
  projectPath: string;
  additionalWorkingDirectories?: string[];
  agentConfig?: Record<string, any>;
  taskId: string;
  agentId?: string;
  sessionId?: string;
}

interface ClaudeCodeMessage {
  type: string;
  data: any;
  taskId?: string;
  sessionId?: string;
}

interface AgentSessionState {
  taskId: string;
  agentId?: string;
  sessionId?: string;
  status: 'starting' | 'active' | 'completed' | 'failed';
  startedAt: Date;
  lastMessageAt?: Date;
  projectPath: string;
  additionalPaths: string[];
}

// Global session tracking
const activeSessions = new Map<string, AgentSessionState>();
let claudeCodeSocket: WebSocket | null = null;
let connectionUrl: string = '';
let authToken: string = '';

/**
 * Initialize Claude Code connection
 */
export function initializeClaudeCodeClient(url: string, token: string): Promise<void> {
  connectionUrl = url;
  authToken = token;

  return new Promise((resolve, reject) => {
    try {
      claudeCodeSocket = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      claudeCodeSocket.onopen = () => {
        console.log('🔌 Connected to Claude Code UI WebSocket');
        resolve();
      };

      claudeCodeSocket.onmessage = (event) => {
        handleClaudeCodeMessage(event.data.toString());
      };

      claudeCodeSocket.onclose = () => {
        console.log('🔌 Claude Code UI WebSocket disconnected');
        claudeCodeSocket = null;
        // Auto-reconnect after delay
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect to Claude Code UI...');
          initializeClaudeCodeClient(connectionUrl, authToken).catch(console.error);
        }, 5000);
      };

      claudeCodeSocket.onerror = (error) => {
        console.error('❌ Claude Code UI WebSocket error:', error);
        reject(error);
      };

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Handle incoming messages from Claude Code UI
 */
function handleClaudeCodeMessage(message: string) {
  try {
    const parsed: ClaudeCodeMessage = JSON.parse(message);

    console.log(`📨 Claude Code message: ${parsed.type}`, {
      taskId: parsed.taskId,
      sessionId: parsed.sessionId
    });

    switch (parsed.type) {
      case 'session_started':
        handleSessionStarted(parsed);
        break;
      case 'session_completed':
        handleSessionCompleted(parsed);
        break;
      case 'session_failed':
        handleSessionFailed(parsed);
        break;
      case 'agent_activity':
        handleAgentActivity(parsed);
        break;
      case 'rate_limit_hit':
        handleRateLimit(parsed);
        break;
      default:
        console.log('🔍 Unknown Claude Code message type:', parsed.type);
    }
  } catch (error) {
    console.error('❌ Failed to parse Claude Code message:', error);
  }
}

/**
 * Handle session started event
 */
async function handleSessionStarted(message: ClaudeCodeMessage) {
  const { taskId, sessionId } = message;

  if (!taskId || !sessionId) {
    console.error('❌ Session started without taskId or sessionId');
    return;
  }

  // Update session tracking
  const session = activeSessions.get(taskId);
  if (session) {
    session.sessionId = sessionId;
    session.status = 'active';
    session.lastMessageAt = new Date();
  }

  // Update task in database
  await db.update(schema.tasks)
    .set({
      lastAgentSessionId: sessionId,
      updatedAt: new Date()
    })
    .where(eq(schema.tasks.id, taskId));

  console.log(`✅ Session started for task ${taskId}: ${sessionId}`);
}

/**
 * Handle session completed event
 */
async function handleSessionCompleted(message: ClaudeCodeMessage) {
  const { taskId, sessionId } = message;

  if (!taskId) {
    console.error('❌ Session completed without taskId');
    return;
  }

  // Update session tracking
  const session = activeSessions.get(taskId);
  if (session) {
    session.status = 'completed';
    session.lastMessageAt = new Date();
  }

  // Check if this is a loop task that should return to loop
  const task = await db.select()
    .from(schema.tasks)
    .where(eq(schema.tasks.id, taskId))
    .limit(1);

  if (task[0] && task[0].stage === 'loop') {
    // Return to loop column (bottom)
    const { returnTaskToLoop } = await import('./orchestrator');
    const result = await returnTaskToLoop(taskId);

    if (result.success) {
      console.log(`♻️ Task ${taskId} returned to loop column`);
    } else {
      console.error(`❌ Failed to return task ${taskId} to loop:`, result.error);
    }
  } else {
    await db.update(schema.tasks)
      .set({
        isAiWorking: false,
        aiWorkingSince: null,
        updatedAt: new Date()
      })
      .where(eq(schema.tasks.id, taskId));
  }

  // Clean up session tracking
  activeSessions.delete(taskId);

  console.log(`✅ Session completed for task ${taskId}`);
}

/**
 * Handle session failed event
 */
async function handleSessionFailed(message: ClaudeCodeMessage) {
  const { taskId, sessionId } = message;

  if (!taskId) {
    console.error('❌ Session failed without taskId');
    return;
  }

  // Update session tracking
  const session = activeSessions.get(taskId);
  if (session) {
    session.status = 'failed';
    session.lastMessageAt = new Date();
  }

  await db.update(schema.tasks)
    .set({
      isAiWorking: false,
      aiWorkingSince: null,
      updatedAt: new Date()
    })
    .where(eq(schema.tasks.id, taskId));

  // Clean up session tracking
  activeSessions.delete(taskId);

  console.error(`❌ Session failed for task ${taskId}`);
}

/**
 * Handle agent activity updates
 */
function handleAgentActivity(message: ClaudeCodeMessage) {
  const { taskId } = message;

  if (!taskId) return;

  // Update session tracking
  const session = activeSessions.get(taskId);
  if (session) {
    session.lastMessageAt = new Date();
  }
}

/**
 * Handle rate limit hit
 */
async function handleRateLimit(message: ClaudeCodeMessage) {
  console.log('⏰ Claude Code rate limit hit:', message.data);

  if (message.data?.agentId && message.data?.resetAt) {
    const { updateAgentState } = await import('../../services/v2/user-agents');
    await updateAgentState(message.data.agentId, {
      rateLimitResetAt: message.data.resetAt
    });
  }
}

/**
 * Start a new Claude Code session for a task
 */
export async function startClaudeCodeSession(
  taskId: string,
  options: ClaudeCodeSessionOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!claudeCodeSocket || claudeCodeSocket.readyState !== WebSocket.OPEN) {
      return {
        success: false,
        error: 'Claude Code UI not connected'
      };
    }

    // Get task details for prompt generation
    const task = await getTaskDetails(taskId);

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    // Generate prompt based on task stage
    const prompt = await generateTaskPrompt(task);

    // Get additional repositories
    const additionalRepositories = await getTaskAdditionalRepositories(taskId);
    const additionalRepos = additionalRepositories.map(repo => repo.repoPath);

    // Prepare session message
    const sessionMessage = {
      type: 'start_session',
      data: {
        taskId,
        prompt,
        projectPath: options.projectPath,
        additionalWorkingDirectories: [...(options.additionalWorkingDirectories || []), ...additionalRepos],
        agentConfig: options.agentConfig || {},
        sessionId: options.sessionId
      }
    };

    // Track session
    activeSessions.set(taskId, {
      taskId,
      agentId: options.agentId,
      sessionId: options.sessionId,
      status: 'starting',
      startedAt: new Date(),
      projectPath: options.projectPath,
      additionalPaths: [...(options.additionalWorkingDirectories || []), ...additionalRepos]
    });

    // Send to Claude Code UI
    claudeCodeSocket.send(JSON.stringify(sessionMessage));

    console.log(`🚀 Started Claude Code session for task ${taskId}`);
    return { success: true };

  } catch (error) {
    console.error('❌ Failed to start Claude Code session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get task details
 */
async function getTaskDetails(taskId: string) {
  const task = await db.select({
    task: schema.tasks,
    mainRepository: schema.repositories,
    actor: schema.actors,
    project: schema.projects
  })
    .from(schema.tasks)
    .leftJoin(schema.repositories, eq(schema.repositories.id, schema.tasks.mainRepositoryId))
    .leftJoin(schema.actors, eq(schema.actors.id, schema.tasks.actorId))
    .leftJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
    .where(eq(schema.tasks.id, taskId))
    .limit(1);

  return task[0] || null;
}

/**
 * Generate task prompt based on stage and details
 */
async function generateTaskPrompt(taskDetails: any): Promise<string> {
  const task = taskDetails.task;
  const stage = (task.stage || 'refine') as TaskStage;

  // Build task context for prompt generation
  const context: TaskContext = {
    id: task.id,
    projectId: task.projectId,
    rawTitle: task.rawTitle,
    rawDescription: task.rawDescription,
    refinedTitle: task.refinedTitle,
    refinedDescription: task.refinedDescription,
    plan: task.plan,
    priority: task.priority,
    attachments: task.attachments,
    actorDescription: taskDetails.actor?.description,
    projectMemory: JSON.stringify(taskDetails.project?.memory || {}),
    repoPath: taskDetails.mainRepository?.repoPath || ''
  };

  return generatePrompt(stage, context);
}

/**
 * Get active sessions for monitoring
 */
export function getActiveSessions(): AgentSessionState[] {
  return Array.from(activeSessions.values());
}

/**
 * Check if Claude Code is connected
 */
export function isClaudeCodeConnected(): boolean {
  return claudeCodeSocket !== null && claudeCodeSocket.readyState === WebSocket.OPEN;
}

/**
 * Cleanup and shutdown
 */
export function shutdownClaudeCodeClient(): void {
  if (claudeCodeSocket) {
    claudeCodeSocket.close();
    claudeCodeSocket = null;
  }
  activeSessions.clear();
  console.log('🛑 Claude Code client shutdown');
}
