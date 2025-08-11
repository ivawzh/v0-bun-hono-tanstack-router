import * as v from "valibot";
import { db } from "../db";
import { projects, boards, repositories, tasks } from "../db/schema/core";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure, o } from "../lib/orpc";

export const projectsRouter = o.router({
  list: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      try {
        const userProjects = await db
          .select()
          .from(projects)
          .where(eq(projects.ownerId, context.user.id))
          .orderBy(desc(projects.createdAt));
        return userProjects;
      } catch (err: any) {
        console.error("projects.list failed", {
          userId: context.user?.id,
          error: err?.message,
          stack: err?.stack,
        });
        throw err;
      }
    }),

  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (project.length === 0) {
        throw new Error("Project not found");
      }

      return project[0];
    }),

  create: protectedProcedure
    .input(v.object({
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      description: v.optional(v.string())
    }))
    .handler(async ({ context, input }) => {
      try {
        const newProject = await db
          .insert(projects)
          .values({
            name: input.name,
            description: input.description,
            ownerId: context.user.id,
          })
          .returning();
        return newProject[0];
      } catch (err: any) {
        console.error("projects.create failed", {
          userId: context.user?.id,
          input,
          error: err?.message,
          stack: err?.stack,
        });
        throw err;
      }
    }),

  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      description: v.optional(v.string()),
      agentPaused: v.optional(v.boolean())
    }))
    .handler(async ({ context, input }) => {
      const updates: any = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.agentPaused !== undefined) updates.agentPaused = input.agentPaused;
      
      const updated = await db
        .update(projects)
        .set(updates)
        .where(
          and(
            eq(projects.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .returning();

      if (updated.length === 0) {
        throw new Error("Project not found or unauthorized");
      }

      return updated[0];
    }),

  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // First check if project exists and user owns it
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (project.length === 0) {
        throw new Error("Project not found or unauthorized");
      }

      // Delete related data (cascade)
      // Delete tasks from boards in this project
      const projectBoards = await db
        .select({ id: boards.id })
        .from(boards)
        .where(eq(boards.projectId, input.id));

      for (const board of projectBoards) {
        await db.delete(tasks).where(eq(tasks.boardId, board.id));
      }

      // Delete boards
      await db.delete(boards).where(eq(boards.projectId, input.id));

      // Delete repositories
      await db.delete(repositories).where(eq(repositories.projectId, input.id));

      // Finally delete the project
      await db.delete(projects).where(eq(projects.id, input.id));

      return { success: true };
    }),

  getWithStats: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);

      if (project.length === 0) {
        throw new Error("Project not found");
      }

      // Get counts
      const boardCount = await db
        .select()
        .from(boards)
        .where(eq(boards.projectId, input.id));

      const repoCount = await db
        .select()
        .from(repositories)
        .where(eq(repositories.projectId, input.id));

      // Get task counts by status
      const taskStats = await db
        .select({
          status: tasks.status,
          count: tasks.id
        })
        .from(tasks)
        .innerJoin(boards, eq(tasks.boardId, boards.id))
        .where(eq(boards.projectId, input.id));

      return {
        ...project[0],
        stats: {
          boards: boardCount.length,
          repositories: repoCount.length,
          tasks: {
            total: taskStats.length,
            byStatus: taskStats.reduce((acc: Record<string, number>, stat: { status: string; count: string }) => {
              acc[stat.status] = (acc[stat.status] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          }
        }
      };
    }),
});
