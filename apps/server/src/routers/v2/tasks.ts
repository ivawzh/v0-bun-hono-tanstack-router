/**
 * V2 Tasks Router
 * Enhanced task management with multi-repo/multi-agent support
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db';
import { eq, and, or, inArray } from 'drizzle-orm';
import * as schema from '../../db/schema/index';
import { requireProjectAccess } from '../../lib/auth-v2';
import {
  assignAgentToTask,
  removeAgentFromTask
} from '../../services/v2/user-agents';
import {
  addRepositoryToTask,
  removeRepositoryFromTask,
  getTaskAdditionalRepositories
} from '../../services/v2/repositories';

const tasksRouter = new Hono();


// Input validation schemas
const createTaskSchema = z.object({
  rawTitle: z.string().min(1).max(500),
  rawDescription: z.string().optional(),
  mainRepositoryId: z.string().uuid(),
  additionalRepositoryIds: z.array(z.string().uuid()).optional().default([]),
  assignedAgentIds: z.array(z.string().uuid()).optional().default([]),
  actorId: z.string().uuid().optional(),
  priority: z.number().min(1).max(5).optional().default(3),
  ready: z.boolean().optional().default(false),
  status: z.enum(['todo', 'doing', 'done', 'loop']).optional().default('todo'),
  stage: z.enum(['refine', 'plan', 'execute', 'loop']).optional(),
  attachments: z.array(z.any()).optional().default([])
});

const updateTaskAssignmentsSchema = z.object({
  assignedAgentIds: z.array(z.string().uuid()),
  additionalRepositoryIds: z.array(z.string().uuid()).optional().default([])
});

const updateTaskStatusSchema = z.object({
  status: z.enum(['todo', 'doing', 'done', 'loop']),
  stage: z.enum(['refine', 'plan', 'execute', 'loop']).optional(),
  isAiWorking: z.boolean().optional(),
  lastAgentSessionId: z.string().optional()
});

/**
 * GET /api/v2/projects/:projectId/tasks
 * Get all tasks for a project with V2 enhancements
 */
tasksRouter.get('/projects/:projectId/tasks', requireProjectAccess(), async (c) => {
  const projectId = c.req.param('projectId');
  
  const tasks = await db.select({
    task: schema.tasks,
    mainRepository: schema.repositories,
    actor: schema.actors
  })
    .from(schema.tasks)
    .leftJoin(schema.repositories, eq(schema.repositories.id, schema.tasks.mainRepositoryId))
    .leftJoin(schema.actors, eq(schema.actors.id, schema.tasks.actorId))
    .where(eq(schema.tasks.projectId, projectId))
    .orderBy(schema.tasks.priority, schema.tasks.createdAt);

  // Get assigned agents and additional repositories for each task
  const tasksWithRelations = [];
  for (const row of tasks) {
      // Get assigned agents
      const taskAgents = await db.select({
        agent: schema.agents
      })
        .from(schema.taskAgents)
        .innerJoin(schema.agents, eq(schema.agents.id, schema.taskAgents.agentId))
        .where(eq(schema.taskAgents.taskId, row.task.id));

      // Get additional repositories
      const additionalRepositories = await getTaskAdditionalRepositories(row.task.id);

      tasksWithRelations.push({
        ...row.task,
        mainRepository: row.mainRepository,
        actor: row.actor,
        assignedAgents: taskAgents.map(ta => ta.agent),
        additionalRepositories
      });
    }

  return c.json({ tasks: tasksWithRelations });
});

/**
 * POST /api/v2/projects/:projectId/tasks
 * Create a new task with V2 multi-repo/multi-agent support
 */
tasksRouter.post('/projects/:projectId/tasks', 
  requireProjectAccess(), 
  zValidator('json', createTaskSchema), 
  async (c) => {
    try {
      const projectId = c.req.param('projectId');
      const input = c.req.valid('json');

      // Create the task
      const task = await db.insert(schema.tasks).values({
        projectId,
        mainRepositoryId: input.mainRepositoryId,
        actorId: input.actorId,
        rawTitle: input.rawTitle,
        rawDescription: input.rawDescription,
        priority: input.priority,
        ready: input.ready,
        status: input.status,
        stage: input.stage,
        attachments: input.attachments
      }).returning();

      const createdTask = task[0];

      // Assign agents
      for (const agentId of input.assignedAgentIds) {
        await assignAgentToTask(agentId, createdTask.id);
      }

      // Add additional repositories
      for (const repositoryId of input.additionalRepositoryIds) {
        await addRepositoryToTask(createdTask.id, repositoryId);
      }

      // Return task with relations
      const mainRepository = await db.select()
        .from(schema.repositories)
        .where(eq(schema.repositories.id, input.mainRepositoryId))
        .limit(1);

      const assignedAgents = await db.select({
        agent: schema.agents
      })
        .from(schema.taskAgents)
        .innerJoin(schema.agents, eq(schema.agents.id, schema.taskAgents.agentId))
        .where(eq(schema.taskAgents.taskId, createdTask.id));

      const additionalRepositories = await getTaskAdditionalRepositories(createdTask.id);

      const taskWithRelations = {
        ...createdTask,
        mainRepository: mainRepository[0],
        assignedAgents: assignedAgents.map(ta => ta.agent),
        additionalRepositories
      };

      return c.json({ task: taskWithRelations }, 201);
    } catch (error) {
      console.error('Failed to create task:', error);
      return c.json({ error: 'Failed to create task' }, 500);
    }
  }
);

