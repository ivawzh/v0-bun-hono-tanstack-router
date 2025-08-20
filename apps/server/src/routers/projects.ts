import * as v from "valibot";
import { db } from "../db";
import { projects, repositories, agents, actors, tasks, projectUsers } from "../db/schema";
import { eq, and, desc, getTableColumns } from "drizzle-orm";
import { protectedProcedure, o } from "../lib/orpc";

export const projectsRouter = o.router({
  list: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      try {
        // Get projects through membership
        const userProjects = await db
          .select({ project: projects })
          .from(projects)
          .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
          .where(eq(projectUsers.userId, context.user.id))
          .orderBy(desc(projects.createdAt));
        
        return userProjects.map(row => row.project);
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
      const result = await db
        .select({ project: projects })
        .from(projects)
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(projects.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new Error("Project not found");
      }

      return result[0].project;
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

        // Add the creator to project users
        await db
          .insert(projectUsers)
          .values({
            userId: context.user.id,
            projectId: newProject[0].id,
            role: "admin"
          });

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
      // Check if user has access to this project
      const membership = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.projectId, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (membership.length === 0) {
        throw new Error("Project not found or unauthorized");
      }

      const updates: any = { updatedAt: new Date() };
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.memory !== undefined) updates.memory = input.memory;
      
      const updated = await db
        .update(projects)
        .set(updates)
        .where(eq(projects.id, input.id))
        .returning();

      return updated[0];
    }),


  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Check if user has access to this project
      const membership = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.projectId, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (membership.length === 0) {
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
      const result = await db
        .select({ project: projects })
        .from(projects)
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(projects.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new Error("Project not found");
      }

      const project = result[0].project;

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
        ...project,
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
      const result = await db
        .select({ project: projects })
        .from(projects)
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(projects.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new Error("Project not found");
      }

      const project = result[0].project;

      // Get all tasks for this project
      const projectTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, input.id))
        .orderBy(desc(tasks.createdAt));

      return {
        ...project,
        tasks: projectTasks
      };
    }),
});
