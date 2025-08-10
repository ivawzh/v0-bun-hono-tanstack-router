import { z } from "zod";
import { db } from "../db";
import { projects, boards, repositories, tasks } from "../db/schema/core";
import { eq, and, desc } from "drizzle-orm";
import { protectedProcedure } from "../lib/orpc";

export const projectsRouter = {
  list: protectedProcedure
    .input(z.object({}).optional())
    .handler(async ({ context }) => {
      const userProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.ownerId, context.user.id))
        .orderBy(desc(projects.createdAt));
      
      return userProjects;
    }),

  get: protectedProcedure
    .input(z.object({
      id: z.string().uuid()
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
    .input(z.object({
      name: z.string().min(1).max(255),
      description: z.string().optional()
    }))
    .handler(async ({ context, input }) => {
      const newProject = await db
        .insert(projects)
        .values({
          name: input.name,
          description: input.description,
          ownerId: context.user.id
        })
        .returning();
      
      return newProject[0];
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().optional()
    }))
    .handler(async ({ context, input }) => {
      const updated = await db
        .update(projects)
        .set({
          name: input.name,
          description: input.description,
          updatedAt: new Date()
        })
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
    .input(z.object({
      id: z.string().uuid()
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
    .input(z.object({
      id: z.string().uuid()
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
            byStatus: taskStats.reduce((acc, stat) => {
              acc[stat.status] = (acc[stat.status] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          }
        }
      };
    }),
};