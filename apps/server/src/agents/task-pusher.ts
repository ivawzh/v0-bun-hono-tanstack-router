/**
 * Recursive task pushing with global locking mechanism
 */

import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/index';
import { findNextAssignableTask, selectBestAvailableAgent, type TaskWithContext } from './task-finder';
import { spawnClaudeSession } from './claude-spawner';

// Hot-reload-safe global lock using globalThis with automatic cleanup
declare global {
  var __soloUnicornTaskPushLock: {
    locked: boolean;
    timestamp: number;
    moduleVersion: string;
  } | undefined;
}

const MODULE_VERSION = Date.now().toString(); // Unique per hot reload
const LOCK_TIMEOUT_MS = 10000; // 10 second safety timeout

function acquireGlobalLock(): boolean {
  const now = Date.now();

  // Check if lock exists and is stale (older than timeout or from different module version)
  if (globalThis.__soloUnicornTaskPushLock) {
    const lock = globalThis.__soloUnicornTaskPushLock;
    const isStale = (now - lock.timestamp) > LOCK_TIMEOUT_MS;
    const isDifferentModule = lock.moduleVersion !== MODULE_VERSION;

    if (isStale || isDifferentModule) {
      console.warn(`⚠️ Clearing stale task push lock either it exceeded stale timeout (every ${LOCK_TIMEOUT_MS / 1000} seconds) or it is hot reloaded`);
      globalThis.__soloUnicornTaskPushLock = undefined;
    } else if (lock.locked) {
      return false; // Lock is active and fresh
    }
  }

  // Acquire lock
  globalThis.__soloUnicornTaskPushLock = {
    locked: true,
    timestamp: now,
    moduleVersion: MODULE_VERSION
  };

  return true;
}

function releaseGlobalLock(): void {
  if (globalThis.__soloUnicornTaskPushLock?.moduleVersion === MODULE_VERSION) {
    globalThis.__soloUnicornTaskPushLock.locked = false;
  }
}

/**
 * Main recursive task pushing function with global locking
 */
export async function tryPushTasks(): Promise<{ pushed: number; errors: string[] }> {
  // Check and acquire global lock
  if (!acquireGlobalLock()) {
    // console.log('🚧 tryPushTasks] already in progre');
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
    // Always release global lock
    releaseGlobalLock();
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
