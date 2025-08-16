import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { tasks, projects, repoAgents, actors } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { broadcastFlush } from "../websocket/websocket-server";

const taskStatusEnum = v.picklist(["todo", "doing", "done"]);
const taskStageEnum = v.picklist(["refine", "kickoff", "execute"]);
const priorityEnum = v.picklist(["P1", "P2", "P3", "P4", "P5"]);

export const tasksRouter = o.router({
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

      const results = await db
        .select({
          task: tasks,
          repoAgent: repoAgents,
          actor: actors
        })
        .from(tasks)
        .leftJoin(repoAgents, eq(tasks.repoAgentId, repoAgents.id))
        .leftJoin(actors, eq(tasks.actorId, actors.id))
        .where(eq(tasks.projectId, input.projectId))
        .orderBy(
          tasks.status,
          sql`CASE ${tasks.priority}
              WHEN 'P5' THEN 1
              WHEN 'P4' THEN 2
              WHEN 'P3' THEN 3
              WHEN 'P2' THEN 4
              WHEN 'P1' THEN 5
              ELSE 6
            END`,
          sql`CAST(${tasks.columnOrder} AS DECIMAL)`,
          desc(tasks.createdAt)
        );

      return results.map(r => ({
        ...r.task,
        repoAgent: r.repoAgent,
        actor: r.actor
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
          repoAgent: repoAgents,
          actor: actors
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .leftJoin(repoAgents, eq(tasks.repoAgentId, repoAgents.id))
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

      return {
        ...result[0].task,
        project: result[0].project,
        repoAgent: result[0].repoAgent,
        actor: result[0].actor
      };
    }),

  create: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      repoAgentId: v.pipe(v.string(), v.uuid()),
      actorId: v.optional(v.pipe(v.string(), v.uuid())),
      rawTitle: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      rawDescription: v.optional(v.string()),
      priority: v.optional(priorityEnum, "P3"),
      attachments: v.optional(v.array(v.any()), [])
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

      // Verify repo agent belongs to project
      const repoAgent = await db
        .select()
        .from(repoAgents)
        .where(
          and(
            eq(repoAgents.id, input.repoAgentId),
            eq(repoAgents.projectId, input.projectId)
          )
        )
        .limit(1);

      if (repoAgent.length === 0) {
        throw new Error("Repo agent not found or doesn't belong to project");
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

      const newTask = await db
        .insert(tasks)
        .values({
          projectId: input.projectId,
          repoAgentId: input.repoAgentId,
          actorId: input.actorId,
          rawTitle: input.rawTitle,
          rawDescription: input.rawDescription,
          priority: input.priority,
          attachments: input.attachments,
          status: "todo",
          ready: false
        })
        .returning();

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
      priority: v.optional(priorityEnum),
      ready: v.optional(v.boolean()),
      attachments: v.optional(v.array(v.any())),
      columnOrder: v.optional(v.string())
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

      // Delete task (no cascading needed in simplified model)
      await db.delete(tasks).where(eq(tasks.id, input.id));

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
          // Clear stage when moving to todo or done
          if (taskUpdate.status === 'todo' || taskUpdate.status === 'done') {
            updates.stage = null;
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
    })
});
