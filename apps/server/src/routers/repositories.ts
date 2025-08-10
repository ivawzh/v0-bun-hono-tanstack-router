import { orpc } from "../lib/orpc";
import { z } from "zod";
import { db } from "../db";
import { repositories, projects, sourceRefs } from "../db/schema/core";
import { eq, and } from "drizzle-orm";

const repositoryProviderEnum = z.enum(["github", "gitlab", "local", "cloud-code"]);

export const repositoriesRouter = orpc.protectedRouter
  .route("list", {
    method: "GET",
    input: z.object({
      projectId: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
      // Verify project ownership
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.ownerId, ctx.user.id)
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
    }
  })
  .route("get", {
    method: "GET",
    input: z.object({
      id: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (repo.length === 0) {
        throw new Error("Repository not found or unauthorized");
      }
      
      return repo[0].repository;
    }
  })
  .route("create", {
    method: "POST",
    input: z.object({
      projectId: z.string().uuid(),
      provider: repositoryProviderEnum,
      url: z.string().optional(),
      defaultBranch: z.string().default("main")
    }),
    handler: async ({ ctx, input }) => {
      // Verify project ownership
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.ownerId, ctx.user.id)
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
    }
  })
  .route("update", {
    method: "PUT",
    input: z.object({
      id: z.string().uuid(),
      provider: repositoryProviderEnum.optional(),
      url: z.string().optional(),
      defaultBranch: z.string().optional()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
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
    }
  })
  .route("delete", {
    method: "DELETE",
    input: z.object({
      id: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
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
    }
  })
  .route("addSourceRef", {
    method: "POST",
    input: z.object({
      repositoryId: z.string().uuid(),
      refType: z.enum(["branch", "commit", "tag"]),
      refValue: z.string()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
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
    }
  })
  .route("listSourceRefs", {
    method: "GET",
    input: z.object({
      repositoryId: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
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
    }
  });