/**
 * V2 Agents Router
 * User agent management APIs
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  createUserAgent,
  getUserAgents,
  getUserAgent,
  updateUserAgent,
  deleteUserAgent,
  getUserAgentsWithTaskCounts,
  getAvailableUserAgents,
  updateAgentState
} from '../../services/v2/user-agents';
import { requireAgentOwnership } from '../../lib/auth-v2';

const agentsRouter = new Hono();


// Input validation schemas
const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  agentType: z.enum(['CLAUDE_CODE', 'CURSOR_CLI', 'OPENCODE']),
  agentSettings: z.record(z.any()).optional().default({}),
  maxConcurrencyLimit: z.number().min(1).max(10).optional().default(1)
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  agentSettings: z.record(z.any()).optional(),
  maxConcurrencyLimit: z.number().min(1).max(10).optional()
});

const updateStateSchema = z.object({
  rateLimitResetAt: z.string().optional(),
  lastTaskPushedAt: z.string().optional(),
  lastMessagedAt: z.string().optional(),
  lastSessionCompletedAt: z.string().optional()
});

/**
 * GET /api/v2/agents
 * Get all agents for current user
 */
agentsRouter.get('/', async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const includeTaskCounts = c.req.query('includeTaskCounts') === 'true';
    
    let agents;
    if (includeTaskCounts) {
      agents = await getUserAgentsWithTaskCounts(userId);
    } else {
      agents = await getUserAgents(userId);
    }

    return c.json({ agents });
  } catch (error) {
    console.error('Failed to get user agents:', error);
    return c.json({ error: 'Failed to get agents' }, 500);
  }
});

/**
 * GET /api/v2/agents/available
 * Get available agents for current user
 */
agentsRouter.get('/available', async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const agents = await getAvailableUserAgents(userId);
    return c.json({ agents });
  } catch (error) {
    console.error('Failed to get available agents:', error);
    return c.json({ error: 'Failed to get available agents' }, 500);
  }
});

/**
 * POST /api/v2/agents
 * Create a new agent
 */
agentsRouter.post('/', zValidator('json', createAgentSchema), async (c) => {
  try {
    const userId = c.get('userId');
    if (!userId) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const input = c.req.valid('json');
    
    const agent = await createUserAgent({
      userId,
      ...input
    });

    return c.json({ agent }, 201);
  } catch (error) {
    console.error('Failed to create agent:', error);
    return c.json({ error: 'Failed to create agent' }, 500);
  }
});

/**
 * GET /api/v2/agents/:agentId
 * Get specific agent
 */
agentsRouter.get('/:agentId', requireAgentOwnership(), async (c) => {
  try {
    const agent = c.get('agent');
    return c.json({ agent });
  } catch (error) {
    console.error('Failed to get agent:', error);
    return c.json({ error: 'Failed to get agent' }, 500);
  }
});

/**
 * PUT /api/v2/agents/:agentId
 * Update agent
 */
agentsRouter.put('/:agentId', requireAgentOwnership(), zValidator('json', updateAgentSchema), async (c) => {
  try {
    const userId = c.get('userId');
    const agentId = c.req.param('agentId');
    const input = c.req.valid('json');

    const agent = await updateUserAgent(userId, agentId, input);
    
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    return c.json({ agent });
  } catch (error) {
    console.error('Failed to update agent:', error);
    return c.json({ error: 'Failed to update agent' }, 500);
  }
});

/**
 * PUT /api/v2/agents/:agentId/state
 * Update agent state (for orchestrator)
 */
agentsRouter.put('/:agentId/state', zValidator('json', updateStateSchema), async (c) => {
  try {
    const agentId = c.req.param('agentId');
    const stateUpdate = c.req.valid('json');

    const agent = await updateAgentState(agentId, stateUpdate);
    return c.json({ agent });
  } catch (error) {
    console.error('Failed to update agent state:', error);
    return c.json({ error: 'Failed to update agent state' }, 500);
  }
});

/**
 * DELETE /api/v2/agents/:agentId
 * Delete agent
 */
agentsRouter.delete('/:agentId', requireAgentOwnership(), async (c) => {
  try {
    const userId = c.get('userId');
    const agentId = c.req.param('agentId');

    const agent = await deleteUserAgent(userId, agentId);
    
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    return c.json({ success: true, agent });
  } catch (error) {
    console.error('Failed to delete agent:', error);
    
    if (error instanceof Error && error.message.includes('active tasks')) {
      return c.json({ error: error.message }, 400);
    }
    
    return c.json({ error: 'Failed to delete agent' }, 500);
  }
});

export default agentsRouter;