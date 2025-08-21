import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { agents, actors, tasks, projects, projectUsers } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { broadcastFlush, broadcastAgentRateLimit } from "../websocket/websocket-server";

// Helper function to get or create agent by type (project-based agents)
async function getOrCreateAgentByType(projectId: string, type: "CLAUDE_CODE" | "CURSOR_CLI" | "OPENCODE"): Promise<string> {
  let agent = await db.query.agents.findFirst({
    where: and(eq(agents.projectId, projectId), eq(agents.agentType, type))
  });

  if (!agent) {
    const [newAgent] = await db.insert(agents).values({
      projectId,
      name: `${type} Agent`,
      agentType: type,
      agentSettings: {},
      state: {}
    }).returning();
    agent = newAgent;
  }

  return agent.id;
}

// Helper function to map old client type to new agent type
function mapClientTypeToAgentType(clientType: "claude_code" | "opencode"): "CLAUDE_CODE" | "CURSOR_CLI" | "OPENCODE" {
  switch (clientType) {
    case "claude_code":
      return "CLAUDE_CODE";
    case "opencode":
      return "OPENCODE";
    default:
      throw new Error(`Unknown client type: ${clientType}`);
  }
}

export const agentsRouter = o.router({
  // Project-scoped agents listing
  list: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      includeTaskCounts: v.optional(v.boolean(), false)
    }))
    .handler(async ({ context, input }) => {
      // Verify project access
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

      // Get agents for this specific project only
      const projectAgents = await db
        .select({
          id: agents.id,
          projectId: agents.projectId,
          name: agents.name,
          agentType: agents.agentType,
          agentSettings: agents.agentSettings,
          maxConcurrencyLimit: agents.maxConcurrencyLimit,
          lastTaskPushedAt: agents.lastTaskPushedAt,
          rateLimitResetAt: agents.rateLimitResetAt,
          state: agents.state,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt
        })
        .from(agents)
        .where(eq(agents.projectId, input.projectId))
        .orderBy(desc(agents.createdAt));

      return projectAgents;
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
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
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
      maxConcurrencyLimit: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(10)), 0)
    }))
    .handler(async ({ context, input }) => {
      // Verify project access
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
      maxConcurrencyLimit: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(10)))
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
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
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
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
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
      await db.delete(agents).where(eq(agents.id, input.id));

      return { success: true };
    }),

  // Agents Management 
  listAgents: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      includeTaskCounts: v.optional(v.boolean(), false)
    }))
    .handler(async ({ context, input }) => {
      // Verify project access
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

      // Get agents for this specific project only
      const projectAgents = await db
        .select({
          id: agents.id,
          projectId: agents.projectId,
          name: agents.name,
          agentType: agents.agentType,
          agentSettings: agents.agentSettings,
          maxConcurrencyLimit: agents.maxConcurrencyLimit,
          lastTaskPushedAt: agents.lastTaskPushedAt,
          rateLimitResetAt: agents.rateLimitResetAt,
          state: agents.state,
          createdAt: agents.createdAt,
          updatedAt: agents.updatedAt
        })
        .from(agents)
        .where(eq(agents.projectId, input.projectId))
        .orderBy(desc(agents.createdAt));

      return projectAgents;
    }),

  getAgent: protectedProcedure
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
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
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

  createAgent: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
      agentType: v.picklist(['CLAUDE_CODE', 'CURSOR_CLI', 'OPENCODE']),
      agentSettings: v.optional(v.record(v.string(), v.any()), {}),
      maxConcurrencyLimit: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(10)), 0)
    }))
    .handler(async ({ context, input }) => {
      // Verify project access
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

  updateAgent: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(100))),
      agentSettings: v.optional(v.record(v.string(), v.any())),
      maxConcurrencyLimit: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(10)))
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
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
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

  deleteAgent: protectedProcedure
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
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
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
      await db.delete(agents).where(eq(agents.id, input.id));

      return { success: true };
    }),

  // Update agent rate limit status
  updateRateLimit: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      rateLimitResetAt: v.optional(v.nullish(v.pipe(v.string(), v.isoTimestamp())))
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
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
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

      const resetAt = input.rateLimitResetAt ? new Date(input.rateLimitResetAt) : null;
      
      const updated = await db
        .update(agents)
        .set({
          rateLimitResetAt: resetAt,
          updatedAt: new Date()
        })
        .where(eq(agents.id, input.id))
        .returning();

      // Broadcast specific rate limit update via WebSocket
      broadcastAgentRateLimit(agent[0].project.id, input.id, resetAt);

      return updated[0];
    }),

  // Note: Code agent HTTP endpoints moved to MCP server tools
});
