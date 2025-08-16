import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { repoAgents, projects, agentClients } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";

const clientTypeEnum = v.picklist(["claude_code", "opencode"]);
// Note: Status is now tracked in agentClients.state, not in repoAgents

// Helper function to get or create agent client by type
async function getOrCreateAgentByType(type: "CLAUDE_CODE" | "CURSOR_CLI" | "OPENCODE"): Promise<string> {
  let agent = await db.query.agentClients.findFirst({
    where: eq(agentClients.type, type)
  });
  
  if (!agent) {
    const [newAgent] = await db.insert(agentClients).values({
      type,
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
      
      const results = await db.query.repoAgents.findMany({
        where: eq(repoAgents.projectId, input.projectId),
        with: {
          agentClient: true
        },
        orderBy: desc(repoAgents.createdAt)
      });
      
      return results;
    }),
  
  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const result = await db.query.repoAgents.findFirst({
        where: eq(repoAgents.id, input.id),
        with: {
          agentClient: true,
          project: true
        }
      });
      
      if (!result || result.project.ownerId !== context.user.id) {
        throw new Error("Repo agent not found or unauthorized");
      }
      
      return result;
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
      
      // Map client type to agent type and get/create agent
      const agentType = mapClientTypeToAgentType(input.clientType);
      const agentClientId = await getOrCreateAgentByType(agentType);
      
      const newRepoAgent = await db
        .insert(repoAgents)
        .values({
          projectId: input.projectId,
          name: input.name,
          repoPath: input.repoPath,
          agentClientId: agentClientId,
          config: input.config
        })
        .returning();
      
      // Return with agent client info
      const result = await db.query.repoAgents.findFirst({
        where: eq(repoAgents.id, newRepoAgent[0].id),
        with: {
          agentClient: true
        }
      });
      
      return result;
    }),
  
  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      repoPath: v.optional(v.pipe(v.string(), v.minLength(1))),
      clientType: v.optional(clientTypeEnum),
      config: v.optional(v.any())
      // Note: status field removed from repoAgents table
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
      if (input.clientType !== undefined) {
        // Map client type to agent and get/create agent
        const agentType = mapClientTypeToAgentType(input.clientType);
        updates.agentClientId = await getOrCreateAgentByType(agentType);
      }
      if (input.config !== undefined) updates.config = input.config;
      // Note: status field removed from repoAgents table
      
      await db
        .update(repoAgents)
        .set(updates)
        .where(eq(repoAgents.id, input.id));
      
      // Return with agent client info
      const result = await db.query.repoAgents.findFirst({
        where: eq(repoAgents.id, input.id),
        with: {
          agentClient: true
        }
      });
      
      return result;
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