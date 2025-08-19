import * as v from "valibot";
import { db } from "../db";
import { projects, repositories, agents, actors, tasks } from "../db/schema";
import { eq, and, desc, getTableColumns } from "drizzle-orm";
import { protectedProcedure, o } from "../lib/orpc";

export const projectsRouter = o.router({
  list: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      try {
        // For now, use direct ownership until we migrate existing data
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
      memory: v.optional(v.any())
    }))
    .handler(async ({ context, input }) => {
      const updates: any = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.memory !== undefined) updates.memory = input.memory;
      
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
      // Delete tasks
      await db.delete(tasks).where(eq(tasks.projectId, input.id));

      // Delete repositories
      await db.delete(repositories).where(eq(repositories.projectId, input.id));

      // Delete actors
      await db.delete(actors).where(eq(actors.projectId, input.id));

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
      const repositoryCount = await db
        .select()
        .from(repositories)
        .where(eq(repositories.projectId, input.id));

      const actorCount = await db
        .select()
        .from(actors)
        .where(eq(actors.projectId, input.id));

      // Get task counts by status
      const taskStats = await db
        .select({
          status: tasks.status,
          count: tasks.id
        })
        .from(tasks)
        .where(eq(tasks.projectId, input.id));

      return {
        ...project[0],
        stats: {
          repositories: repositoryCount.length,
          actors: actorCount.length,
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

  getWithTasks: protectedProcedure
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

      // Get all tasks for this project
      const projectTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, input.id))
        .orderBy(desc(tasks.createdAt));

      return {
        ...project[0],
        tasks: projectTasks
      };
    }),
});
