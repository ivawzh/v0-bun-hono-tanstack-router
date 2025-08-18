/**
 * V2 Agent Orchestrator Function Modules
 * Function-based orchestrator replacing class-based architecture
 */

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
 * Get ready tasks sorted by priority
 */
export async function getReadyTasks(): Promise<TaskWithPriority[]> {
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
      eq(schema.tasks.ready, true),
      eq(schema.tasks.isAiWorking, false),
      or(
        eq(schema.tasks.status, 'todo'),
        eq(schema.tasks.status, 'loop')
      )
    ))
    .orderBy(
      desc(schema.tasks.priority),
      asc(schema.tasks.columnOrder),
      asc(schema.tasks.createdAt)
    );

  return tasks as TaskWithPriority[];
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
    .from(schema.taskRepositories)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskRepositories.taskId))
    .where(and(
      eq(schema.taskRepositories.repositoryId, repositoryId),
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
 * Return loop task to loop column (bottom placement)
 */
export async function returnTaskToLoop(taskId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get task and its project
    const task = await db.select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId))
      .limit(1);

    if (!task[0]) {
      return { success: false, error: 'Task not found' };
    }

    // Get current loop tasks to calculate new bottom position
    const loopTasks = await db.select()
      .from(schema.tasks)
      .where(and(
        eq(schema.tasks.projectId, task[0].projectId),
        eq(schema.tasks.status, 'loop')
      ))
      .orderBy(desc(schema.tasks.columnOrder));

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
 * Main orchestration function - checks for work and assigns tasks
 */
export async function checkAndAssignTasks(): Promise<{
  assigned: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let assigned = 0;

  try {
    // Get available agents
    const availableAgents = await getAvailableAgents();
    
    if (availableAgents.length === 0) {
      return { assigned: 0, errors: [] };
    }

    // Check if regular tasks are available
    const hasRegularTasks = await hasRegularTasksAvailable();
    
    let tasksToProcess: TaskWithPriority[];
    
    if (hasRegularTasks) {
      // Prioritize regular tasks (todo, doing)
      tasksToProcess = await getReadyTasks();
    } else {
      // No regular tasks - use loop tasks
      tasksToProcess = await getLoopTasks();
    }

    // Process each task
    for (const task of tasksToProcess) {
      // Check repository capacity
      const repoCapacity = await getRepositoryCapacity(task.mainRepositoryId);
      
      if (!repoCapacity || !repoCapacity.isAvailable) {
        continue; // Repository at capacity
      }

      // Find best agent for this task
      const selectedAgentId = await selectBestAgent(task.id, availableAgents);
      
      if (!selectedAgentId) {
        continue; // No suitable agent available
      }

      // Assign task
      const result = await assignTaskToAgent(task.id, selectedAgentId, task.mainRepositoryId);
      
      if (result.success) {
        assigned++;
        console.log(`🤖 Assigned task ${task.id} to agent ${selectedAgentId}`);
        
        // Remove agent from available list if at capacity
        const agentIndex = availableAgents.findIndex(a => a.agentId === selectedAgentId);
        if (agentIndex >= 0) {
          availableAgents[agentIndex].currentLoad++;
          if (availableAgents[agentIndex].currentLoad >= availableAgents[agentIndex].maxCapacity) {
            availableAgents.splice(agentIndex, 1);
          }
        }
      } else {
        errors.push(result.error || 'Unknown assignment error');
      }

      // Stop if no more agents available
      if (availableAgents.length === 0) {
        break;
      }
    }

    return { assigned, errors };
  } catch (error) {
    console.error('Orchestration error:', error);
    return { 
      assigned, 
      errors: [...errors, error instanceof Error ? error.message : 'Unknown error'] 
    };
  }
}

/**
 * Get orchestration status for debugging
 */
export async function getOrchestrationStatus() {
  const readyTasks = await getReadyTasks();
  const availableAgents = await getAvailableAgents();
  const hasRegular = await hasRegularTasksAvailable();
  const loopTasks = await getLoopTasks();

  return {
    schemaVersion: 'v2',
    orchestratorEnabled: true,
    readyTasksCount: readyTasks.length,
    availableAgentsCount: availableAgents.length,
    hasRegularTasks: hasRegular,
    loopTasksCount: loopTasks.length,
    timestamp: new Date().toISOString()
  };
}

/**
 * Initialize V2 orchestrator (startup function)
 */
export async function initializeV2Orchestrator(): Promise<void> {
  console.log('🤖 Initializing V2 Agent Orchestrator...');
  
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
  global.__v2OrchestatorInterval = checkInterval;
  
  console.log('🤖 V2 Agent Orchestrator initialized');
}

/**
 * Shutdown V2 orchestrator (cleanup function)
 */
export async function shutdownV2Orchestrator(): Promise<void> {
  console.log('🤖 Shutting down V2 Agent Orchestrator...');
  
  if (global.__v2OrchestatorInterval) {
    clearInterval(global.__v2OrchestatorInterval);
    global.__v2OrchestatorInterval = undefined;
  }
  
  console.log('🤖 V2 Agent Orchestrator shutdown complete');
}

// Global type declaration for cleanup
declare global {
  var __v2OrchestatorInterval: NodeJS.Timeout | undefined;
}