import { db } from '../../db';
import { eq, and, or, ne, desc, asc, sql, notExists, inArray } from 'drizzle-orm';
import * as schema from '../../db/schema/index';
import { updateAgentState } from '../../services/v2/user-agents';
import { updateRepositoryLastTaskPushed } from '../../services/v2/repositories';

interface TaskWithDetails {
  task: any;
  mainRepository: any;
  actor: any;
  project: any;
  assignedAgents: any[];
}

interface AgentWithCapacity {
  agent: any;
  currentActiveTasks: number;
  availableCapacity: number;
  isAtCapacity: boolean;
}

interface RepositoryWithCapacity {
  repository: any;
  currentActiveTasks: number;
  availableCapacity: number;
  isAtCapacity: boolean;
}

/**
 * Get the top priority ready task with all necessary joins in one query
 * This eliminates N+1 queries by getting everything needed upfront
 */
export async function getTopReadyTaskWithDetails(): Promise<TaskWithDetails | null> {
  // Single query to get the highest priority ready task with all dependencies checked
  const readyTasks = await db
    .select({
      task: schema.tasks,
      mainRepository: schema.repositories,
      actor: schema.actors,
      project: schema.projects
    })
    .from(schema.tasks)
    .innerJoin(schema.repositories, eq(schema.repositories.id, schema.tasks.mainRepositoryId))
    .leftJoin(schema.actors, eq(schema.actors.id, schema.tasks.actorId))
    .innerJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
    .where(
      and(
        eq(schema.tasks.ready, true),
        eq(schema.tasks.isAiWorking, false),
        ne(schema.tasks.status, 'done'),
        // Only tasks with no incomplete dependencies
        notExists(
          db.select()
            .from(schema.taskDependencies)
            .innerJoin(schema.tasks as any, eq(schema.taskDependencies.dependsOnTaskId, (schema.tasks as any).id))
            .where(
              and(
                eq(schema.taskDependencies.taskId, schema.tasks.id),
                ne((schema.tasks as any).status, 'done')
              )
            )
        )
      )
    )
    .orderBy(
      desc(schema.tasks.priority), // Higher numbers = higher priority (5 > 4 > 3 > 2 > 1)
      sql`CASE 
        WHEN ${schema.tasks.status} = 'doing' THEN 3 
        WHEN ${schema.tasks.status} = 'todo' THEN 2 
        WHEN ${schema.tasks.status} = 'loop' THEN 1 
        ELSE 0 
      END DESC`, // Status weight: doing > todo > loop
      asc(sql`CAST(${schema.tasks.columnOrder} AS DECIMAL)`),
      asc(schema.tasks.createdAt)
    )
    .limit(1);

  if (readyTasks.length === 0) {
    return null;
  }

  const result = readyTasks[0];

  // Get assigned agents for this task in one query
  const assignedAgents = await db
    .select({
      agent: schema.agents
    })
    .from(schema.taskAgents)
    .innerJoin(schema.agents, eq(schema.agents.id, schema.taskAgents.agentId))
    .where(eq(schema.taskAgents.taskId, result.task.id));

  return {
    task: result.task,
    mainRepository: result.mainRepository,
    actor: result.actor,
    project: result.project,
    assignedAgents: assignedAgents.map(a => a.agent)
  };
}

/**
 * Get all available agents with their current capacity in optimized queries
 */
export async function getAvailableAgentsWithCapacity(): Promise<AgentWithCapacity[]> {
  // Get all agents
  const agents = await db
    .select()
    .from(schema.agents)
    .orderBy(asc(schema.agents.lastTaskPushedAt)); // Agents with oldest last push first

  if (agents.length === 0) {
    return [];
  }

  // Get current active task counts for all agents in one query
  const agentTaskCounts = await db
    .select({
      agentId: schema.taskAgents.agentId,
      activeTaskCount: sql<number>`COUNT(*)`.as('activeTaskCount')
    })
    .from(schema.taskAgents)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskAgents.taskId))
    .where(
      and(
        eq(schema.tasks.isAiWorking, true),
        ne(schema.tasks.status, 'done')
      )
    )
    .groupBy(schema.taskAgents.agentId);

  // Create lookup map
  const taskCountMap = new Map<string, number>();
  agentTaskCounts.forEach(atc => {
    taskCountMap.set(atc.agentId, atc.activeTaskCount);
  });

  // Build result with capacity info
  const agentsWithCapacity: AgentWithCapacity[] = [];
  
  for (const agent of agents) {
    const currentActiveTasks = taskCountMap.get(agent.id) || 0;
    const maxCapacity = agent.maxConcurrencyLimit || 1;
    const availableCapacity = maxCapacity - currentActiveTasks;
    const isAtCapacity = availableCapacity <= 0;

    // Only include agents that have capacity and are not rate limited
    if (!isAtCapacity && !isAgentRateLimited(agent)) {
      agentsWithCapacity.push({
        agent,
        currentActiveTasks,
        availableCapacity,
        isAtCapacity
      });
    }
  }

  return agentsWithCapacity;
}

