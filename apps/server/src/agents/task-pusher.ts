/**
 * Recursive task pushing with global locking mechanism
 */

import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/index';
import { findNextAssignableTask, selectBestAvailableAgent, type TaskWithContext } from './task-finder';
import { spawnClaudeSession } from './claude-spawner';

// Global lock to prevent concurrent task pushing
let globalPushLock = false;

/**
 * Main recursive task pushing function with global locking
 */
export async function tryPushTasks(): Promise<{ pushed: number; errors: string[] }> {
  // Check global lock
  if (globalPushLock) {
    console.log('🚀 ❌ [tryPushTasks] already in progress');
    return { pushed: 0, errors: ['[tryPushTasks] already in progress'] };
  }

  // Acquire global lock
  globalPushLock = true;

  try {
    const errors: string[] = [];
    let totalPushed = 0;

    // Recursive push loop
    while (true) {
      const taskWithContext = await findNextAssignableTask();

      if (!taskWithContext) {
        // No more assignable tasks
        break;
      }

      // Select best available agent
      const selectedAgent = selectBestAvailableAgent(taskWithContext.assignedAgents);

      if (!selectedAgent) {
        // No available agents for this task
        errors.push(`No available agents for task ${taskWithContext.task.id}`);
        break;
      }

      // Attempt to push task to agent
      const pushResult = await pushTaskToAgent(taskWithContext, selectedAgent);

      if (pushResult.success) {
        totalPushed++;
        console.log(`🚀 ✅ Pushed task ${taskWithContext.task.id} to agent ${selectedAgent.id}`);

        // Continue loop to check for more tasks
        continue;
      } else {
        errors.push(pushResult.error || 'Unknown push error');
        break; // Stop on errors to avoid infinite loop
      }
    }

    if (errors.length > 0) {
      console.error('🚀 ❌ [tryPushTasks] errors:', errors);
    }

    return { pushed: totalPushed, errors };

  } finally {
    // Always release global lock
    globalPushLock = false;
  }
}

/**
 * Push a specific task to a specific agent
 */
async function pushTaskToAgent(
  taskWithContext: TaskWithContext,
  selectedAgent: any
): Promise<{ success: boolean; error?: string }> {
  const { task, mainRepository, actor, project } = taskWithContext;

  try {
    const now = new Date();

    // Update task status atomically
    const updatedTask = await db
      .update(schema.tasks)
      .set({
        agentSessionStatus: 'PUSHING',
        activeAgentId: selectedAgent.id,
        lastPushedAt: now,
        lastAgentSessionStartedAt: now,
        lastAgentSessionId: task.lastAgentSessionId,
        updatedAt: now
      })
      .where(
        and(
          eq(schema.tasks.id, task.id),
          eq(schema.tasks.agentSessionStatus, 'NON_ACTIVE') // Ensure no race condition
        )
      )
      .returning();

    if (updatedTask.length === 0) {
      return { success: false, error: 'Task was already assigned to another agent' };
    }

    // Update agent last task pushed timestamp
    await db
      .update(schema.agents)
      .set({
        lastTaskPushedAt: now,
        updatedAt: now
      })
      .where(eq(schema.agents.id, selectedAgent.id));

    // Update repository last task pushed timestamp
    await db
      .update(schema.repositories)
      .set({
        lastTaskPushedAt: now,
        updatedAt: now
      })
      .where(eq(schema.repositories.id, mainRepository.id));

    // Spawn Claude CLI session
    const spawnResult = await spawnClaudeSession({
      sessionId: task.lastAgentSessionId,
      taskId: task.id,
      agentId: selectedAgent.id,
      projectId: project.id,
      repositoryPath: mainRepository.repoPath,
      claudeConfigDir: selectedAgent.agentSettings?.CLAUDE_CONFIG_DIR,
      stage: task.stage || 'clarify',
      taskData: { task, actor, project }
    });

    if (!spawnResult.success) {
      // Revert task status if spawn failed
      await db
        .update(schema.tasks)
        .set({
          agentSessionStatus: 'NON_ACTIVE',
          activeAgentId: null,
          updatedAt: new Date()
        })
        .where(eq(schema.tasks.id, task.id));

      return { success: false, error: spawnResult.error };
    }

    return { success: true };

  } catch (error) {
    console.error('Failed to push task to agent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if task pushing is currently locked
 */
export function isPushingLocked(): boolean {
  return globalPushLock;
}

/**
 * Force release the global lock (emergency use only)
 */
export function forceReleaseLock(): void {
  globalPushLock = false;
  console.warn('⚠️  Global push lock forcefully released');
}
