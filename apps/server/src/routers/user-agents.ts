import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { agents, projects, projectUsers } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

export const agentsRouter = o.router({
  list: protectedProcedure
    .input(v.object({
      includeTaskCounts: v.optional(v.boolean(), false)
    }))
    .handler(async ({ context, input }) => {
      // Get agents from projects owned by the user
      const results = await db
        .select({
          agent: agents,
          project: projects
        })
        .from(agents)
        .innerJoin(projects, eq(agents.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(eq(projectUsers.userId, context.user.id))
        .orderBy(desc(agents.createdAt));
      
      // TODO: Add task counts if requested
      return results.map(r => r.agent);
    }),
    
  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const result = await db
        .select({
          agent: agents,
          project: projects
        })
        .from(agents)
        .innerJoin(projects, eq(agents.projectId, projects.id))
        .where(
          and(
            eq(agents.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);
      
      if (result.length === 0) {
        throw new Error("Agent not found or unauthorized");
      }
      
      return result[0].agent;
    }),
    
  create: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
      agentType: v.picklist(['CLAUDE_CODE', 'CURSOR_CLI', 'OPENCODE']),
      agentSettings: v.optional(v.record(v.string(), v.any()), {}),
      maxConcurrencyLimit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(10)), 1)
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);
      
      if (project.length === 0) {
        throw new Error("Project not found or unauthorized");
      }
      
      const newAgent = await db
        .insert(agents)
        .values({
          projectId: input.projectId,
          name: input.name,
          agentType: input.agentType,
          agentSettings: input.agentSettings,
          maxConcurrencyLimit: input.maxConcurrencyLimit
        })
        .returning();
      
      return newAgent[0];
    }),
    
  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(100))),
      agentSettings: v.optional(v.record(v.string(), v.any())),
      maxConcurrencyLimit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(10)))
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const agent = await db
        .select({
          agent: agents,
          project: projects
        })
        .from(agents)
        .innerJoin(projects, eq(agents.projectId, projects.id))
        .where(
          and(
            eq(agents.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);
      
      if (agent.length === 0) {
        throw new Error("Agent not found or unauthorized");
      }
      
      const updates: any = { updatedAt: new Date() };
      
      if (input.name !== undefined) updates.name = input.name;
      if (input.agentSettings !== undefined) updates.agentSettings = input.agentSettings;
      if (input.maxConcurrencyLimit !== undefined) updates.maxConcurrencyLimit = input.maxConcurrencyLimit;
      
      const updated = await db
        .update(agents)
        .set(updates)
        .where(eq(agents.id, input.id))
        .returning();
      
      return updated[0];
    }),
    
  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const agent = await db
        .select({
          agent: agents,
          project: projects
        })
        .from(agents)
        .innerJoin(projects, eq(agents.projectId, projects.id))
        .where(
          and(
            eq(agents.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);
      
      if (agent.length === 0) {
        throw new Error("Agent not found or unauthorized");
      }
      
      // TODO: Check if any tasks are using this agent
      // For now, allow deletion (tasks will need to handle null agent)
      await db.delete(agents).where(eq(agents.id, input.id));
      
      return { success: true };
    })
});