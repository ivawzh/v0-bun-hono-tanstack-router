/**
 * Recursive task pushing with database locking mechanism
 */

import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/index';
import { findNextAssignableTask, selectBestAvailableAgent, type TaskWithContext } from './task-finder';
import { spawnClaudeSession } from './claude-spawner';

// Database-based lock configuration
const TASK_PUSH_LOCK_CODE = 'TASK_PUSH_LOCK';
const LOCK_TIMEOUT_MS = 60000; // 1 minute timeout - if unchanged, assume something went wrong

async function acquireDatabaseLock(): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TIMEOUT_MS);

  try {
    // Try to get existing lock
    const existingLock = await db
      .select()
      .from(schema.helpers)
      .where(eq(schema.helpers.code, TASK_PUSH_LOCK_CODE))
      .limit(1);

    if (existingLock.length > 0) {
      const lock = existingLock[0];
      const lockState = lock.state as {
        locked: boolean;
        timestamp: string;
        expiresAt: string;
      };

      const isStale = new Date(lockState.expiresAt) < now;

      if (isStale) {
        // Lock has expired - acquire it
        await db
          .update(schema.helpers)
          .set({
            state: {
              locked: true,
              timestamp: now.toISOString(),
              expiresAt: expiresAt.toISOString()
            },
            updatedAt: now
          })
          .where(eq(schema.helpers.code, TASK_PUSH_LOCK_CODE));

        return true;
      } else if (lockState.locked) {
        return false; // Lock is active and fresh
      } else {
        // Lock exists but not locked, acquire it
        await db
          .update(schema.helpers)
          .set({
            state: {
              locked: true,
              timestamp: now.toISOString(),
              expiresAt: expiresAt.toISOString()
            },
            updatedAt: now
          })
          .where(eq(schema.helpers.code, TASK_PUSH_LOCK_CODE));

        return true;
      }
    } else {
      // Create new lock
      await db
        .insert(schema.helpers)
        .values({
          code: TASK_PUSH_LOCK_CODE,
          state: {
            locked: true,
            timestamp: now.toISOString(),
            expiresAt: expiresAt.toISOString()
          }
        });

      return true;
    }
  } catch (error) {
    console.error('Failed to acquire database lock:', error);
    return false;
  }
}

async function releaseDatabaseLock(): Promise<void> {
  try {
    // Update lock to unlocked state
    await db
      .update(schema.helpers)
      .set({
        state: {
          locked: false,
          timestamp: new Date().toISOString(),
          expiresAt: new Date().toISOString() // Set to current time since it's released
        },
        updatedAt: new Date()
      })
      .where(eq(schema.helpers.code, TASK_PUSH_LOCK_CODE));
  } catch (error) {
    console.error('Failed to release database lock:', error);
  }
}

/**
 * Main recursive task pushing function with database locking
 */
export async function tryPushTasks(): Promise<{ pushed: number; errors: string[] }> {
  // Check and acquire database lock
  if (!(await acquireDatabaseLock())) {
    // console.log('🚧 [tryPushTasks] already in progress');
    return { pushed: 0, errors: [] };
  }

  // console.log('🚀 [tryPushTasks] starting');

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
    // Always release database lock
    await releaseDatabaseLock();
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
        status: 'doing',
        activeAgentId: selectedAgent.id,
        lastPushedAt: now,
        lastAgentSessionStartedAt: now,
        lastAgentSessionId: task.lastAgentSessionId,
        updatedAt: now
      })
      .where(
        and(
          eq(schema.tasks.id, task.id),
          eq(schema.tasks.agentSessionStatus, 'INACTIVE') // Ensure no race condition
        )
      )
      .returning();

    if (updatedTask.length === 0) {
      return { success: false, error: `[pushTaskToAgent] Task ${task.id} was already assigned to another agent. Idempotently skipped pushing task.` };
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
      additionalRepositories: taskWithContext.additionalRepositories,
      claudeConfigDir: selectedAgent.agentSettings?.CLAUDE_CONFIG_DIR,
      stage: task.stage || 'clarify',
      taskData: { task, actor, project }
    });

    if (!spawnResult.success) {
      console.error(`🚧 [pushTaskToAgent] failed to spawn claude session for task ${task.id}. Reverting task status to INACTIVE.`);
      // Revert task status if spawn failed
      await db
        .update(schema.tasks)
        .set({
          agentSessionStatus: 'INACTIVE',
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
