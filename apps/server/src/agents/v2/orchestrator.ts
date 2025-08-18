/**
 * V2 Agent Orchestrator Function Modules
 * Function-based orchestrator replacing class-based architecture
 */

import { db } from '../../db';
import { eq, and, or, ne, desc, asc } from 'drizzle-orm';
import * as v1Schema from '../../db/schema/index';
import * as v2Schema from '../../db/schema/v2';
import { useV2Schema, useV2Orchestrator } from '../../lib/feature-flags';
import { isAgentAvailable, updateAgentState } from '../../services/v2/user-agents';
import { isRepositoryAvailable, updateRepositoryLastTaskPushed } from '../../services/v2/repositories';

interface TaskWithPriority {
  id: string;
  priority: number;
  columnOrder: string;
  status: string;
  stage: string | null;
  ready: boolean;
  isAiWorking: boolean;
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
  if (!useV2Schema()) {
    // V1 behavior
    const tasks = await db.select({
      id: v1Schema.tasks.id,
      priority: v1Schema.tasks.priority,
      columnOrder: v1Schema.tasks.columnOrder,
      status: v1Schema.tasks.status,
      stage: v1Schema.tasks.stage,
      ready: v1Schema.tasks.ready,
      isAiWorking: v1Schema.tasks.isAiWorking,
      mainRepositoryId: v1Schema.tasks.repoAgentId, // Map repoAgentId to mainRepositoryId
      createdAt: v1Schema.tasks.createdAt
    })
      .from(v1Schema.tasks)
      .where(and(
        eq(v1Schema.tasks.ready, true),
        eq(v1Schema.tasks.isAiWorking, false),
        or(
          eq(v1Schema.tasks.status, 'todo'),
          eq(v1Schema.tasks.status, 'loop')
        )
      ))
      .orderBy(
        desc(v1Schema.tasks.priority),
        asc(v1Schema.tasks.columnOrder),
        asc(v1Schema.tasks.createdAt)
      );

    return tasks;
  }

  // V2 behavior
  const tasks = await db.select({
    id: v2Schema.tasks.id,
    priority: v2Schema.tasks.priority,
    columnOrder: v2Schema.tasks.columnOrder,
    status: v2Schema.tasks.status,
    stage: v2Schema.tasks.stage,
    ready: v2Schema.tasks.ready,
    isAiWorking: v2Schema.tasks.isAiWorking,
    mainRepositoryId: v2Schema.tasks.mainRepositoryId,
    createdAt: v2Schema.tasks.createdAt
  })
    .from(v2Schema.tasks)
    .where(and(
      eq(v2Schema.tasks.ready, true),
      eq(v2Schema.tasks.isAiWorking, false),
      or(
        eq(v2Schema.tasks.status, 'todo'),
        eq(v2Schema.tasks.status, 'loop')
      )
    ))
    .orderBy(
      desc(v2Schema.tasks.priority),
      asc(v2Schema.tasks.columnOrder),
      asc(v2Schema.tasks.createdAt)
    );

  return tasks;
}

/**
 * Get available agents with capacity information
 */
