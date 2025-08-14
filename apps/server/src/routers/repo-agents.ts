import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { repoAgents, projects } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

const clientTypeEnum = v.picklist(["claude_code", "opencode"]);
const statusEnum = v.picklist(["idle", "active", "rate_limited", "error"]);

export const repoAgentsRouter = o.router({
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
        .select()
        .from(repoAgents)
        .where(eq(repoAgents.projectId, input.projectId))
        .orderBy(desc(repoAgents.createdAt));
      
      return results;
    }),
  
  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const result = await db
        .select({
          repoAgent: repoAgents,
          project: projects
        })
        .from(repoAgents)
        .innerJoin(projects, eq(repoAgents.projectId, projects.id))
        .where(
          and(
            eq(repoAgents.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (result.length === 0) {
        throw new Error("Repo agent not found or unauthorized");
      }
      
      return result[0].repoAgent;
    }),
  
  create: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      repoPath: v.pipe(v.string(), v.minLength(1)),
      clientType: clientTypeEnum,
      config: v.optional(v.any(), {})
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
      
      const newRepoAgent = await db
        .insert(repoAgents)
        .values({
          projectId: input.projectId,
          name: input.name,
          repoPath: input.repoPath,
          clientType: input.clientType,
          config: input.config,
          status: "idle"
        })
        .returning();
      
      return newRepoAgent[0];
    }),
  
  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      repoPath: v.optional(v.pipe(v.string(), v.minLength(1))),
      clientType: v.optional(clientTypeEnum),
      config: v.optional(v.any()),
      status: v.optional(statusEnum)
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const repoAgent = await db
        .select({
          repoAgent: repoAgents,
          project: projects
        })
        .from(repoAgents)
        .innerJoin(projects, eq(repoAgents.projectId, projects.id))
        .where(
          and(
            eq(repoAgents.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (repoAgent.length === 0) {
        throw new Error("Repo agent not found or unauthorized");
      }
      
      const updates: any = { updatedAt: new Date() };
      
      if (input.name !== undefined) updates.name = input.name;
      if (input.repoPath !== undefined) updates.repoPath = input.repoPath;
      if (input.clientType !== undefined) updates.clientType = input.clientType;
      if (input.config !== undefined) updates.config = input.config;
      if (input.status !== undefined) updates.status = input.status;
      
      const updated = await db
        .update(repoAgents)
        .set(updates)
        .where(eq(repoAgents.id, input.id))
        .returning();
      
      return updated[0];
    }),
  
  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const repoAgent = await db
        .select({
          repoAgent: repoAgents,
          project: projects
        })
        .from(repoAgents)
        .innerJoin(projects, eq(repoAgents.projectId, projects.id))
        .where(
          and(
            eq(repoAgents.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (repoAgent.length === 0) {
        throw new Error("Repo agent not found or unauthorized");
      }
      
      // TODO: Check if any tasks are using this repo agent
      // For now, allow deletion (tasks will become orphaned)
      await db.delete(repoAgents).where(eq(repoAgents.id, input.id));
      
      return { success: true };
    })
});