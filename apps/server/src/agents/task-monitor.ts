/**
 * Function-based task monitoring system
 * Handles session status checking and recovery
 * Uses Croner for simplified job scheduling
 */

import { db } from '../db';
import { eq, and, ne, or, sql } from 'drizzle-orm';
import * as schema from '../db/schema/index';
import { getAllActiveSessions, deleteOldActiveSessions, getAllCompletedSessions, purgeCompletedSessions } from './session-registry';
import { tryPushTasks } from './task-pusher';
import { startHotReloadSafeCron } from '../utils/hot-reload-safe-interval';

/**
 * Claude Code SDK fail to invoke hooks so that session registry is not working.
 * TODO: turn on after issue is fixed
 * @see https://github.com/anthropics/claude-code/issues/6223
 */
const runInitialAndOutOfSyncCheck = false;

const config = {
  sessionCleanupStaleMinutes: 60, // 1 hour
  taskPushingJobCron: '*/10 * * * * *', // every 10 seconds
  outOfSyncCheckingJobCron: '*/2 * * * *', // every 2 minutes
  sessionCleanupJobCron: '*/10 * * * *', // every 10 minutes
}

// Store job references for cleanup
let taskPushingJob: any = null;
let outOfSyncCheckingJob: any = null;
let sessionCleanupJob: any = null;

/**
 * Start monitoring system
 * Sets up periodic checking and cleanup using Croner
 */
export function startTaskMonitoring(): void {
  console.log('🔍 Starting task monitoring system...');

  // Initial out-of-sync task check on startup
  if (runInitialAndOutOfSyncCheck) {
    checkOutSyncedTasks().then(result => {
      purgeCompletedSessions();

      if (result.recovered > 0) {
        console.log(`🔧 Initial recovery: ${result.recovered} out-of-sync tasks`);
        // Try to push tasks after recovery
        tryPushTasks();
      }
    });
  }

  // Periodic task pushing (every 1 second)
  taskPushingJob = startHotReloadSafeCron(
    'task-pushing',
    config.taskPushingJobCron,
    async () => {
      try {
        const result = await tryPushTasks();
        if (result.pushed > 0) {
          console.log(`🚀 Pushed ${result.pushed} tasks`);
        }
        if (result.errors.length > 0) {
          console.error('❌ Task pushing errors:', result.errors);
        }
      } catch (error) {
        console.error('❌ Task pushing failed:', error);
      }
    }
  );

  if (runInitialAndOutOfSyncCheck) {
    // Periodic out-of-sync task checking (every 2 minutes)
    outOfSyncCheckingJob = startHotReloadSafeCron(
      'out-of-sync-checking',
      config.outOfSyncCheckingJobCron,
      async () => {
        const result = await checkOutSyncedTasks();
        if (result.recovered > 0) {
          // Try to push tasks after recovery
          tryPushTasks();
        }
      }
    );
  }

  // Periodic active session registry cleanup (every 10 minutes)
  sessionCleanupJob = startHotReloadSafeCron(
    'session-cleanup',
    config.sessionCleanupJobCron,
    async () => {
      try {
        const cleaned = await deleteOldActiveSessions(config.sessionCleanupStaleMinutes);
        if (cleaned > 0) {
          console.log(`🧹 Cleaned up ${cleaned} stale sessions`);
        }
      } catch (error) {
        console.error('❌ Session cleanup failed:', error);
      }
    }
  );

  console.log(`🎯 Task monitoring system started successfully`);
  console.log(`  🚀 Task pushing: every 10 second`);
  console.log(`  🔍 Out-of-sync checking: every 2 minutes`);
  console.log(`  🧹 Session cleanup: every 10 minutes (stale > ${config.sessionCleanupStaleMinutes} minutes)`);
}

/**
 * Stop monitoring system and clean up jobs
 */
