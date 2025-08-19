/**
 * Direct Claude CLI process spawning
 * Replaces Claude Code UI dependency
 */

import { spawn } from 'child_process';
import { generatePrompt, type TaskStage } from './prompts';
import { registerSession } from './session-registry';

export interface SpawnOptions {
  sessionId: string;
  taskId: string;
  agentId: string;
  projectId: string;
  repositoryPath: string;
  claudeConfigDir?: string;
  resumeSessionId?: string;
  stage: TaskStage;
  taskData: {
    task: any;
    actor: any;
    project: any;
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
      resumeSessionId,
      stage,
      taskData
    } = options;

    // Generate the appropriate prompt for the task stage
    const prompt = generatePrompt(stage, taskData);

    // Prepare Claude CLI command
    const claudeArgs = [
      'claude-code',
      '--cwd', repositoryPath
    ];

    // Add resume flag if resuming an existing session
    if (resumeSessionId) {
      claudeArgs.push('--resume', resumeSessionId);
    }

    // Prepare environment variables
    const env = {
      ...process.env,
      // Add Claude config directory if specified
      ...(claudeConfigDir && { CLAUDE_CONFIG_DIR: claudeConfigDir }),
      // Session tracking
      SESSION_ID: sessionId,
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

    // Register session in file-based registry
    await registerSession({
      sessionId,
      taskId,
      agentId,
      projectId,
      repositoryPath,
      startedAt: new Date().toISOString(),
      claudeConfigDir
    });

    // Spawn Claude CLI process
    const childProcess = spawn('claude', claudeArgs, {
      cwd: repositoryPath,
      env,
      stdio: 'pipe', // We'll handle I/O separately
      detached: true  // Allow process to run independently
    });

    // Send initial prompt to Claude
    childProcess.stdin.write(prompt);
    childProcess.stdin.end();

    // Set up error handling
    childProcess.on('error', (error) => {
      console.error(`Claude CLI spawn error for session ${sessionId}:`, error);
    });

    // Log output for debugging (optional)
    childProcess.stdout.on('data', (data) => {
      console.log(`Claude CLI output [${sessionId}]:`, data.toString());
    });

    childProcess.stderr.on('data', (data) => {
      console.error(`Claude CLI stderr [${sessionId}]:`, data.toString());
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

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
