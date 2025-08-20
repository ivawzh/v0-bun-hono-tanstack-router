/**
 * Direct Claude CLI process spawning
 * Replaces Claude Code UI dependency
 */

import { spawn } from 'child_process';
import crossSpawn from 'cross-spawn';
import { generatePrompt, type TaskStage } from './prompts';
import { registerActiveSession, registerCompletedSession } from './session-registry';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/index';
import { broadcastFlush } from '../websocket/websocket-server';

// Use cross-spawn on Windows for better command execution
const spawnFunction = process.platform === 'win32' ? crossSpawn : spawn;

/**
 * Extract rate limit reset time from Claude AI usage limit message
 */
function extractRateLimitResetTime(text: string): string | null {
  try {
    if (typeof text !== 'string') return null;

    const match = text.match(/Claude AI usage limit reached\|(\d{10,13})/);
    if (!match) return null;

    let timestampMs = parseInt(match[1], 10);
    if (!Number.isFinite(timestampMs)) return null;
    if (timestampMs < 1e12) timestampMs *= 1000; // seconds → ms

    const reset = new Date(timestampMs);
    return reset.toISOString();
  } catch (error) {
    console.error('Error extracting rate limit reset time:', error);
    return null;
  }
}

/**
 * Handle rate limit detection and agent update
 */
async function handleRateLimit(line: string, agentId: string): Promise<void> {
  const rateLimitResetTime = extractRateLimitResetTime(line);
  if (rateLimitResetTime) {
    console.log('🚫 Claude rate limit detected, updating agent');
    try {
      await db
        .update(schema.agents)
        .set({
          rateLimitResetAt: new Date(rateLimitResetTime),
          updatedAt: new Date()
        })
        .where(eq(schema.agents.id, agentId));
    } catch (error) {
      console.error('Failed to update agent rate limit:', error);
    }
  }
}

/**
 * Update task session state when session ID is captured
 */
async function updateTaskSessionStarted(
  taskId: string,
  agentId: string,
  sessionId: string,
  projectId: string
): Promise<void> {
  try {
    await db
      .update(schema.tasks)
      .set({
        lastAgentSessionId: sessionId,
        agentSessionStatus: 'ACTIVE',
        activeAgentId: agentId,
        lastAgentSessionStartedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.tasks.id, taskId));

    // Broadcast to invalidate frontend queries
    broadcastFlush(projectId);
    console.log(`✅ Updated task ${taskId} with session ${sessionId}`);
  } catch (error) {
    console.error('Failed to update task session state:', error);
  }
}

/**
 * Update task when session completes
 */
async function updateTaskSessionCompleted(
  taskId: string,
  projectId: string,
  exitCode: number
): Promise<void> {
  try {
    await db
      .update(schema.tasks)
      .set({
        agentSessionStatus: 'NON_ACTIVE',
        activeAgentId: null,
        updatedAt: new Date()
      })
      .where(eq(schema.tasks.id, taskId));

    // Broadcast to invalidate frontend queries
    broadcastFlush(projectId);
    console.log(`✅ Task ${taskId} session completed with exit code ${exitCode}`);
  } catch (error) {
    console.error('Failed to update task completion state:', error);
  }
}

export interface SpawnOptions {
  sessionId?: string | null;
  taskId: string;
  agentId: string;
  projectId: string;
  repositoryPath: string;
  claudeConfigDir?: string;
  stage: TaskStage;
  taskData: {
    task: schema.Task;
    actor?: schema.Actor | null;
    project: schema.Project;
  };
}

/**
 * Spawn Claude CLI process for a task
 */
