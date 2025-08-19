/**
 * Function-based task monitoring system
 * Handles session status checking and recovery
 */

import { db } from '../db';
import { eq, and, ne, or, lt, sql } from 'drizzle-orm';
import * as schema from '../db/schema/index';
import { getAllActiveSessions, cleanupStaleSessions } from './session-registry';
import { tryPushTasks } from './task-pusher';

/**
 * Check for orphaned tasks and recover them
 * Called on server startup and periodically
 */
export async function checkOrphanedTasks(): Promise<{ recovered: number; errors: string[] }> {
  const errors: string[] = [];
  let recovered = 0;

  try {
    console.log('🔍 Checking for orphaned tasks...');

    // Get all sessions from file registry
    const activeSessions = await getAllActiveSessions();
    const activeSessionIds = new Set(activeSessions.map(s => s.sessionId));

    // Find tasks that think they're active but have no registry entry
    const potentialOrphans = await db
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

    for (const task of potentialOrphans) {
      const hasActiveSession = task.lastAgentSessionId && activeSessionIds.has(task.lastAgentSessionId);
      
      if (!hasActiveSession) {
        // Task is orphaned - reset to NON_ACTIVE
        await db
          .update(schema.tasks)
          .set({
            agentSessionStatus: 'NON_ACTIVE',
            activeAgentId: null,
            updatedAt: new Date()
          })
          .where(eq(schema.tasks.id, task.id));
        
        recovered++;
        console.log(`🔧 Recovered orphaned task: ${task.id}`);
      }
    }

    console.log(`✅ Orphan check complete. Recovered ${recovered} tasks.`);
    return { recovered, errors };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    errors.push(errorMsg);
    console.error('❌ Orphan check failed:', error);
    return { recovered, errors };
  }
}

/**
 * Start monitoring system
 * Sets up periodic checking and cleanup
 */
export function startTaskMonitoring(): void {
  console.log('🔍 Starting task monitoring system...');

  // Initial orphan check on startup
  checkOrphanedTasks().then(result => {
    if (result.recovered > 0) {
      console.log(`🔧 Initial recovery: ${result.recovered} orphaned tasks`);
      // Try to push tasks after recovery
      tryPushTasks();
    }
  });

  // Periodic orphan checking (every 2 minutes)
  setInterval(async () => {
    const result = await checkOrphanedTasks();
    if (result.recovered > 0) {
      // Try to push tasks after recovery
      tryPushTasks();
    }
  }, 120000); // 2 minutes

  // Periodic session registry cleanup (every 10 minutes)
  setInterval(async () => {
    try {
      const cleaned = await cleanupStaleSessions(60); // Clean sessions older than 1 hour
      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} stale sessions`);
      }
    } catch (error) {
      console.error('❌ Session cleanup failed:', error);
    }
  }, 600000); // 10 minutes

  // Periodic task pushing (every 30 seconds)
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
  }, 30000); // 30 seconds

  console.log('✅ Task monitoring system started');
}

/**
 * Manually trigger task pushing
 * Useful for webhooks and callbacks
 */
export async function triggerTaskPush(): Promise<{ pushed: number; errors: string[] }> {
  return await tryPushTasks();
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