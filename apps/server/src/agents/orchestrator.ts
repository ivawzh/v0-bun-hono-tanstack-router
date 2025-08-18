import { db } from '../db';
import { eq, and, or, ne, desc, asc, sql, notExists, inArray } from 'drizzle-orm';
import * as schema from '../db/schema/index';
import { updateAgentState } from '../services/v2/user-agents';
import { updateRepositoryLastTaskPushed } from '../services/v2/repositories';
import { generatePrompt, type TaskStage } from './prompts';

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

// Global type declaration for cleanup
declare global {
  var __orchestatorInterval: NodeJS.Timeout | undefined;
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


/**
 * Get the top priority ready task with all necessary joins in one query
 * This eliminates N+1 queries by getting everything needed upfront
 */
async function getTopReadyTaskWithDetails(): Promise<TaskWithDetails | null> {
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
async function getAvailableAgentsWithCapacity(): Promise<AgentWithCapacity[]> {
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
async function getRepositoryCapacityOptimized(repositoryId: string): Promise<RepositoryWithCapacity | null> {
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
function selectBestAvailableAgent(
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
async function assignTaskToAgent(
  taskId: string,
  agentId: string,
  repositoryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date();

    // Get task with repository information
    const taskWithRepo = await db
      .select({
        task: schema.tasks,
        repository: schema.repositories,
        actor: schema.actors,
        project: schema.projects
      })
      .from(schema.tasks)
      .innerJoin(schema.repositories, eq(schema.repositories.id, schema.tasks.mainRepositoryId))
      .innerJoin(schema.actors, eq(schema.actors.id, schema.tasks.actorId))
      .innerJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
      .where(eq(schema.tasks.id, taskId))
      .limit(1);

    if (taskWithRepo.length === 0) {
      return { success: false, error: 'Task not found' };
    }

    const { task, repository, actor, project } = taskWithRepo[0];

    const prompt = generatePrompt(task.stage as TaskStage || 'clarify', {
      task,
      actor,
      project
    })

    // Call Claude Code UI endpoint to assign task
    await fetch(`${process.env.CLAUDE_CODE_UI_URL}/api/solo-unicorn-extension/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLAUDE_CODE_UI_AUTH_TOKEN}`
      },
      body: JSON.stringify({
        prompt,
        agentType: 'CLAUDE_CODE',
        agentOptions: {
          resume: !!task.lastAgentSessionId,
          sessionId: task.lastAgentSessionId,
          projectPath: repository.repoPath,
          cwd: repository.repoPath,
          toolsSettings: {
            allowedTools: [
              "Bash(git log:*)",
              "Bash(git diff:*)",
              "Bash(git status:*)",
              "Write",
              "Read",
              "Edit",
              "Glob",
              "Grep",
              "MultiEdit",
              "Task",
              "WebSearch",
              "WebFetch",
              "TodoRead",
              "TodoWrite",
              // Solo Unicorn MCP tools
              "mcp__solo-unicorn__task_update",
              "mcp__solo-unicorn__agent_rateLimit",
              "mcp__solo-unicorn__project_memory_update",
              "mcp__solo-unicorn__project_memory_get",
              "mcp__solo-unicorn__task_create"
            ],
            disallowedTools: [],
            skipPermissions: true
          },
        },
        soloUnicornParams: {
          taskId,
          projectId: task.projectId,
          mainRepoId: task.mainRepositoryId
        }
      })
    });

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
async function checkAndAssignTasks(): Promise<{
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