export function stopTaskMonitoring(): void {
  console.log('🛑 Stopping task monitoring system...');

  // Mark jobs as should stop in global state (handled by hot-reload-safe wrapper)
  const intervals = globalThis.__soloUnicornIntervals;
  if (intervals) {
    const taskPushingEntry = intervals.get('task-pushing');
    if (taskPushingEntry) taskPushingEntry.shouldStop = true;

    const outOfSyncEntry = intervals.get('out-of-sync-checking');
    if (outOfSyncEntry) outOfSyncEntry.shouldStop = true;

    const sessionCleanupEntry = intervals.get('session-cleanup');
    if (sessionCleanupEntry) sessionCleanupEntry.shouldStop = true;
  }

  // Also stop the Croner jobs directly if they exist
  if (taskPushingJob) {
    taskPushingJob.stop();
    taskPushingJob = null;
  }

  if (outOfSyncCheckingJob) {
    outOfSyncCheckingJob.stop();
    outOfSyncCheckingJob = null;
  }

  if (sessionCleanupJob) {
    sessionCleanupJob.stop();
    sessionCleanupJob = null;
  }

  console.log('✅ Task monitoring system stopped');
}

/**
 * Get monitoring system status
 */
export async function getMonitoringStatus() {
  const activeSessions = await getAllActiveSessions();

  const activeTasksCount = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(schema.tasks)
    .where(
      and(
        or(
          eq(schema.tasks.agentSessionStatus, 'PUSHING'),
          eq(schema.tasks.agentSessionStatus, 'ACTIVE')
        ),
        ne(schema.tasks.list, 'done')
      )
    );

  const readyTasksCount = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.ready, true),
        eq(schema.tasks.agentSessionStatus, 'INACTIVE'),
        ne(schema.tasks.list, 'done')
      )
    );

  return {
    activeSessions: activeSessions.length,
    activeTasksInDb: activeTasksCount[0]?.count || 0,
    readyTasks: readyTasksCount[0]?.count || 0,
    sessionRegistry: activeSessions
  };
}

/**
 * Check for out-of-sync tasks and recover them
 * Called on server startup and periodically
 *
 * Work it works:
 * 1. Get all active session IDs from file registry
 * 2. Get all completed session IDs from file registry
 * 3. Find tasks that think they're active
 * 4. For each active task:
 *    - check if we find the matching completed session ID, if so, reset to INACTIVE
 *    - check if we find the matching active session ID, if not, reset to INACTIVE
 * 5. Log the results
 */
async function checkOutSyncedTasks(): Promise<{ recovered: number; errors: string[] }> {
  const errors: string[] = [];
  let recovered = 0;

  try {
    console.log('🔍 Checking for out-of-sync tasks...');

    // Get all sessions from file registry
    const activeSessions = await getAllActiveSessions();
    const completedSessions = await getAllCompletedSessions();
    const activeSessionIds = new Set(activeSessions.map(s => s.sessionId));
    const completedSessionIds = new Set(completedSessions.map(s => s.sessionId));

    // Find tasks that think they're active
    const potentialOutSyncedTasks = await db
      .select()
      .from(schema.tasks)
      .where(
        and(
          or(
            eq(schema.tasks.agentSessionStatus, 'PUSHING'),
            eq(schema.tasks.agentSessionStatus, 'ACTIVE')
          ),
          ne(schema.tasks.list, 'done')
        )
      );

    for (const task of potentialOutSyncedTasks) {
      const hasCompletedSession = task.lastAgentSessionId && completedSessionIds.has(task.lastAgentSessionId);
      const hasActiveSession = task.lastAgentSessionId && activeSessionIds.has(task.lastAgentSessionId);
      if (hasCompletedSession || !hasActiveSession) {
        // Task is completed or lost - reset to INACTIVE
        await db
          .update(schema.tasks)
          .set({
            agentSessionStatus: 'INACTIVE',
            activeAgentId: null,
            updatedAt: new Date()
          })
          .where(eq(schema.tasks.id, task.id));

        recovered++;
        console.log(`🔧 Recovered a task: ${task.id}. It was ${hasCompletedSession ? 'completed (a completed session was found)' : 'lost (no active or completed session was found)'}.`);
      }
    }

    console.log(`✅ Out-of-sync tasks check complete. Recovered ${recovered} tasks.`);
    return { recovered, errors };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMsg);
    console.error('❌ Out-of-sync tasks check failed:', error);
    return { recovered, errors };
  }
}
