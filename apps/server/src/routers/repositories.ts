import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { repositories, projects, projectUsers } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

export const repositoriesRouter = o.router({
  list: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify project membership
      const membership = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.projectId, input.projectId),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);
      
      if (membership.length === 0) {
        throw new Error("Project not found or unauthorized");
      }
      
      const results = await db
        .select()
        .from(repositories)
        .where(eq(repositories.projectId, input.projectId))
        .orderBy(desc(repositories.isDefault), desc(repositories.createdAt));
      
      return results;
    }),
    
  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const result = await db
        .select({
          repository: repositories,
          project: projects
        })
        .from(repositories)
        .innerJoin(projects, eq(repositories.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(repositories.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);
      
      if (result.length === 0) {
        throw new Error("Repository not found or unauthorized");
      }
      
      return result[0].repository;
    }),
    
  create: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
      repoPath: v.pipe(v.string(), v.minLength(1)),
      isDefault: v.optional(v.boolean(), false),
      maxConcurrencyLimit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(10)), 1)
    }))
    .handler(async ({ context, input }) => {
      // Verify project membership
      const membership = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.projectId, input.projectId),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);
      
      if (membership.length === 0) {
        throw new Error("Project not found or unauthorized");
      }
      
      // If setting as default, unset other defaults first
      if (input.isDefault) {
        await db
          .update(repositories)
          .set({ isDefault: false })
          .where(
            and(
              eq(repositories.projectId, input.projectId),
              eq(repositories.isDefault, true)
            )
          );
      }
      
      const newRepository = await db
        .insert(repositories)
        .values({
          projectId: input.projectId,
          name: input.name,
          repoPath: input.repoPath,
          isDefault: input.isDefault,
          maxConcurrencyLimit: input.maxConcurrencyLimit
        })
        .returning();
      
      return newRepository[0];
    }),
    
  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(100))),
      repoPath: v.optional(v.pipe(v.string(), v.minLength(1))),
      isDefault: v.optional(v.boolean()),
      maxConcurrencyLimit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(10)))
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const repository = await db
        .select({
          repository: repositories,
          project: projects
        })
        .from(repositories)
        .innerJoin(projects, eq(repositories.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(repositories.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);
      
      if (repository.length === 0) {
        throw new Error("Repository not found or unauthorized");
      }
      
      // If setting as default, unset other defaults first
      if (input.isDefault) {
        await db
          .update(repositories)
          .set({ isDefault: false })
          .where(
            and(
              eq(repositories.projectId, repository[0].repository.projectId),
              eq(repositories.isDefault, true)
            )
          );
      }
      
      const updates: any = { updatedAt: new Date() };
      
      if (input.name !== undefined) updates.name = input.name;
      if (input.repoPath !== undefined) updates.repoPath = input.repoPath;
      if (input.isDefault !== undefined) updates.isDefault = input.isDefault;
      if (input.maxConcurrencyLimit !== undefined) updates.maxConcurrencyLimit = input.maxConcurrencyLimit;
      
      const updated = await db
        .update(repositories)
        .set(updates)
        .where(eq(repositories.id, input.id))
        .returning();
      
      return updated[0];
    }),
    
  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const repository = await db
        .select({
          repository: repositories,
          project: projects
        })
        .from(repositories)
        .innerJoin(projects, eq(repositories.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(repositories.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);
      
      if (repository.length === 0) {
        throw new Error("Repository not found or unauthorized");
      }
      
      // TODO: Check if any tasks are using this repository
      // For now, allow deletion (tasks will need to handle null repository)
      await db.delete(repositories).where(eq(repositories.id, input.id));
      
      return { success: true };
    })
});