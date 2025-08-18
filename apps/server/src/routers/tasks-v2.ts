import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import {
  tasks,
  projects,
  repositories,
  agents,
  actors,
  taskDependencies,
  taskAgents,
  taskAdditionalRepositories
} from "../db/schema/v2";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { broadcastFlush } from "../websocket/websocket-server";
import {
  saveAttachment,
  deleteAttachment,
  getAttachmentFile,
  validateTotalAttachmentSize,
  type AttachmentMetadata
} from "../utils/file-storage";

const taskStatusEnum = v.picklist(["todo", "doing", "done", "loop"]);
const taskStageEnum = v.nullable(v.picklist(["clarify", "plan", "execute", "loop"]));
const prioritySchema = v.pipe(v.number(), v.minValue(1), v.maxValue(5));

export const tasksV2Router = o.router({
  list: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (project.length === 0) {
        throw new Error("Project not found or unauthorized");
      }

      // Get tasks with main repository, actor, and assigned agents
      const results = await db
        .select({
          task: tasks,
          mainRepository: repositories,
          actor: actors
        })
        .from(tasks)
        .leftJoin(repositories, eq(tasks.mainRepositoryId, repositories.id))
        .leftJoin(actors, eq(tasks.actorId, actors.id))
        .where(eq(tasks.projectId, input.projectId))
        .orderBy(
          tasks.status,
          desc(tasks.priority), // Higher numbers = higher priority (5 > 4 > 3 > 2 > 1)
          sql`CAST(${tasks.columnOrder} AS DECIMAL)`,
          desc(tasks.createdAt)
        );

      // Fetch all assigned agents for all tasks
      const taskIds = results.map(r => r.task.id);
      const allTaskAgents = taskIds.length > 0 ? await db
        .select({
          taskId: taskAgents.taskId,
          agent: agents
        })
        .from(taskAgents)
        .innerJoin(agents, eq(taskAgents.agentId, agents.id))
        .where(inArray(taskAgents.taskId, taskIds)) : [];

      // Fetch all additional repositories for all tasks
      const allAdditionalRepos = taskIds.length > 0 ? await db
        .select({
          taskId: taskAdditionalRepositories.taskId,
          repository: repositories
        })
        .from(taskAdditionalRepositories)
        .innerJoin(repositories, eq(taskAdditionalRepositories.repositoryId, repositories.id))
        .where(inArray(taskAdditionalRepositories.taskId, taskIds)) : [];

      // Group by task ID
      const agentsByTask = allTaskAgents.reduce((acc, item) => {
        if (!acc[item.taskId]) acc[item.taskId] = [];
        acc[item.taskId].push(item.agent);
        return acc;
      }, {} as Record<string, any[]>);

      const additionalReposByTask = allAdditionalRepos.reduce((acc, item) => {
        if (!acc[item.taskId]) acc[item.taskId] = [];
        acc[item.taskId].push(item.repository);
        return acc;
      }, {} as Record<string, any[]>);

      // Fetch dependencies for all tasks in the project
      const dependencies = taskIds.length > 0 ? await db
        .select({
          taskId: taskDependencies.taskId,
          dependsOnTaskId: taskDependencies.dependsOnTaskId,
          dependsOnTask: {
            id: tasks.id,
            rawTitle: tasks.rawTitle,
            refinedTitle: tasks.refinedTitle,
            status: tasks.status
          }
        })
        .from(taskDependencies)
        .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
        .where(inArray(taskDependencies.taskId, taskIds)) : [];

      // Group dependencies by task ID
      const dependenciesByTask = dependencies.reduce((acc, dep) => {
        if (!acc[dep.taskId]) {
          acc[dep.taskId] = [];
        }
        acc[dep.taskId].push(dep.dependsOnTask);
        return acc;
      }, {} as Record<string, any[]>);

      return results.map(r => ({
        ...r.task,
        mainRepository: r.mainRepository,
        actor: r.actor,
        assignedAgents: agentsByTask[r.task.id] || [],
        additionalRepositories: additionalReposByTask[r.task.id] || [],
        assignedAgentIds: (agentsByTask[r.task.id] || []).map((agent: any) => agent.id),
        additionalRepositoryIds: (additionalReposByTask[r.task.id] || []).map((repo: any) => repo.id),
        dependencies: dependenciesByTask[r.task.id] || []
      }));
    }),

  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const result = await db
        .select({
          task: tasks,
          project: projects,
          mainRepository: repositories,
          actor: actors
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .leftJoin(repositories, eq(tasks.mainRepositoryId, repositories.id))
        .leftJoin(actors, eq(tasks.actorId, actors.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      // Fetch assigned agents
      const assignedAgents = await db
        .select({ agent: agents })
        .from(taskAgents)
        .innerJoin(agents, eq(taskAgents.agentId, agents.id))
        .where(eq(taskAgents.taskId, input.id));

      // Fetch additional repositories
      const additionalRepositories = await db
        .select({ repository: repositories })
        .from(taskAdditionalRepositories)
        .innerJoin(repositories, eq(taskAdditionalRepositories.repositoryId, repositories.id))
        .where(eq(taskAdditionalRepositories.taskId, input.id));

      return {
        ...result[0].task,
        project: result[0].project,
        mainRepository: result[0].mainRepository,
        actor: result[0].actor,
        assignedAgents: assignedAgents.map(a => a.agent),
        additionalRepositories: additionalRepositories.map(r => r.repository),
        assignedAgentIds: assignedAgents.map(a => a.agent.id),
        additionalRepositoryIds: additionalRepositories.map(r => r.repository.id)
      };
    }),

  create: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      mainRepositoryId: v.pipe(v.string(), v.uuid()),
      assignedAgentIds: v.array(v.pipe(v.string(), v.uuid())),
      additionalRepositoryIds: v.optional(v.array(v.pipe(v.string(), v.uuid())), []),
      actorId: v.optional(v.pipe(v.string(), v.uuid())),
      rawTitle: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      rawDescription: v.optional(v.string()),
      priority: v.optional(prioritySchema, 3),
      attachments: v.optional(v.array(v.any()), []),
      status: v.optional(taskStatusEnum, "todo"),
      stage: v.optional(taskStageEnum)
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (project.length === 0) {
        throw new Error("Project not found or unauthorized");
      }

      // Verify main repository belongs to project
      const mainRepository = await db
        .select()
        .from(repositories)
        .where(
          and(
            eq(repositories.id, input.mainRepositoryId),
            eq(repositories.projectId, input.projectId)
          )
        )
        .limit(1);

      if (mainRepository.length === 0) {
        throw new Error("Main repository not found or doesn't belong to project");
      }

      // Verify additional repositories belong to project
      if (input.additionalRepositoryIds.length > 0) {
        const additionalRepos = await db
          .select()
          .from(repositories)
          .where(
            and(
              inArray(repositories.id, input.additionalRepositoryIds),
              eq(repositories.projectId, input.projectId)
            )
          );

        if (additionalRepos.length !== input.additionalRepositoryIds.length) {
          throw new Error("Some additional repositories not found or don't belong to project");
        }
      }

      // Verify assigned agents belong to user
      if (input.assignedAgentIds.length > 0) {
        const assignedAgents = await db
          .select()
          .from(agents)
          .where(
            and(
              inArray(agents.id, input.assignedAgentIds),
              eq(agents.userId, context.user.id)
            )
          );

        if (assignedAgents.length !== input.assignedAgentIds.length) {
          throw new Error("Some assigned agents not found or don't belong to user");
        }
      }

      // Verify actor belongs to project (if provided)
      if (input.actorId) {
        const actor = await db
          .select()
          .from(actors)
          .where(
            and(
              eq(actors.id, input.actorId),
              eq(actors.projectId, input.projectId)
            )
          )
          .limit(1);

        if (actor.length === 0) {
          throw new Error("Actor not found or doesn't belong to project");
        }
      }

      // Determine the stage value to use
      let stageToUse = input.stage;
      if (stageToUse === undefined) {
        // Apply intelligent defaults if no stage provided
        if (input.status === "loop") {
          stageToUse = "loop";
        } else {
          stageToUse = "clarify"; // Default for non-loop tasks
        }
      }

      // Create the task
      const newTask = await db
        .insert(tasks)
        .values({
          projectId: input.projectId,
          mainRepositoryId: input.mainRepositoryId,
          actorId: input.actorId,
          rawTitle: input.rawTitle,
          rawDescription: input.rawDescription,
          priority: input.priority,
          attachments: input.attachments,
          status: input.status,
          stage: stageToUse,
          ready: input.status === "loop" ? true : false // Loop tasks are always ready
        })
        .returning();

      const taskId = newTask[0].id;

      // Create agent assignments
      if (input.assignedAgentIds.length > 0) {
        await db.insert(taskAgents).values(
          input.assignedAgentIds.map(agentId => ({
            taskId,
            agentId
          }))
        );
      }

      // Create additional repository assignments
      if (input.additionalRepositoryIds.length > 0) {
        await db.insert(taskAdditionalRepositories).values(
          input.additionalRepositoryIds.map(repositoryId => ({
            taskId,
            repositoryId
          }))
        );
      }

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(input.projectId);

      return newTask[0];
    }),

  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      rawTitle: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      rawDescription: v.optional(v.string()),
      refinedTitle: v.optional(v.string()),
      refinedDescription: v.optional(v.string()),
      plan: v.optional(v.any()),
      status: v.optional(taskStatusEnum),
      stage: v.optional(taskStageEnum),
      priority: v.optional(prioritySchema),
      ready: v.optional(v.boolean()),
      attachments: v.optional(v.array(v.any())),
      columnOrder: v.optional(v.string()),
      mainRepositoryId: v.optional(v.pipe(v.string(), v.uuid())),
      actorId: v.optional(v.pipe(v.string(), v.uuid()))
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      const updates: any = { updatedAt: new Date() };

      if (input.rawTitle !== undefined) updates.rawTitle = input.rawTitle;
      if (input.rawDescription !== undefined) updates.rawDescription = input.rawDescription;
      if (input.refinedTitle !== undefined) updates.refinedTitle = input.refinedTitle;
      if (input.refinedDescription !== undefined) updates.refinedDescription = input.refinedDescription;
      if (input.plan !== undefined) updates.plan = input.plan;
      if (input.status !== undefined) updates.status = input.status;
      if (input.stage !== undefined) updates.stage = input.stage;
      if (input.priority !== undefined) updates.priority = input.priority;
      if (input.ready !== undefined) updates.ready = input.ready;
      if (input.attachments !== undefined) updates.attachments = input.attachments;
      if (input.columnOrder !== undefined) updates.columnOrder = input.columnOrder;
      if (input.mainRepositoryId !== undefined) updates.mainRepositoryId = input.mainRepositoryId;
      if (input.actorId !== undefined) updates.actorId = input.actorId;

      const updated = await db
        .update(tasks)
        .set(updates)
        .where(eq(tasks.id, input.id))
        .returning();

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return updated[0];
    }),

  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      // Delete task (cascading will handle related records)
      await db.delete(tasks).where(eq(tasks.id, input.id));

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return { success: true };
    }),

  updateAssignments: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      assignedAgentIds: v.array(v.pipe(v.string(), v.uuid())),
      additionalRepositoryIds: v.array(v.pipe(v.string(), v.uuid()))
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      // Remove existing agent assignments
      await db.delete(taskAgents).where(eq(taskAgents.taskId, input.id));

      // Remove existing additional repository assignments
      await db.delete(taskAdditionalRepositories).where(eq(taskAdditionalRepositories.taskId, input.id));

      // Create new agent assignments
      if (input.assignedAgentIds.length > 0) {
        await db.insert(taskAgents).values(
          input.assignedAgentIds.map(agentId => ({
            taskId: input.id,
            agentId
          }))
        );
      }

      // Create new additional repository assignments
      if (input.additionalRepositoryIds.length > 0) {
        await db.insert(taskAdditionalRepositories).values(
          input.additionalRepositoryIds.map(repositoryId => ({
            taskId: input.id,
            repositoryId
          }))
        );
      }

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return { success: true };
    }),

  toggleReady: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      ready: v.boolean()
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      const updated = await db
        .update(tasks)
        .set({
          ready: input.ready,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, input.id))
        .returning();

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return updated[0];
    }),

  updateOrder: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      tasks: v.array(v.object({
        id: v.pipe(v.string(), v.uuid()),
        columnOrder: v.string(),
        status: v.optional(taskStatusEnum) // Allow moving between columns
      }))
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (project.length === 0) {
        throw new Error("Project not found or unauthorized");
      }

      // Update all tasks in a transaction
      const updatedTasks = [];

      for (const taskUpdate of input.tasks) {
        // Verify task belongs to project and user
        const task = await db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.id, taskUpdate.id),
              eq(tasks.projectId, input.projectId)
            )
          )
          .limit(1);

        if (task.length === 0) {
          throw new Error(`Task ${taskUpdate.id} not found or unauthorized`);
        }

        const updates: any = {
          columnOrder: taskUpdate.columnOrder,
          updatedAt: new Date()
        };

        if (taskUpdate.status !== undefined) {
          updates.status = taskUpdate.status;
          // Handle stage transitions for different statuses
          if (taskUpdate.status === 'todo' || taskUpdate.status === 'done') {
            updates.stage = null;
          } else if (taskUpdate.status === 'loop') {
            updates.stage = 'loop'; // Loop tasks always have loop stage
          }
        }

        const updated = await db
          .update(tasks)
          .set(updates)
          .where(eq(tasks.id, taskUpdate.id))
          .returning();

        updatedTasks.push(updated[0]);
      }

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(input.projectId);

      return { success: true, updated: updatedTasks };
    }),

  resetAI: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      // Reset AI working status and clear timestamp
      const updated = await db
        .update(tasks)
        .set({
          isAiWorking: false,
          aiWorkingSince: null,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, input.id))
        .returning();

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return updated[0];
    })
});