export async function getAvailableAgents(): Promise<AgentCapacity[]> {
  if (!useV2Schema()) {
    // V1 doesn't have user agents - return empty
    return [];
  }

  const agents = await db.select()
    .from(v2Schema.agents)
    .orderBy(v2Schema.agents.lastTaskPushedAt); // Agents with oldest last push first

  const agentCapacities: AgentCapacity[] = [];

  for (const agent of agents) {
    // Count current active tasks
    const activeTasks = await db.select()
      .from(v2Schema.taskAgents)
      .innerJoin(v2Schema.tasks, eq(v2Schema.tasks.id, v2Schema.taskAgents.taskId))
      .where(and(
        eq(v2Schema.taskAgents.agentId, agent.id),
        eq(v2Schema.tasks.isAiWorking, true),
        ne(v2Schema.tasks.status, 'done')
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
  if (!useV2Schema()) {
    // V1 behavior - use repoAgent
    const repoAgent = await db.select()
      .from(v1Schema.repoAgents)
      .where(eq(v1Schema.repoAgents.id, repositoryId))
      .limit(1);

    if (!repoAgent[0]) return null;

    const activeTasks = await db.select()
      .from(v1Schema.tasks)
      .where(and(
        eq(v1Schema.tasks.repoAgentId, repositoryId),
        eq(v1Schema.tasks.isAiWorking, true),
        ne(v1Schema.tasks.status, 'done')
      ));

    return {
      repositoryId,
      currentLoad: activeTasks.length,
      maxCapacity: 1, // V1 default
      isAvailable: activeTasks.length < 1,
      lastTaskPushedAt: null
    };
  }

  const repository = await db.select()
    .from(v2Schema.repositories)
    .where(eq(v2Schema.repositories.id, repositoryId))
    .limit(1);

  if (!repository[0]) return null;

  // Count tasks using this repository (main + additional)
  const mainTasks = await db.select()
    .from(v2Schema.tasks)
    .where(and(
      eq(v2Schema.tasks.mainRepositoryId, repositoryId),
      eq(v2Schema.tasks.isAiWorking, true),
      ne(v2Schema.tasks.status, 'done')
    ));

  const additionalTasks = await db.select()
    .from(v2Schema.taskRepositories)
    .innerJoin(v2Schema.tasks, eq(v2Schema.tasks.id, v2Schema.taskRepositories.taskId))
    .where(and(
      eq(v2Schema.taskRepositories.repositoryId, repositoryId),
      eq(v2Schema.tasks.isAiWorking, true),
      ne(v2Schema.tasks.status, 'done')
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
  if (!useV2Schema()) {
    return null; // V1 doesn't use agent selection
  }

  if (availableAgents.length === 0) {
    return null;
  }

  // Get agents assigned to this task
  const assignedAgents = await db.select()
    .from(v2Schema.taskAgents)
    .where(eq(v2Schema.taskAgents.taskId, taskId));

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
  if (!useV2Schema()) {
    const tasks = await db.select()
      .from(v1Schema.tasks)
      .where(and(
        eq(v1Schema.tasks.ready, true),
        eq(v1Schema.tasks.isAiWorking, false),
        or(
          eq(v1Schema.tasks.status, 'todo'),
          eq(v1Schema.tasks.status, 'doing')
        )
      ))
      .limit(1);

    return tasks.length > 0;
  }

  const tasks = await db.select()
    .from(v2Schema.tasks)
    .where(and(
      eq(v2Schema.tasks.ready, true),
      eq(v2Schema.tasks.isAiWorking, false),
      or(
        eq(v2Schema.tasks.status, 'todo'),
        eq(v2Schema.tasks.status, 'doing')
      )
    ))
    .limit(1);

  return tasks.length > 0;
}

/**
 * Get loop tasks when no regular tasks are available
 */
export async function getLoopTasks(): Promise<TaskWithPriority[]> {
  if (!useV2Schema()) {
    // V1 doesn't support loop tasks
    return [];
  }

  const tasks = await db.select({
    id: v2Schema.tasks.id,
    priority: v2Schema.tasks.priority,
    columnOrder: v2Schema.tasks.columnOrder,
    status: v2Schema.tasks.status,
    stage: v2Schema.tasks.stage,
    ready: v2Schema.tasks.ready,
    isAiWorking: v2Schema.tasks.isAiWorking,
    mainRepositoryId: v2Schema.tasks.mainRepositoryId,
    createdAt: v2Schema.tasks.createdAt
  })
    .from(v2Schema.tasks)
    .where(and(
      eq(v2Schema.tasks.status, 'loop'),
      eq(v2Schema.tasks.ready, true),
      eq(v2Schema.tasks.isAiWorking, false)
    ))
    .orderBy(
      desc(v2Schema.tasks.priority),
      asc(v2Schema.tasks.columnOrder),
      asc(v2Schema.tasks.createdAt)
    );

  return tasks;
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

    if (!useV2Schema()) {
      // V1 behavior - just update task
      await db.update(v1Schema.tasks)
        .set({
          isAiWorking: true,
          aiWorkingSince: now,
          status: 'doing',
          stage: 'refine', // V1 always starts with refine
          updatedAt: now
        })
        .where(eq(v1Schema.tasks.id, taskId));

      return { success: true };
    }

    // V2 behavior - get task to determine stage
    const task = await db.select()
      .from(v2Schema.tasks)
      .where(eq(v2Schema.tasks.id, taskId))
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
    await db.update(v2Schema.tasks)
      .set({
        isAiWorking: true,
        aiWorkingSince: now,
        status: 'doing',
        stage: initialStage,
        updatedAt: now
      })
      .where(eq(v2Schema.tasks.id, taskId));

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
    if (!useV2Schema()) {
      return { success: false, error: 'Loop tasks require V2 schema' };
    }

    // Get task and its project
    const task = await db.select()
      .from(v2Schema.tasks)
      .where(eq(v2Schema.tasks.id, taskId))
      .limit(1);

    if (!task[0]) {
      return { success: false, error: 'Task not found' };
    }

    // Get current loop tasks to calculate new bottom position
    const loopTasks = await db.select()
      .from(v2Schema.tasks)
      .where(and(
        eq(v2Schema.tasks.projectId, task[0].projectId),
        eq(v2Schema.tasks.status, 'loop')
      ))
      .orderBy(desc(v2Schema.tasks.columnOrder));

    // Calculate new column order (bottom of loop column)
    const lastOrder = loopTasks.length > 0 ? 
      parseFloat(loopTasks[0].columnOrder) : 
      1000;
    const newOrder = (lastOrder + 1000).toString();

    // Return task to loop
    await db.update(v2Schema.tasks)
      .set({
        status: 'loop',
        stage: 'loop',
        isAiWorking: false,
        aiWorkingSince: null,
        columnOrder: newOrder,
        updatedAt: new Date()
      })
      .where(eq(v2Schema.tasks.id, taskId));

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
  if (!useV2Orchestrator()) {
    return { assigned: 0, errors: ['V2 orchestrator not enabled'] };
  }

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
    schemaVersion: useV2Schema() ? 'v2' : 'v1',
    orchestratorEnabled: useV2Orchestrator(),
    readyTasksCount: readyTasks.length,
    availableAgentsCount: availableAgents.length,
    hasRegularTasks: hasRegular,
    loopTasksCount: loopTasks.length,
    timestamp: new Date().toISOString()
  };
}