/**
 * Get repository capacity for a specific repository
 */
export async function getRepositoryCapacity(repositoryId: string): Promise<RepositoryWithCapacity | null> {
  // Get repository
  const repository = await db
    .select()
    .from(schema.repositories)
    .where(eq(schema.repositories.id, repositoryId))
    .limit(1);

  if (repository.length === 0) {
    return null;
  }

  // Get current active task count for this repository in one optimized query
  const [mainTaskCount, additionalTaskCount] = await Promise.all([
    // Count tasks where this repo is the main repository
    db
      .select({
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.mainRepositoryId, repositoryId),
          eq(schema.tasks.isAiWorking, true),
          ne(schema.tasks.status, 'done')
        )
      ),
    
    // Count tasks where this repo is an additional repository
    db
      .select({
        count: sql<number>`COUNT(*)`.as('count')
      })
      .from(schema.taskAdditionalRepositories)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskAdditionalRepositories.taskId))
      .where(
        and(
          eq(schema.taskAdditionalRepositories.repositoryId, repositoryId),
          eq(schema.tasks.isAiWorking, true),
          ne(schema.tasks.status, 'done')
        )
      )
  ]);

  const currentActiveTasks = (mainTaskCount[0]?.count || 0) + (additionalTaskCount[0]?.count || 0);
  const maxCapacity = repository[0].maxConcurrencyLimit || 1;
  const availableCapacity = maxCapacity - currentActiveTasks;
  const isAtCapacity = availableCapacity <= 0;

  return {
    repository: repository[0],
    currentActiveTasks,
    availableCapacity,
    isAtCapacity
  };
}

/**
 * Check if agent is rate limited (simplified check)
 */
function isAgentRateLimited(agent: any): boolean {
  if (!agent.state?.rateLimitResetAt) {
    return false;
  }

  const resetTime = new Date(agent.state.rateLimitResetAt);
  return resetTime > new Date();
}

/**
 * Find the best available agent for a task from assigned agents
 */
export function selectBestAvailableAgent(
  assignedAgents: any[],
  availableAgents: AgentWithCapacity[]
): AgentWithCapacity | null {
  if (assignedAgents.length === 0 || availableAgents.length === 0) {
    return null;
  }

  // Get assigned agent IDs
  const assignedAgentIds = new Set(assignedAgents.map(a => a.id));

  // Filter available agents to only those assigned to this task
  const eligibleAgents = availableAgents.filter(agentCapacity =>
    assignedAgentIds.has(agentCapacity.agent.id)
  );

  if (eligibleAgents.length === 0) {
    return null;
  }

  // Sort by available capacity (highest first), then by last task push time (oldest first)
  eligibleAgents.sort((a, b) => {
    // Prefer agents with more available capacity
    if (a.availableCapacity !== b.availableCapacity) {
      return b.availableCapacity - a.availableCapacity;
    }

    // Prefer agents that haven't been used recently
    const aTime = a.agent.lastTaskPushedAt?.getTime() || 0;
    const bTime = b.agent.lastTaskPushedAt?.getTime() || 0;
    return aTime - bTime;
  });

  return eligibleAgents[0];
}

/**
 * Assign task to agent with minimal database operations
 */
