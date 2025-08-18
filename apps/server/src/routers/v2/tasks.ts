/**
 * V2 Tasks Router
 * Enhanced task management with multi-repo/multi-agent support
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { db } from '../../db';
import { eq, and, or, inArray } from 'drizzle-orm';
import * as v1Schema from '../../db/schema/index';
import * as v2Schema from '../../db/schema/v2';
import { requireProjectAccess, schemaAwareRoute } from '../../lib/auth-v2';
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

// Feature flag check middleware
tasksRouter.use('*', async (c, next) => {
  if (!useV2APIs()) {
    return c.json({ 
      error: 'V2 Tasks API is not enabled', 
      hint: 'Set USE_V2_APIS=true to enable' 
    }, 400);
  }
  await next();
});

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
tasksRouter.get('/projects/:projectId/tasks', requireProjectAccess(), schemaAwareRoute(
  // V1 Handler
  async (c) => {
    const projectId = c.req.param('projectId');
    
    const tasks = await db.select({
      task: v1Schema.tasks,
      repoAgent: v1Schema.repoAgents,
      actor: v1Schema.actors
    })
      .from(v1Schema.tasks)
      .leftJoin(v1Schema.repoAgents, eq(v1Schema.repoAgents.id, v1Schema.tasks.repoAgentId))
      .leftJoin(v1Schema.actors, eq(v1Schema.actors.id, v1Schema.tasks.actorId))
      .where(eq(v1Schema.tasks.projectId, projectId))
      .orderBy(v1Schema.tasks.priority, v1Schema.tasks.createdAt);

    const tasksWithRelations = tasks.map(row => ({
      ...row.task,
      repoAgent: row.repoAgent,
      actor: row.actor,
      assignedAgents: [], // V1 doesn't have multiple agents
      additionalRepositories: [] // V1 doesn't have additional repos
    }));

    return c.json({ tasks: tasksWithRelations });
  },
  // V2 Handler
  async (c) => {
    const projectId = c.req.param('projectId');
    
    const tasks = await db.select({
      task: v2Schema.tasks,
      mainRepository: v2Schema.repositories,
      actor: v2Schema.actors
    })
      .from(v2Schema.tasks)
      .leftJoin(v2Schema.repositories, eq(v2Schema.repositories.id, v2Schema.tasks.mainRepositoryId))
      .leftJoin(v2Schema.actors, eq(v2Schema.actors.id, v2Schema.tasks.actorId))
      .where(eq(v2Schema.tasks.projectId, projectId))
      .orderBy(v2Schema.tasks.priority, v2Schema.tasks.createdAt);

    // Get assigned agents and additional repositories for each task
    const tasksWithRelations = [];
    for (const row of tasks) {
      // Get assigned agents
      const taskAgents = await db.select({
        agent: v2Schema.agents
      })
        .from(v2Schema.taskAgents)
        .innerJoin(v2Schema.agents, eq(v2Schema.agents.id, v2Schema.taskAgents.agentId))
        .where(eq(v2Schema.taskAgents.taskId, row.task.id));

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
  }
));

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
      const task = await db.insert(v2Schema.tasks).values({
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
        .from(v2Schema.repositories)
        .where(eq(v2Schema.repositories.id, input.mainRepositoryId))
        .limit(1);

      const assignedAgents = await db.select({
        agent: v2Schema.agents
      })
        .from(v2Schema.taskAgents)
        .innerJoin(v2Schema.agents, eq(v2Schema.agents.id, v2Schema.taskAgents.agentId))
        .where(eq(v2Schema.taskAgents.taskId, createdTask.id));

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
      if (!useV2Schema()) {
        return c.json({ error: 'Task assignments require V2 schema' }, 400);
      }

      const taskId = c.req.param('taskId');
      const input = c.req.valid('json');

      // Get current task to verify it exists
      const task = await db.select()
        .from(v2Schema.tasks)
        .where(eq(v2Schema.tasks.id, taskId))
        .limit(1);

      if (!task[0]) {
        return c.json({ error: 'Task not found' }, 404);
      }

      // Update agent assignments
      // Remove current assignments
      await db.delete(v2Schema.taskAgents)
        .where(eq(v2Schema.taskAgents.taskId, taskId));

      // Add new assignments
      for (const agentId of input.assignedAgentIds) {
        await assignAgentToTask(agentId, taskId);
      }

      // Update additional repository assignments
      // Remove current additional repositories
      await db.delete(v2Schema.taskRepositories)
        .where(eq(v2Schema.taskRepositories.taskId, taskId));

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

      if (useV2Schema()) {
        const updated = await db.update(v2Schema.tasks)
          .set({
            status: input.status,
            stage: input.stage,
            isAiWorking: input.isAiWorking,
            lastAgentSessionId: input.lastAgentSessionId,
            aiWorkingSince: input.isAiWorking ? new Date() : null,
            updatedAt: new Date()
          })
          .where(eq(v2Schema.tasks.id, taskId))
          .returning();

        if (!updated[0]) {
          return c.json({ error: 'Task not found' }, 404);
        }

        return c.json({ task: updated[0] });
      } else {
        const updated = await db.update(v1Schema.tasks)
          .set({
            status: input.status,
            stage: input.stage,
            isAiWorking: input.isAiWorking,
            aiWorkingSince: input.isAiWorking ? new Date() : null,
            updatedAt: new Date()
          })
          .where(eq(v1Schema.tasks.id, taskId))
          .returning();

        if (!updated[0]) {
          return c.json({ error: 'Task not found' }, 404);
        }

        return c.json({ task: updated[0] });
      }
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

    if (!useV2Schema()) {
      return c.json({ 
        assignedAgents: [], 
        additionalRepositories: [] 
      });
    }

    // Get assigned agents
    const assignedAgents = await db.select({
      agent: v2Schema.agents
    })
      .from(v2Schema.taskAgents)
      .innerJoin(v2Schema.agents, eq(v2Schema.agents.id, v2Schema.taskAgents.agentId))
      .where(eq(v2Schema.taskAgents.taskId, taskId));

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

    if (useV2Schema()) {
      const loopTasks = await db.select()
        .from(v2Schema.tasks)
        .where(and(
          eq(v2Schema.tasks.projectId, projectId),
          eq(v2Schema.tasks.status, 'loop'),
          eq(v2Schema.tasks.ready, true)
        ))
        .orderBy(v2Schema.tasks.priority, v2Schema.tasks.createdAt);

      return c.json({ tasks: loopTasks });
    } else {
      // V1 doesn't support loop tasks
      return c.json({ tasks: [] });
    }
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

    if (!useV2Schema()) {
      return c.json({ error: 'Loop tasks require V2 schema' }, 400);
    }

    // Get current highest column order for loop tasks in this project
    const task = await db.select()
      .from(v2Schema.tasks)
      .where(eq(v2Schema.tasks.id, taskId))
      .limit(1);

    if (!task[0]) {
      return c.json({ error: 'Task not found' }, 404);
    }

    const loopTasks = await db.select()
      .from(v2Schema.tasks)
      .where(and(
        eq(v2Schema.tasks.projectId, task[0].projectId),
        eq(v2Schema.tasks.status, 'loop')
      ))
      .orderBy(v2Schema.tasks.columnOrder);

    // Calculate new column order (bottom of loop column)
    const lastOrder = loopTasks.length > 0 ? 
      parseFloat(loopTasks[loopTasks.length - 1].columnOrder) : 
      1000;
    const newOrder = (lastOrder + 1000).toString();

    const updated = await db.update(v2Schema.tasks)
      .set({
        status: 'loop',
        stage: 'loop',
        isAiWorking: false,
        aiWorkingSince: null,
        columnOrder: newOrder,
        updatedAt: new Date()
      })
      .where(eq(v2Schema.tasks.id, taskId))
      .returning();

    return c.json({ task: updated[0] });
  } catch (error) {
    console.error('Failed to return task to loop:', error);
    return c.json({ error: 'Failed to return task to loop' }, 500);
  }
});

export default tasksRouter;