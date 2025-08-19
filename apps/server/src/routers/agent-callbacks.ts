/**
 * Agent callback routes for session lifecycle events
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/index';
import { pingSession, unregisterSession, getSession } from '../agents/session-registry';
import { triggerTaskPush, getMonitoringStatus } from '../agents/task-monitor';
import { requireClaudeCodeUIAuth } from '../lib/guards';

const app = new Hono();

// Validation schemas
const sessionStartedSchema = z.object({
  sessionId: z.string(),
  workingDirectory: z.string(),
  timestamp: z.string()
});

const sessionCompletedSchema = z.object({
  sessionId: z.string(),
  workingDirectory: z.string(),
  timestamp: z.string()
});

const rateLimitedSchema = z.object({
  sessionId: z.string(),
  resetTimestamp: z.string(),
  workingDirectory: z.string(),
  timestamp: z.string()
});

/**
 * Session started callback
 * Called by hook when Claude Code session starts
 */
app.post('/session-started', requireClaudeCodeUIAuth, zValidator('json', sessionStartedSchema), async (c) => {
  try {
    const { sessionId, workingDirectory, timestamp } = c.req.valid('json');
    
    console.log(`📡 Session started callback: ${sessionId} in ${workingDirectory}`);

    // Get session data from registry
    const sessionData = await getSession(sessionId);
    
    if (!sessionData) {
      console.warn(`⚠️  Session ${sessionId} not found in registry`);
      return c.json({ success: false, error: 'Session not found in registry' }, 404);
    }

    // Update task status to ACTIVE
    const updatedTask = await db
      .update(schema.tasks)
      .set({
        agentSessionStatus: 'ACTIVE',
        lastAgentSessionStartedAt: new Date(timestamp),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(schema.tasks.id, sessionData.taskId),
          eq(schema.tasks.agentSessionStatus, 'PUSHING') // Only update if currently pushing
        )
      )
      .returning();

    if (updatedTask.length === 0) {
      console.warn(`⚠️  Task ${sessionData.taskId} was not in PUSHING state`);
    }

    // Update session registry with ping
    await pingSession(sessionId);

    console.log(`✅ Session ${sessionId} marked as ACTIVE`);
    return c.json({ success: true });

  } catch (error) {
    console.error('❌ Session started callback failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

/**
 * Session completed callback
 * Called by hook when Claude Code session ends
 */
app.post('/session-completed', requireClaudeCodeUIAuth, zValidator('json', sessionCompletedSchema), async (c) => {
  try {
    const { sessionId, workingDirectory, timestamp } = c.req.valid('json');
    
    console.log(`📡 Session completed callback: ${sessionId}`);

    // Get session data from registry
    const sessionData = await getSession(sessionId);
    
    if (!sessionData) {
      console.warn(`⚠️  Session ${sessionId} not found in registry`);
      return c.json({ success: false, error: 'Session not found in registry' }, 404);
    }

    // Update task status to NON_ACTIVE
    const updatedTask = await db
      .update(schema.tasks)
      .set({
        agentSessionStatus: 'NON_ACTIVE',
        activeAgentId: null,
        updatedAt: new Date()
      })
      .where(eq(schema.tasks.id, sessionData.taskId))
      .returning();

    // Remove session from registry
    await unregisterSession(sessionId);

    console.log(`✅ Session ${sessionId} completed and cleaned up`);

    // Trigger task pushing to assign new tasks
    setImmediate(() => {
      triggerTaskPush().catch(error => {
        console.error('❌ Failed to trigger task push after session completion:', error);
      });
    });

    return c.json({ success: true });

  } catch (error) {
    console.error('❌ Session completed callback failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

/**
 * Rate limited callback
 * Called by hook when Claude Code hits rate limit
 */
app.post('/rate-limited', requireClaudeCodeUIAuth, zValidator('json', rateLimitedSchema), async (c) => {
  try {
    const { sessionId, resetTimestamp, workingDirectory, timestamp } = c.req.valid('json');
    
    console.log(`📡 Rate limited callback: ${sessionId}, reset at ${resetTimestamp}`);

    // Get session data from registry
    const sessionData = await getSession(sessionId);
    
    if (!sessionData) {
      console.warn(`⚠️  Session ${sessionId} not found in registry`);
      return c.json({ success: false, error: 'Session not found in registry' }, 404);
    }

    // Update agent rate limit timestamp
    await db
      .update(schema.agents)
      .set({
        rateLimitResetAt: new Date(resetTimestamp),
        updatedAt: new Date()
      })
      .where(eq(schema.agents.id, sessionData.agentId));

    // Update task status to NON_ACTIVE (will be picked up again when rate limit expires)
    await db
      .update(schema.tasks)
      .set({
        agentSessionStatus: 'NON_ACTIVE',
        activeAgentId: null,
        updatedAt: new Date()
      })
      .where(eq(schema.tasks.id, sessionData.taskId));

    // Remove session from registry since it's no longer active
    await unregisterSession(sessionId);

    console.log(`✅ Rate limit processed for agent ${sessionData.agentId}, reset at ${resetTimestamp}`);

    // Schedule task pushing for when rate limit expires
    const resetTime = new Date(resetTimestamp);
    const delay = resetTime.getTime() - Date.now();
    
    if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Only schedule if within 24 hours
      setTimeout(() => {
        triggerTaskPush().catch(error => {
          console.error('❌ Failed to trigger task push after rate limit expiry:', error);
        });
      }, delay);
      
      console.log(`⏰ Scheduled task push in ${Math.round(delay / 60000)} minutes when rate limit expires`);
    }

    return c.json({ success: true });

  } catch (error) {
    console.error('❌ Rate limited callback failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

/**
 * Manual trigger endpoint for task pushing
 */
app.post('/trigger-push', requireClaudeCodeUIAuth, async (c) => {
  try {
    const result = await triggerTaskPush();
    return c.json({
      success: true,
      pushed: result.pushed,
      errors: result.errors
    });
  } catch (error) {
    console.error('❌ Manual task push trigger failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

/**
 * Get monitoring status endpoint
 */
app.get('/status', async (c) => {
  try {
    const status = await getMonitoringStatus();
    return c.json(status);
  } catch (error) {
    console.error('❌ Get monitoring status failed:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

export default app;