export async function spawnClaudeSession(options: SpawnOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      sessionId,
      taskId,
      agentId,
      projectId,
      repositoryPath,
      claudeConfigDir,
      stage,
      taskData
    } = options;

    let capturedSessionId = sessionId;

    // Generate the appropriate prompt for the task stage
    const prompt = generatePrompt(stage, taskData);

    if (!prompt || !prompt.trim()) {
      return { success: false, error: `No prompt generated. Stage: ${stage}, Task ID: ${taskId}. Task title: ${taskData.task.rawTitle || taskData.task.refinedTitle}.` };
    }

    // Prepare Claude CLI command
    const claudeArgs: string[] = ['--print', prompt, '--output-format', 'stream-json', '--verbose'];

    // Add resume flag if resuming an existing session
    if (sessionId) {
      claudeArgs.push('--resume', sessionId);
    }

    // Prepare environment variables
    const env = {
      ...process.env,
      // Add Claude config directory if specified
      ...(claudeConfigDir && { CLAUDE_CONFIG_DIR: claudeConfigDir }),
      // Session tracking
      ...(sessionId && { SESSION_ID: sessionId }),
      REPOSITORY_PATH: repositoryPath,
      SOLO_UNICORN_PROJECT_ID: projectId,
      SOLO_UNICORN_AGENT_ID: agentId,
      SOLO_UNICORN_TASK_ID: taskId,
      // Hook configuration
      CLAUDE_HOOK_SESSION_START: '/home/iw/.solo-unicorn/hooks/session-start.sh',
      CLAUDE_HOOK_SESSION_END: '/home/iw/.solo-unicorn/hooks/session-end.sh',
      CLAUDE_HOOK_RATE_LIMIT: '/home/iw/.solo-unicorn/hooks/rate-limit.sh',
      // Solo Unicorn server configuration
      SOLO_UNICORN_URL: process.env.SOLO_UNICORN_URL || 'http://localhost:8500',
    };

    // Spawn Claude CLI process
    const childProcess = spawnFunction('claude', claudeArgs, {
      cwd: repositoryPath,
      env,
      stdio: 'pipe', // We'll handle I/O separately
      detached: true  // Allow process to run independently
    });

    // Send initial prompt to Claude
    childProcess.stdin?.write(prompt);
    childProcess.stdin?.end();

    // Set up error handling
    childProcess.on('error', (error) => {
      console.error(`Claude CLI spawn error for session ${sessionId}:`, error);
    });

    // Handle stdout (streaming JSON responses)
    childProcess.stdout?.on('data', async (data) => {
      const rawOutput = data?.toString() as string || '';

      const lines = rawOutput.split('\n').filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          console.log('📄 Parsed JSON response:', response);

          // Capture session ID if it's in the response
          if (response.session_id && !capturedSessionId) {
            capturedSessionId = response.session_id;
            console.log('📝 Captured session ID:', capturedSessionId);

            // Update task with captured session ID and ACTIVE status
            await updateTaskSessionStarted(taskId, agentId, response.session_id, projectId);

            // Register session in file-based registry
            await registerActiveSession({
              sessionId: response.session_id,
              taskId,
              agentId,
              projectId,
              repositoryPath,
              startedAt: new Date().toISOString(),
              claudeConfigDir
            });
          }

          // Check for rate limit in JSON response
          await handleRateLimit(line, agentId);
        } catch (parseError: any) {
          // If not JSON, check for rate limit in raw text
          await handleRateLimit(line, agentId);
        }
      }
    });

    // Handle stderr
    childProcess.stderr?.on('data', async (data) => {
      const errorMessage = data.toString();
      console.error(`Claude CLI stderr [${sessionId}]:`, errorMessage);

      // Check for rate limit in stderr
      await handleRateLimit(errorMessage, agentId);
    });

    // Handle process completion
    childProcess.on('close', async (code) => {
      console.log(`Claude CLI process [${sessionId}] exited with code ${code}`);

      await Promise.all([
        // Update task status to NON_ACTIVE when process completes
        await updateTaskSessionCompleted(taskId, projectId, code || 0),

        // Register session in file-based registry
        await registerCompletedSession({
          sessionId: sessionId!,
          taskId,
          agentId,
          projectId,
          repositoryPath,
          startedAt: new Date().toISOString(),
          claudeConfigDir
        }),
      ]);
    });

    // Allow process to run detached
    childProcess.unref();

    console.log(`🚀 Spawned Claude CLI session ${sessionId} for task ${taskId}`);
    return { success: true };

  } catch (error) {
    console.error('Failed to spawn Claude CLI session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown spawn error'
    };
  }
}
