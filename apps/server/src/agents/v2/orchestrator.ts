import { db } from '../../db';
import { eq, and, or, ne, desc, asc } from 'drizzle-orm';
import * as schema from '../../db/schema/index';
import { isAgentAvailable, updateAgentState } from '../../services/v2/user-agents';
import { isRepositoryAvailable, updateRepositoryLastTaskPushed } from '../../services/v2/repositories';

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
 * Get ready tasks sorted by priority > column (doing > todo > loop) > columnOrder
 * Includes dependency checking - only tasks with completed dependencies are ready
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
 * Get available agents with capacity information
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
    const isAvailable = await isAgentAvailable(agent.id);

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
 * Get repository capacity information
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
 * Find the best agent for a task
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
 * Assign task to agent and update all tracking
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
 * Return loop task to loop column (optimized version)
 */
export async function returnTaskToLoop(taskId: string): Promise<{ success: boolean; error?: string }> {
  // Import and delegate to optimized implementation
  const { returnTaskToLoop: optimizedReturn } = await import('./optimized-orchestrator');
  return optimizedReturn(taskId);
}

/**
 * Main orchestration function - uses optimized queries to minimize N+1 issues
 * Import and delegate to optimized implementation
 */
export async function checkAndAssignTasks(): Promise<{
  assigned: number;
  errors: string[];
}> {
  // Import optimized implementation
  const { checkAndAssignOptimizedTasks } = await import('./optimized-orchestrator');
  return checkAndAssignOptimizedTasks();
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
