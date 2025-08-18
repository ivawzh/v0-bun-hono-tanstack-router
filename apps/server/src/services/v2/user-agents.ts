/**
 * V2 User Agents Service
 * CRUD operations for user-owned agents
 */

import { db } from '../../db';
import { eq, and } from 'drizzle-orm';
import * as v2Schema from '../../db/schema/v2';

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
 * Ensure V2 schema is enabled
 */
function requireV2Schema() {
  if (!useV2Schema()) {
    throw new Error('User agents are only available in V2 schema. Enable with USE_V2_SCHEMA=true');
  }
}

/**
 * Create a new user-owned agent
 */
export async function createUserAgent(input: CreateAgentInput) {
  requireV2Schema();

  const agent = await db.insert(v2Schema.agents).values({
    userId: input.userId,
    name: input.name,
    agentType: input.agentType,
    agentSettings: input.agentSettings,
    maxConcurrencyLimit: input.maxConcurrencyLimit || 1,
    state: {}
  }).returning();

  return agent[0];
}

/**
 * Get all agents for a user
 */
export async function getUserAgents(userId: string) {
  requireV2Schema();

  return await db.select()
    .from(v2Schema.agents)
    .where(eq(v2Schema.agents.userId, userId))
    .orderBy(v2Schema.agents.createdAt);
}

/**
 * Get a specific agent by ID (with ownership check)
 */
export async function getUserAgent(userId: string, agentId: string) {
  requireV2Schema();

  const agents = await db.select()
    .from(v2Schema.agents)
    .where(and(
      eq(v2Schema.agents.id, agentId),
      eq(v2Schema.agents.userId, userId)
    ))
    .limit(1);

  return agents[0] || null;
}

/**
 * Update an agent
 */
export async function updateUserAgent(userId: string, agentId: string, input: UpdateAgentInput) {
  requireV2Schema();

  const updated = await db.update(v2Schema.agents)
    .set({
      ...input,
      updatedAt: new Date()
    })
    .where(and(
      eq(v2Schema.agents.id, agentId),
      eq(v2Schema.agents.userId, userId)
    ))
    .returning();

  return updated[0] || null;
}

/**
 * Update agent state (for orchestrator)
 */
export async function updateAgentState(agentId: string, stateUpdate: AgentStateUpdate) {
  requireV2Schema();

  const agent = await db.select()
    .from(v2Schema.agents)
    .where(eq(v2Schema.agents.id, agentId))
    .limit(1);

  if (!agent[0]) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const currentState = agent[0].state as Record<string, any> || {};
  const newState = { ...currentState, ...stateUpdate };

  const updated = await db.update(v2Schema.agents)
    .set({
      state: newState,
      lastTaskPushedAt: stateUpdate.lastTaskPushedAt ? new Date(stateUpdate.lastTaskPushedAt) : undefined,
      updatedAt: new Date()
    })
    .where(eq(v2Schema.agents.id, agentId))
    .returning();

  return updated[0];
}

/**
 * Delete an agent
 */
export async function deleteUserAgent(userId: string, agentId: string) {
  requireV2Schema();

  // Check if agent has active tasks
  const activeTasks = await db.select()
    .from(v2Schema.taskAgents)
    .innerJoin(v2Schema.tasks, eq(v2Schema.tasks.id, v2Schema.taskAgents.taskId))
    .where(and(
      eq(v2Schema.taskAgents.agentId, agentId),
      eq(v2Schema.tasks.isAiWorking, true)
    ))
    .limit(1);

  if (activeTasks.length > 0) {
    throw new Error('Cannot delete agent with active tasks');
  }

  const deleted = await db.delete(v2Schema.agents)
    .where(and(
      eq(v2Schema.agents.id, agentId),
      eq(v2Schema.agents.userId, userId)
    ))
    .returning();

  return deleted[0] || null;
}

/**
 * Check if an agent is available for new tasks
 */