/**
 * PUT /api/v2/tasks/:taskId/assignments
 * Update task agent and repository assignments
 */
tasksRouter.put('/tasks/:taskId/assignments', 
  zValidator('json', updateTaskAssignmentsSchema), 
  async (c) => {
    try {

      const taskId = c.req.param('taskId');
      const input = c.req.valid('json');

      // Get current task to verify it exists
      const task = await db.select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, taskId))
        .limit(1);

      if (!task[0]) {
        return c.json({ error: 'Task not found' }, 404);
      }

      // Update agent assignments
      // Remove current assignments
      await db.delete(schema.taskAgents)
        .where(eq(schema.taskAgents.taskId, taskId));

      // Add new assignments
      for (const agentId of input.assignedAgentIds) {
        await assignAgentToTask(agentId, taskId);
      }

      // Update additional repository assignments
      // Remove current additional repositories
      await db.delete(schema.taskAdditionalRepositories)
        .where(eq(schema.taskAdditionalRepositories.taskId, taskId));

      // Add new additional repositories
      for (const repositoryId of input.additionalRepositoryIds) {
        await addRepositoryToTask(taskId, repositoryId);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error('Failed to update task assignments:', error);
      return c.json({ error: 'Failed to update task assignments' }, 500);
    }
  }
);

/**
 * PUT /api/v2/tasks/:taskId/status
 * Update task status and stage (for orchestrator)
 */
tasksRouter.put('/tasks/:taskId/status', 
  zValidator('json', updateTaskStatusSchema), 
  async (c) => {
    try {
      const taskId = c.req.param('taskId');
      const input = c.req.valid('json');

      const updated = await db.update(schema.tasks)
          .set({
            status: input.status,
            stage: input.stage,
            isAiWorking: input.isAiWorking,
            lastAgentSessionId: input.lastAgentSessionId,
            aiWorkingSince: input.isAiWorking ? new Date() : null,
            updatedAt: new Date()
          })
          .where(eq(schema.tasks.id, taskId))
          .returning();

        if (!updated[0]) {
          return c.json({ error: 'Task not found' }, 404);
        }

        return c.json({ task: updated[0] });
    } catch (error) {
      console.error('Failed to update task status:', error);
      return c.json({ error: 'Failed to update task status' }, 500);
    }
  }
);

/**
 * GET /api/v2/tasks/:taskId/assignments
 * Get task assignments (agents and repositories)
 */
tasksRouter.get('/tasks/:taskId/assignments', async (c) => {
  try {
    const taskId = c.req.param('taskId');

    // Get assigned agents
    const assignedAgents = await db.select({
      agent: schema.agents
    })
      .from(schema.taskAgents)
      .innerJoin(schema.agents, eq(schema.agents.id, schema.taskAgents.agentId))
      .where(eq(schema.taskAgents.taskId, taskId));

    // Get additional repositories
    const additionalRepositories = await getTaskAdditionalRepositories(taskId);

    return c.json({
      assignedAgents: assignedAgents.map(ta => ta.agent),
      additionalRepositories
    });
  } catch (error) {
    console.error('Failed to get task assignments:', error);
    return c.json({ error: 'Failed to get task assignments' }, 500);
  }
});

/**
 * GET /api/v2/tasks/loop/:projectId
 * Get loop tasks for a project (for orchestrator)
 */
tasksRouter.get('/loop/:projectId', requireProjectAccess(), async (c) => {
  try {
    const projectId = c.req.param('projectId');

      const loopTasks = await db.select()
        .from(schema.tasks)
        .where(and(
          eq(schema.tasks.projectId, projectId),
          eq(schema.tasks.status, 'loop'),
          eq(schema.tasks.ready, true)
        ))
        .orderBy(schema.tasks.priority, schema.tasks.createdAt);

    return c.json({ tasks: loopTasks });
  } catch (error) {
    console.error('Failed to get loop tasks:', error);
    return c.json({ error: 'Failed to get loop tasks' }, 500);
  }
});

/**
 * PUT /api/v2/tasks/:taskId/loop-return
 * Return task to loop column (bottom of column)
 */
tasksRouter.put('/tasks/:taskId/loop-return', async (c) => {
  try {
    const taskId = c.req.param('taskId');

    // Get current highest column order for loop tasks in this project
    const task = await db.select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId))
      .limit(1);

    if (!task[0]) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const loopTasks = await db.select()
      .from(schema.tasks)
      .where(and(
        eq(schema.tasks.projectId, task[0].projectId),
        eq(schema.tasks.status, 'loop')
      ))
      .orderBy(schema.tasks.columnOrder);

    // Calculate new column order (bottom of loop column)
    const lastOrder = loopTasks.length > 0 ? 
      parseFloat(loopTasks[loopTasks.length - 1].columnOrder) : 
      1000;
    const newOrder = (lastOrder + 1000).toString();

    const updated = await db.update(schema.tasks)
      .set({
        status: 'loop',
        stage: 'loop',
        isAiWorking: false,
        aiWorkingSince: null,
        columnOrder: newOrder,
        updatedAt: new Date()
      })
      .where(eq(schema.tasks.id, taskId))
      .returning();

    return c.json({ task: updated[0] });
  } catch (error) {
    console.error('Failed to return task to loop:', error);
    return c.json({ error: 'Failed to return task to loop' }, 500);
  }
});

export default tasksRouter;