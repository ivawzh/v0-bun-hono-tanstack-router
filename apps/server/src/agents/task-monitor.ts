/**
 * Function-based task monitoring system
 * Handles session status checking and recovery
 */

import { db } from '../db';
import { eq, and, ne, or, sql } from 'drizzle-orm';
import * as schema from '../db/schema/index';
import { getAllActiveSessions, cleanupStaleActiveSessions, getAllCompletedSessions, purgeCompletedSessions } from './session-registry';
import { tryPushTasks } from './task-pusher';

const config = {
  taskPushingInterval: 1000, // 1 second
  outOfSyncCheckingInterval: 120000, // 2 minutes
  sessionCleanupInterval: 600000, // 10 minutes
  sessionCleanupStaleMinutes: 60, // 1 hour
}

/**
 * Start monitoring system
 * Sets up periodic checking and cleanup
 */
export function startTaskMonitoring(): void {
  console.log('🔍 Starting task monitoring system...');

  // Initial out-of-sync task check on startup
  checkOutSyncedTasks().then(result => {
    purgeCompletedSessions();

    if (result.recovered > 0) {
      console.log(`🔧 Initial recovery: ${result.recovered} out-of-sync tasks`);
      // Try to push tasks after recovery
      tryPushTasks();
    }
  });

  // Periodic out-of-sync task checking (every 2 minutes)
  setInterval(async () => {
    const result = await checkOutSyncedTasks();
    if (result.recovered > 0) {
      // Try to push tasks after recovery
      tryPushTasks();
    }
  }, config.outOfSyncCheckingInterval);

  // Periodic active session registry cleanup (every 10 minutes)
  setInterval(async () => {
    try {
      const cleaned = await cleanupStaleActiveSessions(config.sessionCleanupStaleMinutes); // Clean sessions older than 1 hour
      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} stale sessions`);
      }
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
    }
  }, config.sessionCleanupInterval);

  // Periodic task pushing (every 10 seconds)
  setInterval(async () => {
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
  }, config.taskPushingInterval);

  console.log(`🎯 Task monitoring system started successfully`);
  console.log(`  🚀 Task pushing: every ${config.taskPushingInterval / 1000} seconds`);
  console.log(`  🔍 Out-of-sync checking: every ${config.outOfSyncCheckingInterval / 1000} seconds`);
  console.log(`  🧹 Session cleanup: every ${config.sessionCleanupInterval / 1000} seconds (stale > ${config.sessionCleanupStaleMinutes} minutes)`);
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
        ne(schema.tasks.status, 'done')
      )
    );

  const readyTasksCount = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.ready, true),
        eq(schema.tasks.agentSessionStatus, 'NON_ACTIVE'),
        ne(schema.tasks.status, 'done')
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
          ne(schema.tasks.status, 'done')
        )
      );

    for (const task of potentialOutSyncedTasks) {
      const hasCompletedSession = task.lastAgentSessionId && completedSessionIds.has(task.lastAgentSessionId);
      const hasActiveSession = task.lastAgentSessionId && activeSessionIds.has(task.lastAgentSessionId);
      if (hasCompletedSession || !hasActiveSession) {
        // Task is completed or lost - reset to NON_ACTIVE
        await db
          .update(schema.tasks)
          .set({
            agentSessionStatus: 'NON_ACTIVE',
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
