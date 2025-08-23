import * as v from "valibot";
import { db as mainDb } from "../db";
import { projects, repositories, agents, actors, tasks, projectUsers, projectInvitations, users } from "../db/schema";
import { eq, and, desc, getTableColumns } from "drizzle-orm";
import { protectedProcedure, o } from "../lib/orpc";
import { generateInvitationToken, getInvitationExpiration } from "../utils/invitation-tokens";
import { EmailService } from "../services/email";
import { checkProjectOwnership, checkProjectAccess } from "../middleware/project-auth";

// Use test database when running tests, otherwise use main database
function getDb() {
  if (process.env.NODE_ENV === "test" || process.env.BUN_TEST) {
    try {
      const { getTestDb } = require("../test/setup");
      return getTestDb();
    } catch {
      // Fallback to main db if test setup not available
      return mainDb;
    }
  }
  return mainDb;
}

export const projectsRouter = o.router({
  list: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      try {
        const db = getDb();

        // Get projects through membership
        const userProjects = await db
          .select({ project: projects })
          .from(projects)
          .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
          .where(eq(projectUsers.userId, context.user.id))
          .orderBy(desc(projects.createdAt));

        return userProjects.map((row: any) => row.project);
      } catch (err: any) {
        throw err;
      }
    }),

  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();
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
        const db = getDb();
        const newProject = await db
          .insert(projects)
          .values({
            name: input.name,
            description: input.description,
            ownerId: context.user.id,
          })
          .returning();

        // Add the creator to project users as owner
        await db
          .insert(projectUsers)
          .values({
            userId: context.user.id,
            projectId: newProject[0].id,
            role: "owner"
          });

        return newProject[0];
      } catch (err: any) {
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
      const db = getDb();
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
      const db = getDb();
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
      const db = getDb();
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

      // Get task counts by list
      const taskStats = await db
        .select({
          list: tasks.list,
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
            byList: taskStats.reduce((acc: Record<string, number>, stat: { list: string; count: string }) => {
              acc[stat.list] = (acc[stat.list] || 0) + 1;
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
      const db = getDb();
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

  // Members management
  getMembers: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();

      // Check if user has access to this project
      if (!await checkProjectAccess(context.user.id, input.id)) {
        throw new Error("Project not found or unauthorized");
      }

      const members = await db
        .select({
          user: users,
          role: projectUsers.role,
          joinedAt: projectUsers.createdAt
        })
        .from(projectUsers)
        .innerJoin(users, eq(projectUsers.userId, users.id))
        .where(eq(projectUsers.projectId, input.id))
        .orderBy(desc(projectUsers.createdAt));

      return members;
    }),

  getInvitations: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();

      // Check if user is owner of this project
      if (!await checkProjectOwnership(context.user.id, input.id)) {
        throw new Error("Only project owners can view invitations");
      }

      const invitations = await db
        .select({
          invitation: projectInvitations,
          invitedByUser: users
        })
        .from(projectInvitations)
        .innerJoin(users, eq(projectInvitations.invitedByUserId, users.id))
        .where(eq(projectInvitations.projectId, input.id))
        .orderBy(desc(projectInvitations.createdAt));

      return invitations;
    }),

  inviteUser: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      email: v.pipe(v.string(), v.email()),
      role: v.optional(v.picklist(["member", "admin"])),
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();

      // Check if user is owner of this project
      if (!await checkProjectOwnership(context.user.id, input.projectId)) {
        throw new Error("Only project owners can invite users");
      }

      // Get project details
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (project.length === 0) {
        throw new Error("Project not found");
      }

      // Check if user is already a member
      const existingMember = await db
        .select()
        .from(users)
        .innerJoin(projectUsers, eq(projectUsers.userId, users.id))
        .where(
          and(
            eq(users.email, input.email),
            eq(projectUsers.projectId, input.projectId)
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        throw new Error("User is already a member of this project");
      }

      // Check if there's already a pending invitation for this email
      const existingInvitation = await db
        .select()
        .from(projectInvitations)
        .where(
          and(
            eq(projectInvitations.projectId, input.projectId),
            eq(projectInvitations.email, input.email),
            eq(projectInvitations.status, "pending")
          )
        )
        .limit(1);

      if (existingInvitation.length > 0) {
        throw new Error("An invitation has already been sent to this email");
      }

      // Create invitation
      const token = generateInvitationToken();
      const expiresAt = getInvitationExpiration();

      const invitation = await db
        .insert(projectInvitations)
        .values({
          projectId: input.projectId,
          invitedByUserId: context.user.id,
          email: input.email,
          role: input.role || "member",
          token,
          expiresAt
        })
        .returning();

      // Send invitation email
      const invitationUrl = `${process.env.WEB_APP_URL}/invite/${token}`;

      await EmailService.sendInvitation({
        inviterName: context.user.displayName,
        projectName: project[0].name,
        invitationUrl,
        email: input.email
      });

      return {
        ...invitation[0],
        invitationUrl // Include URL in response for testing/debugging
      };
    }),

  removeMember: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      userId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();

      // Check if user is owner of this project
      if (!await checkProjectOwnership(context.user.id, input.projectId)) {
        throw new Error("Only project owners can remove members");
      }

      // Cannot remove yourself
      if (input.userId === context.user.id) {
        throw new Error("Cannot remove yourself from the project");
      }

      // Remove member
      const result = await db
        .delete(projectUsers)
        .where(
          and(
            eq(projectUsers.projectId, input.projectId),
            eq(projectUsers.userId, input.userId)
          )
        );

      return { success: true };
    }),

  updateMemberRole: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      userId: v.pipe(v.string(), v.uuid()),
      role: v.picklist(["member", "admin"])
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();

      // Check if user is owner of this project
      if (!await checkProjectOwnership(context.user.id, input.projectId)) {
        throw new Error("Only project owners can update member roles");
      }

      // Cannot change your own role
      if (input.userId === context.user.id) {
        throw new Error("Cannot change your own role");
      }

      // Update member role
      const result = await db
        .update(projectUsers)
        .set({ role: input.role })
        .where(
          and(
            eq(projectUsers.projectId, input.projectId),
            eq(projectUsers.userId, input.userId)
          )
        )
        .returning();

      if (result.length === 0) {
        throw new Error("Member not found");
      }

      return result[0];
    }),

  revokeInvitation: protectedProcedure
    .input(v.object({
      invitationId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();

      // Get invitation and check ownership
      const invitation = await db
        .select()
        .from(projectInvitations)
        .innerJoin(projects, eq(projectInvitations.projectId, projects.id))
        .where(eq(projectInvitations.id, input.invitationId))
        .limit(1);

      if (invitation.length === 0) {
        throw new Error("Invitation not found");
      }

      // Check if user is owner of the project
      if (!await checkProjectOwnership(context.user.id, invitation[0].project_invitations.projectId)) {
        throw new Error("Only project owners can revoke invitations");
      }

      // Delete invitation
      await db
        .delete(projectInvitations)
        .where(eq(projectInvitations.id, input.invitationId));

      return { success: true };
    }),
});