export async function assignTaskToAgent(
  taskId: string,
  agentId: string,
  repositoryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date();

    // Get task to determine initial stage
    const task = await db.select({
      status: schema.tasks.status,
      stage: schema.tasks.stage
    })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId))
      .limit(1);

    if (!task[0]) {
      return { success: false, error: 'Task not found' };
    }

    // Determine initial stage based on task status
    let initialStage = 'refine';
    if (task[0].status === 'loop') {
      initialStage = 'loop'; // Loop tasks keep loop stage
    } else if (task[0].stage) {
      initialStage = task[0].stage; // Keep existing stage if present
    }

    // Update task status in one operation
    await db.update(schema.tasks)
      .set({
        isAiWorking: true,
        aiWorkingSince: now,
        status: 'doing',
        stage: initialStage,
        updatedAt: now
      })
      .where(eq(schema.tasks.id, taskId));

    // Update agent and repository tracking in parallel
    await Promise.all([
      updateAgentState(agentId, {
        lastTaskPushedAt: now.toISOString()
      }),
      updateRepositoryLastTaskPushed(repositoryId)
    ]);

    return { success: true };
  } catch (error) {
    console.error('Failed to assign task to agent:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Main optimized orchestration function
 * Uses efficient queries to minimize database round trips
 */
export async function checkAndAssignOptimizedTasks(): Promise<{
  assigned: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let assigned = 0;

  try {
    // Get available agents with capacity (one optimized query)
    const availableAgents = await getAvailableAgentsWithCapacity();

    if (availableAgents.length === 0) {
      return { assigned: 0, errors: [] };
    }

    // Process tasks one by one (since we want to assign the highest priority first)
    while (availableAgents.length > 0) {
      // Get the top priority ready task (single optimized query)
      const taskWithDetails = await getTopReadyTaskWithDetails();

      if (!taskWithDetails) {
        break; // No more ready tasks
      }

      // Check repository capacity (optimized query)
      const repoCapacity = await getRepositoryCapacity(taskWithDetails.task.mainRepositoryId);

      if (!repoCapacity || repoCapacity.isAtCapacity) {
        // Repository at capacity - try to find another task
        // For now, we'll break to avoid infinite loop, but in practice
        // you might want to mark this repository as unavailable and continue
        break;
      }

      // Find best available agent from assigned agents
      const selectedAgent = selectBestAvailableAgent(
        taskWithDetails.assignedAgents,
        availableAgents
      );

      if (!selectedAgent) {
        break; // No suitable agent available
      }

      // Assign task
      const result = await assignTaskToAgent(
        taskWithDetails.task.id,
        selectedAgent.agent.id,
        taskWithDetails.task.mainRepositoryId
      );

      if (result.success) {
        assigned++;
        console.log(`🤖 Assigned task ${taskWithDetails.task.id} to agent ${selectedAgent.agent.id}`);

        // Update agent capacity and remove if at limit
        selectedAgent.currentActiveTasks++;
        selectedAgent.availableCapacity--;
        
        if (selectedAgent.availableCapacity <= 0) {
          const agentIndex = availableAgents.findIndex(a => a.agent.id === selectedAgent.agent.id);
          if (agentIndex >= 0) {
            availableAgents.splice(agentIndex, 1);
          }
        }
      } else {
        errors.push(result.error || 'Unknown assignment error');
        break; // Stop on errors to avoid infinite loop
      }
    }

    return { assigned, errors };
  } catch (error) {
    console.error('Optimized orchestration error:', error);
    return {
      assigned,
      errors: [...errors, error instanceof Error ? error.message : 'Unknown error']
    };
  }
}

/**
 * Return loop task to loop column (same as original)
 */
export async function returnTaskToLoop(taskId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get task and its project
    const task = await db.select({
      projectId: schema.tasks.projectId
    })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId))
      .limit(1);

    if (!task[0]) {
      return { success: false, error: 'Task not found' };
    }

    // Get current loop tasks to calculate new bottom position
    const loopTasks = await db.select({
      columnOrder: schema.tasks.columnOrder
    })
      .from(schema.tasks)
      .where(and(
        eq(schema.tasks.projectId, task[0].projectId),
        eq(schema.tasks.status, 'loop')
      ))
      .orderBy(desc(schema.tasks.columnOrder))
      .limit(1);

    // Calculate new column order (bottom of loop column)
    const lastOrder = loopTasks.length > 0 ?
      parseFloat(loopTasks[0].columnOrder) :
      1000;
    const newOrder = (lastOrder + 1000).toString();

    // Return task to loop
    await db.update(schema.tasks)
      .set({
        status: 'loop',
        stage: 'loop',
        isAiWorking: false,
        aiWorkingSince: null,
        columnOrder: newOrder,
        updatedAt: new Date()
      })
      .where(eq(schema.tasks.id, taskId));

    return { success: true };
  } catch (error) {
    console.error('Failed to return task to loop:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}