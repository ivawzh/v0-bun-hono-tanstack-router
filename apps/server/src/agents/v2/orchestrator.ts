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

interface TaskWithPriority {
  id: string;
  priority: number;
  columnOrder: string;
  status: string;
  stage: string | null;
  ready: boolean | null;
  isAiWorking: boolean | null;
  mainRepositoryId: string;
  createdAt: Date;
}

interface AgentCapacity {
  agentId: string;
  currentLoad: number;
  maxCapacity: number;
  isAvailable: boolean;
  lastTaskPushedAt: Date | null;
}

interface RepositoryCapacity {
  repositoryId: string;
  currentLoad: number;
  maxCapacity: number;
  isAvailable: boolean;
  lastTaskPushedAt: Date | null;
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
 * Get ready tasks sorted by priority > column (doing > todo > loop) > columnOrder
 * Includes dependency checking - only tasks with completed dependencies are ready
 * LEGACY: Kept for compatibility, use getTopReadyTaskWithDetails() for better performance
 */
export async function getReadyTasks(): Promise<TaskWithPriority[]> {
  // Get all ready tasks from todo, doing, and loop columns
  const allTasks = await db.select({
    id: schema.tasks.id,
    priority: schema.tasks.priority,
    columnOrder: schema.tasks.columnOrder,
    status: schema.tasks.status,
    stage: schema.tasks.stage,
    ready: schema.tasks.ready,
    isAiWorking: schema.tasks.isAiWorking,
    mainRepositoryId: schema.tasks.mainRepositoryId,
    createdAt: schema.tasks.createdAt
  })
    .from(schema.tasks)
    .where(and(
      eq(schema.tasks.ready, true),
      eq(schema.tasks.isAiWorking, false),
      or(
        eq(schema.tasks.status, 'todo'),
        eq(schema.tasks.status, 'doing'),
        eq(schema.tasks.status, 'loop')
      )
    ));

  // Filter tasks that have all dependencies completed
  const readyTasks: TaskWithPriority[] = [];

  for (const task of allTasks) {
    const hasUncompletedDependencies = await checkTaskDependencies(task.id);
    if (!hasUncompletedDependencies) {
      readyTasks.push(task as TaskWithPriority);
    }
  }

  // Sort by: priority (desc) > column status (doing > todo > loop) > columnOrder (asc)
  readyTasks.sort((a, b) => {
    // First: Priority (higher priority first)
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }

    // Second: Column status ordering (doing > todo > loop)
    const statusOrder = { doing: 1, todo: 2, loop: 3 };
    const aStatusOrder = statusOrder[a.status as keyof typeof statusOrder] || 4;
    const bStatusOrder = statusOrder[b.status as keyof typeof statusOrder] || 4;

    if (aStatusOrder !== bStatusOrder) {
      return aStatusOrder - bStatusOrder;
    }

    // Third: Column order (lower number first)
    const aOrder = parseFloat(a.columnOrder);
    const bOrder = parseFloat(b.columnOrder);
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    // Fourth: Creation date (older first)
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return readyTasks;
}

/**
 * Check if task has any uncompleted dependencies
 * Returns true if there are uncompleted dependencies (task not ready)
 * Returns false if all dependencies are completed (task is ready)
 */
async function checkTaskDependencies(taskId: string): Promise<boolean> {
  // Get all dependencies for this task
  const dependencies = await db.select({
    dependsOnTaskId: schema.taskDependencies.dependsOnTaskId
  })
    .from(schema.taskDependencies)
    .where(eq(schema.taskDependencies.taskId, taskId));

  if (dependencies.length === 0) {
    return false; // No dependencies, task is ready
  }

  // Check if all dependency tasks are completed
  for (const dep of dependencies) {
    const dependencyTask = await db.select({
      status: schema.tasks.status
    })
      .from(schema.tasks)
      .where(eq(schema.tasks.id, dep.dependsOnTaskId))
      .limit(1);

    if (dependencyTask.length === 0 || dependencyTask[0].status !== 'done') {
      return true; // Has uncompleted dependency
    }
  }

  return false; // All dependencies completed
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
 * Get available agents with capacity information
 * LEGACY: Kept for compatibility, use getAvailableAgentsWithCapacity() for better performance
 */
export async function getAvailableAgents(): Promise<AgentCapacity[]> {
  const agents = await db.select()
    .from(schema.agents)
    .orderBy(schema.agents.lastTaskPushedAt); // Agents with oldest last push first

  const agentCapacities: AgentCapacity[] = [];

  for (const agent of agents) {
    // Count current active tasks
    const activeTasks = await db.select()
      .from(schema.taskAgents)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskAgents.taskId))
      .where(and(
        eq(schema.taskAgents.agentId, agent.id),
        eq(schema.tasks.isAiWorking, true),
        ne(schema.tasks.status, 'done')
      ));

    const currentLoad = activeTasks.length;
    const maxCapacity = agent.maxConcurrencyLimit || 1;
    const isAvailable = !isAgentRateLimited(agent) && currentLoad < maxCapacity;

    agentCapacities.push({
      agentId: agent.id,
      currentLoad,
      maxCapacity,
      isAvailable,
      lastTaskPushedAt: agent.lastTaskPushedAt
    });
  }

  return agentCapacities.filter(ac => ac.isAvailable);
}

/**
 * Get repository capacity for a specific repository
 */
export async function getRepositoryCapacityOptimized(repositoryId: string): Promise<RepositoryWithCapacity | null> {
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
 * Get repository capacity information
 * LEGACY: Kept for compatibility, use getRepositoryCapacityOptimized() for better performance
 */
export async function getRepositoryCapacity(repositoryId: string): Promise<RepositoryCapacity | null> {
  const repository = await db.select()
    .from(schema.repositories)
    .where(eq(schema.repositories.id, repositoryId))
    .limit(1);

  if (!repository[0]) return null;

  // Count tasks using this repository (main + additional)
  const mainTasks = await db.select()
    .from(schema.tasks)
    .where(and(
      eq(schema.tasks.mainRepositoryId, repositoryId),
      eq(schema.tasks.isAiWorking, true),
      ne(schema.tasks.status, 'done')
    ));

  const additionalTasks = await db.select()
    .from(schema.taskAdditionalRepositories)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskAdditionalRepositories.taskId))
    .where(and(
      eq(schema.taskAdditionalRepositories.repositoryId, repositoryId),
      eq(schema.tasks.isAiWorking, true),
      ne(schema.tasks.status, 'done')
    ));

