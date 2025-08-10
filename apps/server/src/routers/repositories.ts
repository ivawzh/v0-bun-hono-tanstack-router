import { protectedProcedure, o } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { repositories, projects, sourceRefs } from "../db/schema/core";
import { eq, and } from "drizzle-orm";

const repositoryProviderEnum = v.picklist(["github", "gitlab", "local", "cloud-code"]);

export const repositoriesRouter = o.router({
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
      
      const repos = await db
        .select()
        .from(repositories)
        .where(eq(repositories.projectId, input.projectId));
      
      return repos;
    }),
  
  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const repo = await db
        .select({
          repository: repositories,
          project: projects
        })
        .from(repositories)
        .innerJoin(projects, eq(repositories.projectId, projects.id))
        .where(
          and(
            eq(repositories.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (repo.length === 0) {
        throw new Error("Repository not found or unauthorized");
      }
      
      return repo[0].repository;
    }),
  
  create: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      provider: repositoryProviderEnum,
      url: v.optional(v.string()),
      defaultBranch: v.optional(v.string(), "main")
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
      
      const newRepo = await db
        .insert(repositories)
        .values({
          projectId: input.projectId,
          provider: input.provider,
          url: input.url,
          defaultBranch: input.defaultBranch
        })
        .returning();
      
      return newRepo[0];
    }),
  
  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      provider: v.optional(repositoryProviderEnum),
      url: v.optional(v.string()),
      defaultBranch: v.optional(v.string())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const repo = await db
        .select({
          repository: repositories,
          project: projects
        })
        .from(repositories)
        .innerJoin(projects, eq(repositories.projectId, projects.id))
        .where(
          and(
            eq(repositories.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (repo.length === 0) {
        throw new Error("Repository not found or unauthorized");
      }
      
      const updated = await db
        .update(repositories)
        .set({
          provider: input.provider,
          url: input.url,
          defaultBranch: input.defaultBranch,
          updatedAt: new Date()
        })
        .where(eq(repositories.id, input.id))
        .returning();
      
      return updated[0];
    }),
  
  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const repo = await db
        .select({
          repository: repositories,
          project: projects
        })
        .from(repositories)
        .innerJoin(projects, eq(repositories.projectId, projects.id))
        .where(
          and(
            eq(repositories.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (repo.length === 0) {
        throw new Error("Repository not found or unauthorized");
      }
      
      // Delete source refs first
      await db.delete(sourceRefs).where(eq(sourceRefs.repositoryId, input.id));
      
      // Delete repository
      await db.delete(repositories).where(eq(repositories.id, input.id));
      
      return { success: true };
    }),
  
  addSourceRef: protectedProcedure
    .input(v.object({
      repositoryId: v.pipe(v.string(), v.uuid()),
      refType: v.picklist(["branch", "commit", "tag"]),
      refValue: v.string()
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const repo = await db
        .select({
          repository: repositories,
          project: projects
        })
        .from(repositories)
        .innerJoin(projects, eq(repositories.projectId, projects.id))
        .where(
          and(
            eq(repositories.id, input.repositoryId),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (repo.length === 0) {
        throw new Error("Repository not found or unauthorized");
      }
      
      const newRef = await db
        .insert(sourceRefs)
        .values({
          repositoryId: input.repositoryId,
          refType: input.refType,
          refValue: input.refValue
        })
        .returning();
      
      return newRef[0];
    }),
  
  listSourceRefs: protectedProcedure
    .input(v.object({
      repositoryId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const repo = await db
        .select({
          repository: repositories,
          project: projects
        })
        .from(repositories)
        .innerJoin(projects, eq(repositories.projectId, projects.id))
        .where(
          and(
            eq(repositories.id, input.repositoryId),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (repo.length === 0) {
        throw new Error("Repository not found or unauthorized");
      }
      
      const refs = await db
        .select()
        .from(sourceRefs)
        .where(eq(sourceRefs.repositoryId, input.repositoryId));
      
      return refs;
    })
});