export async function isAgentAvailable(agentId: string): Promise<boolean> {
  requireV2Schema();

  const agent = await db.select()
    .from(v2Schema.agents)
    .where(eq(v2Schema.agents.id, agentId))
    .limit(1);

  if (!agent[0]) {
    return false;
  }

  const state = agent[0].state as Record<string, any> || {};
  const now = new Date().getTime();

  // Check rate limit status
  if (state.rateLimitResetAt) {
    const resetTime = new Date(state.rateLimitResetAt).getTime();
    if (resetTime > now) {
      return false; // Still rate limited
    }
  }

  // Check recent task assignment cooldown
  if (agent[0].lastTaskPushedAt) {
    const lastPushTime = agent[0].lastTaskPushedAt.getTime();
    const timeSinceLastPush = now - lastPushTime;

    if (timeSinceLastPush <= 20 * 1000) { // 20 second cooldown
      return false;
    }
  }

  // Check current workload
  const activeTaskCount = await db.select()
    .from(v2Schema.taskAgents)
    .innerJoin(v2Schema.tasks, eq(v2Schema.tasks.id, v2Schema.taskAgents.taskId))
    .where(and(
      eq(v2Schema.taskAgents.agentId, agentId),
      eq(v2Schema.tasks.isAiWorking, true)
    ));

  const maxConcurrentTasks = agent[0].maxConcurrencyLimit || 1;
  return activeTaskCount.length < maxConcurrentTasks;
}

/**
 * Get available agents for a user
 */
export async function getAvailableUserAgents(userId: string) {
  requireV2Schema();

  const userAgents = await getUserAgents(userId);
  const availableAgents = [];

  for (const agent of userAgents) {
    const isAvailable = await isAgentAvailable(agent.id);
    if (isAvailable) {
      availableAgents.push(agent);
    }
  }

  return availableAgents;
}

/**
 * Get agents with their current task counts
 */
export async function getUserAgentsWithTaskCounts(userId: string) {
  requireV2Schema();

  const agents = await getUserAgents(userId);
  const agentsWithCounts = [];

  for (const agent of agents) {
    const activeTaskCount = await db.select()
      .from(v2Schema.taskAgents)
      .innerJoin(v2Schema.tasks, eq(v2Schema.tasks.id, v2Schema.taskAgents.taskId))
      .where(and(
        eq(v2Schema.taskAgents.agentId, agent.id),
        eq(v2Schema.tasks.isAiWorking, true)
      ));

    const totalTaskCount = await db.select()
      .from(v2Schema.taskAgents)
      .where(eq(v2Schema.taskAgents.agentId, agent.id));

    agentsWithCounts.push({
      ...agent,
      activeTaskCount: activeTaskCount.length,
      totalTaskCount: totalTaskCount.length,
      isAvailable: await isAgentAvailable(agent.id)
    });
  }

  return agentsWithCounts;
}

/**
 * Assign agent to task
 */
export async function assignAgentToTask(agentId: string, taskId: string) {
  requireV2Schema();

  // Check if assignment already exists
  const existing = await db.select()
    .from(v2Schema.taskAgents)
    .where(and(
      eq(v2Schema.taskAgents.agentId, agentId),
      eq(v2Schema.taskAgents.taskId, taskId)
    ))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const assignment = await db.insert(v2Schema.taskAgents).values({
    agentId,
    taskId
  }).returning();

  return assignment[0];
}

/**
 * Remove agent from task
 */
export async function removeAgentFromTask(agentId: string, taskId: string) {
  requireV2Schema();

  const removed = await db.delete(v2Schema.taskAgents)
    .where(and(
      eq(v2Schema.taskAgents.agentId, agentId),
      eq(v2Schema.taskAgents.taskId, taskId)
    ))
    .returning();

  return removed[0] || null;
}

/**
 * Get tasks assigned to an agent
 */
export async function getAgentTasks(agentId: string) {
  requireV2Schema();

  const tasksWithAgent = await db.select({
    task: v2Schema.tasks,
    assignment: v2Schema.taskAgents
  })
    .from(v2Schema.tasks)
    .innerJoin(v2Schema.taskAgents, eq(v2Schema.taskAgents.taskId, v2Schema.tasks.id))
    .where(eq(v2Schema.taskAgents.agentId, agentId))
    .orderBy(v2Schema.tasks.priority, v2Schema.tasks.createdAt);

  return tasksWithAgent.map(row => row.task);
}

/**
 * Create default agents for a user (helper for migration)
 */
export async function createDefaultAgentsForUser(userId: string) {
  requireV2Schema();

  // Create a default Claude Code agent
  const claudeAgent = await createUserAgent({
    userId,
    name: 'Claude Code Agent',
    agentType: 'CLAUDE_CODE',
    agentSettings: {},
    maxConcurrencyLimit: 1
  });

  return [claudeAgent];
}