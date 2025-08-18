/**
 * V2 Claude Code Client Function Modules
 * Enhanced Claude Code integration with multi-repo support
 */

import WebSocket from 'ws';
import { getTaskAdditionalRepositories } from '../../services/v2/repositories';
import { db } from '../../db';
import { eq } from 'drizzle-orm';
import * as schema from '../../db/schema/index';

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
  const stage = task.stage || 'refine';

  // Base prompt components
  const titleSection = task.refinedTitle || task.rawTitle;
  const descriptionSection = task.refinedDescription || task.rawDescription || '';
  const projectMemory = taskDetails.project?.memory || {};
  const actorDescription = taskDetails.actor?.description || 'Default engineering agent';

  // Stage-specific prompts
  switch (stage) {
    case 'refine':
      return `[refine] ${titleSection}
${descriptionSection ? `\n**Description**: ${descriptionSection}` : ''}

**Do not write any code!**
Refine this raw task.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="doing", stage="refine", isAiWorking=true
2. Analyze the raw title and raw description to understand the user's intent. Focus on UX improvements and Customer Obsession.
3. Create a refined title that is clear and specific.
4. Write a detailed refined description that includes:
   - What needs to be implemented/fixed/changed
   - Key requirements and goals
   - Expected outcome
   - Out-of-scope items if any
5. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", stage="plan", isAiWorking=false, refinedTitle=[from above], refinedDescription=[from above]

**Your Role**: ${actorDescription}
**Project Context**: ${JSON.stringify(projectMemory)}`;

    case 'plan':
      return `[plan] ${titleSection}
${descriptionSection ? `\n**Description**: ${descriptionSection}` : ''}

**Do not write any code!**
Create a plan for implementing this task.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="doing", stage="plan", isAiWorking=true
2. **Analyze Requirements**: Review the refined title and description
3. **Solution Options**: List 2-3 different implementation approaches
4. **Select Approach**: Choose the best solution and explain why
5. **Create Specification**: Write detailed implementation spec
6. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", stage="execute", isAiWorking=false, plan=[solution and spec from above]

**Your Role**: ${actorDescription}
**Project Context**: ${JSON.stringify(projectMemory)}`;

    case 'execute':
      return `[execute] ${titleSection}
${descriptionSection ? `\n**Description**: ${descriptionSection}` : ''}

Implement the solution following the plan below.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="doing", stage="execute", isAiWorking=true
2. **Follow the Plan**: Implement the solution as specified in the plan above
3. **Commit Changes**: Make appropriate git commits when needed
4. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="done", stage=null, isAiWorking=false

**Your Role**: ${actorDescription}
**Project Context**: ${JSON.stringify(projectMemory)}

**Task to Implement**:
- **Title**: ${titleSection}
- **Description**: ${descriptionSection}
${task.plan ? `\n**Implementation Plan**:\n${JSON.stringify(task.plan, null, 2)}` : ''}`;

    case 'loop':
      return `[loop] ${titleSection}
${descriptionSection ? `\n**Description**: ${descriptionSection}` : ''}

Execute this repeatable task. This is a loop task that will return to the loop column after completion.

**Steps**:
1. **START**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="doing", stage="loop", isAiWorking=true
2. **Execute Task**: Perform the task as described (no refine/plan stages for loop tasks)
3. **FINISH**: Use Solo Unicorn MCP tool \`task_update\` with taskId="${task.id}", status="done", stage="loop", isAiWorking=false

**Note**: This task will automatically return to the Loop column for future execution.

**Your Role**: ${actorDescription}
**Project Context**: ${JSON.stringify(projectMemory)}`;

    default:
      return `${titleSection}
${descriptionSection}

**Your Role**: ${actorDescription}
**Project Context**: ${JSON.stringify(projectMemory)}`;
  }
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
