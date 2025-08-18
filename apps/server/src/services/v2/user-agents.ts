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
 * Create a new user-owned agent
 */
export async function createUserAgent(input: CreateAgentInput) {

  const agent = await db.insert(schema.agents).values({
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

  return await db.select()
    .from(schema.agents)
    .where(eq(schema.agents.userId, userId))
    .orderBy(schema.agents.createdAt);
}

/**
 * Get a specific agent by ID (with ownership check)
 */
export async function getUserAgent(userId: string, agentId: string) {

  const agents = await db.select()
    .from(schema.agents)
    .where(and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, userId)
    ))
    .limit(1);

  return agents[0] || null;
}

/**
 * Update an agent
 */
export async function updateUserAgent(userId: string, agentId: string, input: UpdateAgentInput) {

  const updated = await db.update(schema.agents)
    .set({
      ...input,
      updatedAt: new Date()
    })
    .where(and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, userId)
    ))
    .returning();

  return updated[0] || null;
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

/**
 * Delete an agent
 */
export async function deleteUserAgent(userId: string, agentId: string) {

  // Check if agent has active tasks
  const activeTasks = await db.select()
    .from(schema.taskAgents)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskAgents.taskId))
    .where(and(
      eq(schema.taskAgents.agentId, agentId),
      eq(schema.tasks.isAiWorking, true)
    ))
    .limit(1);

  if (activeTasks.length > 0) {
    throw new Error('Cannot delete agent with active tasks');
  }

  const deleted = await db.delete(schema.agents)
    .where(and(
      eq(schema.agents.id, agentId),
      eq(schema.agents.userId, userId)
    ))
    .returning();

  return deleted[0] || null;
}

/**
 * Check if an agent is available for new tasks
 */
export async function isAgentAvailable(agentId: string): Promise<boolean> {

  const agent = await db.select()
    .from(schema.agents)
    .where(eq(schema.agents.id, agentId))
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
    .from(schema.taskAgents)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskAgents.taskId))
    .where(and(
      eq(schema.taskAgents.agentId, agentId),
      eq(schema.tasks.isAiWorking, true)
    ));

  const maxConcurrentTasks = agent[0].maxConcurrencyLimit || 1;
  return activeTaskCount.length < maxConcurrentTasks;
}

/**
 * Get available agents for a user
 */
export async function getAvailableUserAgents(userId: string) {

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

  const agents = await getUserAgents(userId);
  const agentsWithCounts = [];

  for (const agent of agents) {
    const activeTaskCount = await db.select()
      .from(schema.taskAgents)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskAgents.taskId))
      .where(and(
        eq(schema.taskAgents.agentId, agent.id),
        eq(schema.tasks.isAiWorking, true)
      ));

    const totalTaskCount = await db.select()
      .from(schema.taskAgents)
      .where(eq(schema.taskAgents.agentId, agent.id));

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

  // Check if assignment already exists
  const existing = await db.select()
    .from(schema.taskAgents)
    .where(and(
      eq(schema.taskAgents.agentId, agentId),
      eq(schema.taskAgents.taskId, taskId)
    ))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const assignment = await db.insert(schema.taskAgents).values({
    agentId,
    taskId
  }).returning();

  return assignment[0];
}

/**
 * Remove agent from task
 */
export async function removeAgentFromTask(agentId: string, taskId: string) {

  const removed = await db.delete(schema.taskAgents)
    .where(and(
      eq(schema.taskAgents.agentId, agentId),
      eq(schema.taskAgents.taskId, taskId)
    ))
    .returning();

  return removed[0] || null;
}

/**
 * Get tasks assigned to an agent
 */
export async function getAgentTasks(agentId: string) {

  const tasksWithAgent = await db.select({
    task: schema.tasks,
    assignment: schema.taskAgents
  })
    .from(schema.tasks)
    .innerJoin(schema.taskAgents, eq(schema.taskAgents.taskId, schema.tasks.id))
    .where(eq(schema.taskAgents.agentId, agentId))
    .orderBy(schema.tasks.priority, schema.tasks.createdAt);

  return tasksWithAgent.map(row => row.task);
}

/**
 * Create default agents for a user (helper for migration)
 */
export async function createDefaultAgentsForUser(userId: string) {

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