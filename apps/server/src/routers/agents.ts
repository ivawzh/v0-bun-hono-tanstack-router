import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { repoAgents, actors, sessions, tasks, projects } from "../db/schema/simplified";
import { eq, and, desc, sql } from "drizzle-orm";

export const agentsRouter = o.router({
  // Compatibility method for old frontend calls
  list: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      // Return empty array since agents don't exist in simplified architecture
      return [];
    }),

  // Repo Agents Management
  listRepoAgents: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.ownerId, context.user.id)
        )
      });

      if (!project) {
        throw new Error("Project not found or unauthorized");
      }

      return await db.query.repoAgents.findMany({
        where: eq(repoAgents.projectId, input.projectId),
        orderBy: desc(repoAgents.createdAt)
      });
    }),

  createRepoAgent: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      repoPath: v.pipe(v.string(), v.minLength(1)),
      clientType: v.picklist(["claude_code", "opencode"]),
      config: v.optional(v.record(v.string(), v.any()))
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.ownerId, context.user.id)
        )
      });

      if (!project) {
        throw new Error("Project not found or unauthorized");
      }

      const [newRepoAgent] = await db
        .insert(repoAgents)
        .values({
          projectId: input.projectId,
          name: input.name,
          repoPath: input.repoPath,
          clientType: input.clientType,
          config: input.config || {}
        })
        .returning();

      return newRepoAgent;
    }),

  updateRepoAgent: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      repoPath: v.optional(v.pipe(v.string(), v.minLength(1))),
      clientType: v.optional(v.picklist(["claude_code", "opencode"])),
      status: v.optional(v.picklist(["idle", "active", "rate_limited", "error"])),
      config: v.optional(v.record(v.string(), v.any()))
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const repoAgent = await db.query.repoAgents.findFirst({
        where: eq(repoAgents.id, input.id),
        with: {
          project: true
        }
      });

      if (!repoAgent || repoAgent.project.ownerId !== context.user.id) {
        throw new Error("Repo agent not found or unauthorized");
      }

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.repoPath !== undefined) updateData.repoPath = input.repoPath;
      if (input.clientType !== undefined) updateData.clientType = input.clientType;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.config !== undefined) updateData.config = input.config;

      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(repoAgents)
        .set(updateData)
        .where(eq(repoAgents.id, input.id))
        .returning();

      return updated;
    }),

  deleteRepoAgent: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const repoAgent = await db.query.repoAgents.findFirst({
        where: eq(repoAgents.id, input.id),
        with: {
          project: true
        }
      });

      if (!repoAgent || repoAgent.project.ownerId !== context.user.id) {
        throw new Error("Repo agent not found or unauthorized");
      }

      // Check if any tasks are assigned to this repo agent
      const tasksUsingAgent = await db.query.tasks.findFirst({
        where: eq(tasks.repoAgentId, input.id)
      });

      if (tasksUsingAgent) {
        throw new Error("Cannot delete repo agent that has assigned tasks");
      }

      await db.delete(repoAgents).where(eq(repoAgents.id, input.id));
      return { success: true };
    }),

  // Actors Management
  listActors: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.ownerId, context.user.id)
        )
      });

      if (!project) {
        throw new Error("Project not found or unauthorized");
      }

      return await db.query.actors.findMany({
        where: eq(actors.projectId, input.projectId),
        orderBy: [desc(actors.isDefault), desc(actors.createdAt)]
      });
    }),

  createActor: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      description: v.pipe(v.string(), v.minLength(1)),
      isDefault: v.optional(v.boolean(), false)
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.ownerId, context.user.id)
        )
      });

      if (!project) {
        throw new Error("Project not found or unauthorized");
      }

      // If this is being set as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(actors)
          .set({ isDefault: false })
          .where(and(
            eq(actors.projectId, input.projectId),
            eq(actors.isDefault, true)
          ));
      }

      const [newActor] = await db
        .insert(actors)
        .values({
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          isDefault: input.isDefault
        })
        .returning();

      return newActor;
    }),

  updateActor: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      description: v.optional(v.pipe(v.string(), v.minLength(1))),
      isDefault: v.optional(v.boolean())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const actor = await db.query.actors.findFirst({
        where: eq(actors.id, input.id),
        with: {
          project: true
        }
      });

      if (!actor || actor.project.ownerId !== context.user.id) {
        throw new Error("Actor not found or unauthorized");
      }

      // If this is being set as default, unset other defaults
      if (input.isDefault) {
        await db
          .update(actors)
          .set({ isDefault: false })
          .where(and(
            eq(actors.projectId, actor.projectId),
            eq(actors.isDefault, true)
          ));
      }

      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(actors)
        .set(updateData)
        .where(eq(actors.id, input.id))
        .returning();

      return updated;
    }),

  deleteActor: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const actor = await db.query.actors.findFirst({
        where: eq(actors.id, input.id),
        with: {
          project: true
        }
      });

      if (!actor || actor.project.ownerId !== context.user.id) {
        throw new Error("Actor not found or unauthorized");
      }

      // Check if any tasks are assigned to this actor
      const tasksUsingActor = await db.query.tasks.findFirst({
        where: eq(tasks.actorId, input.id)
      });

      if (tasksUsingActor) {
        throw new Error("Cannot delete actor that has assigned tasks");
      }

      await db.delete(actors).where(eq(actors.id, input.id));
      return { success: true };
    }),

  // Initialize default actor for a project
  initializeDefaultActor: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify project ownership
      const project = await db.query.projects.findFirst({
        where: and(
          eq(projects.id, input.projectId),
          eq(projects.ownerId, context.user.id)
        )
      });

      if (!project) {
        throw new Error("Project not found or unauthorized");
      }

      // Check if default actor already exists
      const existingDefault = await db.query.actors.findFirst({
        where: and(
          eq(actors.projectId, input.projectId),
          eq(actors.isDefault, true)
        )
      });

      if (existingDefault) {
        return existingDefault;
      }

      // Create default actor
      const [defaultActor] = await db
        .insert(actors)
        .values({
          projectId: input.projectId,
          name: "Full-Stack Engineering Agent",
          description: "Pragmatic problem-solver focused on working solutions over perfect code. Thinks Small: Ignore performance, cost, and scalability. Day-0 mindset with extreme simplicity. Delivers functional features that solve real user problems with simplicity, reliability, and maintainable code.",
          isDefault: true
        })
        .returning();

      return defaultActor;
    }),

  // Note: Code agent HTTP endpoints moved to MCP server tools
});
