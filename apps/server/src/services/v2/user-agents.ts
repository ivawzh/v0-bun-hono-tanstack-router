/**
 * V2 User Agents Service
 * CRUD operations for user-owned agents
 */

import { db } from '../../db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../db/schema/index';

interface CreateAgentInput {
  userId: string;
  name: string;
  agentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE';
  agentSettings: Record<string, any>;
  maxConcurrencyLimit?: number;
}

interface UpdateAgentInput {
  name?: string;
  agentSettings?: Record<string, any>;
  maxConcurrencyLimit?: number;
  state?: Record<string, any>;
}

interface AgentStateUpdate {
  rateLimitResetAt?: string;
  lastTaskPushedAt?: string;
  lastMessagedAt?: string;
  lastSessionCompletedAt?: string;
}


/**
 * Update agent state (for orchestrator)
 */
export async function updateAgentState(agentId: string, stateUpdate: AgentStateUpdate) {

  const agent = await db.select()
    .from(schema.agents)
    .where(eq(schema.agents.id, agentId))
    .limit(1);

  if (!agent[0]) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const currentState = agent[0].state as Record<string, any> || {};
  const newState = { ...currentState, ...stateUpdate };

  const updated = await db.update(schema.agents)
    .set({
      state: newState,
      lastTaskPushedAt: stateUpdate.lastTaskPushedAt ? new Date(stateUpdate.lastTaskPushedAt) : undefined,
      updatedAt: new Date()
    })
    .where(eq(schema.agents.id, agentId))
    .returning();

  return updated[0];
}