  const currentLoad = mainTasks.length + additionalTasks.length;
  const maxCapacity = repository[0].maxConcurrencyLimit || 1;

  return {
    repositoryId,
    currentLoad,
    maxCapacity,
    isAvailable: currentLoad < maxCapacity,
    lastTaskPushedAt: repository[0].lastTaskPushedAt
  };
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
 * Find the best agent for a task
 * LEGACY: Kept for compatibility, use selectBestAvailableAgent() for better performance
 */
export async function selectBestAgent(
  taskId: string,
  availableAgents: AgentCapacity[]
): Promise<string | null> {
  if (availableAgents.length === 0) {
    return null;
  }

  // Get agents assigned to this task
  const assignedAgents = await db.select()
    .from(schema.taskAgents)
    .where(eq(schema.taskAgents.taskId, taskId));

  const assignedAgentIds = assignedAgents.map(ta => ta.agentId);

  // Filter available agents to only those assigned to this task
  const eligibleAgents = availableAgents.filter(agent =>
    assignedAgentIds.includes(agent.agentId)
  );

  if (eligibleAgents.length === 0) {
    return null;
  }

  // Select agent with lowest current load, then by least recent task push
  eligibleAgents.sort((a, b) => {
    if (a.currentLoad !== b.currentLoad) {
      return a.currentLoad - b.currentLoad;
    }

    // Prefer agents that haven't been used recently
    const aTime = a.lastTaskPushedAt?.getTime() || 0;
    const bTime = b.lastTaskPushedAt?.getTime() || 0;
    return aTime - bTime;
  });

  return eligibleAgents[0].agentId;
}

/**
 * Check if any regular tasks (todo, doing) are available
 * This determines when to pick from loop tasks
 */
export async function hasRegularTasksAvailable(): Promise<boolean> {
  const tasks = await db.select()
    .from(schema.tasks)
    .where(and(
      eq(schema.tasks.ready, true),
      eq(schema.tasks.isAiWorking, false),
      or(
        eq(schema.tasks.status, 'todo'),
        eq(schema.tasks.status, 'doing')
      )
    ))
    .limit(1);

  return tasks.length > 0;
}

/**
 * Get loop tasks when no regular tasks are available
 */
export async function getLoopTasks(): Promise<TaskWithPriority[]> {
  const tasks = await db.select({
    id: schema.tasks.id,
    priority: schema.tasks.priority,
    columnOrder: schema.tasks.columnOrder,
    status: schema.tasks.status,
    stage: schema.tasks.stage,
    ready: schema.tasks.ready,
    isAiWorking: schema.tasks.isAiWorking,
    mainRepositoryId: schema.tasks.mainRepositoryId,
    createdAt: schema.tasks.createdAt
  })
    .from(schema.tasks)
    .where(and(
      eq(schema.tasks.status, 'loop'),
      eq(schema.tasks.ready, true),
      eq(schema.tasks.isAiWorking, false)
    ))
    .orderBy(
      desc(schema.tasks.priority),
      asc(schema.tasks.columnOrder),
      asc(schema.tasks.createdAt)
    );

  return tasks as TaskWithPriority[];
}

/**
 * Assign task to agent with minimal database operations
 */
export async function assignTaskToAgentOptimized(
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
 * Assign task to agent and update all tracking
 * LEGACY: Kept for compatibility, use assignTaskToAgentOptimized() for better performance
 */
export async function assignTaskToAgent(
  taskId: string,
  agentId: string,
  repositoryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date();

    // Get task to determine stage
    const task = await db.select()
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
    }

    // Update task status
    await db.update(schema.tasks)
      .set({
        isAiWorking: true,
        aiWorkingSince: now,
        status: 'doing',
        stage: initialStage,
        updatedAt: now
      })
      .where(eq(schema.tasks.id, taskId));

    // Update agent state
    await updateAgentState(agentId, {
      lastTaskPushedAt: now.toISOString()
    });

    // Update repository last task pushed
    await updateRepositoryLastTaskPushed(repositoryId);

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
 * Return loop task to loop column
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

/**
 * Main optimized orchestration function
 * Uses efficient queries to minimize database round trips
 */
export async function checkAndAssignTasks(): Promise<{
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
      const repoCapacity = await getRepositoryCapacityOptimized(taskWithDetails.task.mainRepositoryId);

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
      const result = await assignTaskToAgentOptimized(
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
 * Initialize orchestrator (startup function)
 */
export async function startOrchestrator(): Promise<void> {
  console.log('🤖 Initializing Agent Orchestrator...');

  // Set up periodic task checking
  const checkInterval = setInterval(async () => {
    try {
      const result = await checkAndAssignTasks();
      if (result.assigned > 0) {
        console.log(`🤖 Assigned ${result.assigned} tasks`);
      }
      if (result.errors.length > 0) {
        console.error('🤖 Orchestration errors:', result.errors);
      }
    } catch (error) {
      console.error('🤖 Orchestration check failed:', error);
    }
  }, 5000); // Check every 5 seconds

  // Store interval globally for cleanup
  global.__orchestatorInterval = checkInterval;

  console.log('🤖 Agent Orchestrator initialized');
}

/**
 * Shutdown orchestrator (cleanup function)
 */
export async function shutdownOrchestrator(): Promise<void> {
  console.log('🤖 Shutting down Agent Orchestrator...');

  if (global.__orchestatorInterval) {
    clearInterval(global.__orchestatorInterval);
    global.__orchestatorInterval = undefined;
  }

  console.log('🤖 Agent Orchestrator shutdown complete');
}

// Global type declaration for cleanup
declare global {
  var __orchestatorInterval: NodeJS.Timeout | undefined;
}
