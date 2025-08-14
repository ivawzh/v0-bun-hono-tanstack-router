import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { actors, projects } from "../db/schema/simplified";
import { eq, and, desc, ne } from "drizzle-orm";

export const actorsRouter = o.router({
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
        .from(actors)
        .where(eq(actors.projectId, input.projectId))
        .orderBy(desc(actors.isDefault), desc(actors.createdAt));
      
      return results;
    }),
  
  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const result = await db
        .select({
          actor: actors,
          project: projects
        })
        .from(actors)
        .innerJoin(projects, eq(actors.projectId, projects.id))
        .where(
          and(
            eq(actors.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (result.length === 0) {
        throw new Error("Actor not found or unauthorized");
      }
      
      return result[0].actor;
    }),
  
  create: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      description: v.pipe(v.string(), v.minLength(1)),
      isDefault: v.optional(v.boolean(), false)
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
      
      // If setting as default, unset other defaults first
      if (input.isDefault) {
        await db
          .update(actors)
          .set({ isDefault: false })
          .where(
            and(
              eq(actors.projectId, input.projectId),
              eq(actors.isDefault, true)
            )
          );
      }
      
      const newActor = await db
        .insert(actors)
        .values({
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          isDefault: input.isDefault
        })
        .returning();
      
      return newActor[0];
    }),
  
  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      description: v.optional(v.pipe(v.string(), v.minLength(1))),
      isDefault: v.optional(v.boolean())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const actor = await db
        .select({
          actor: actors,
          project: projects
        })
        .from(actors)
        .innerJoin(projects, eq(actors.projectId, projects.id))
        .where(
          and(
            eq(actors.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (actor.length === 0) {
        throw new Error("Actor not found or unauthorized");
      }
      
      // If setting as default, unset other defaults first
      if (input.isDefault) {
        await db
          .update(actors)
          .set({ isDefault: false })
          .where(
            and(
              eq(actors.projectId, actor[0].actor.projectId),
              eq(actors.isDefault, true)
            )
          );
      }
      
      const updates: any = { updatedAt: new Date() };
      
      if (input.name !== undefined) updates.name = input.name;
      if (input.description !== undefined) updates.description = input.description;
      if (input.isDefault !== undefined) updates.isDefault = input.isDefault;
      
      const updated = await db
        .update(actors)
        .set(updates)
        .where(eq(actors.id, input.id))
        .returning();
      
      return updated[0];
    }),
  
  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const actor = await db
        .select({
          actor: actors,
          project: projects
        })
        .from(actors)
        .innerJoin(projects, eq(actors.projectId, projects.id))
        .where(
          and(
            eq(actors.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (actor.length === 0) {
        throw new Error("Actor not found or unauthorized");
      }
      
      // Don't allow deleting the default actor if it's the only one
      if (actor[0].actor.isDefault) {
        const otherActors = await db
          .select()
          .from(actors)
          .where(
            and(
              eq(actors.projectId, actor[0].actor.projectId),
              ne(actors.id, input.id)
            )
          );
        
        if (otherActors.length === 0) {
          throw new Error("Cannot delete the only actor in the project");
        }
        
        // Set another actor as default
        await db
          .update(actors)
          .set({ isDefault: true })
          .where(eq(actors.id, otherActors[0].id));
      }
      
      // TODO: Check if any tasks are using this actor
      // For now, allow deletion (tasks will use null actor)
      await db.delete(actors).where(eq(actors.id, input.id));
      
      return { success: true };
    })
});