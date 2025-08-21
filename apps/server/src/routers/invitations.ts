import * as v from "valibot";
import { db as mainDb } from "../db";
import { projectInvitations, projectUsers, users, projects } from "../db/schema";
import { eq, and, lt } from "drizzle-orm";
import { protectedProcedure, publicProcedure, o } from "../lib/orpc";

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

export const invitationsRouter = o.router({
  // Get invitation details by token (public route)
  getByToken: publicProcedure
    .input(v.object({
      token: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ input }) => {
      const db = getDb();
      
      const invitation = await db
        .select({
          invitation: projectInvitations,
          project: projects,
          invitedByUser: users
        })
        .from(projectInvitations)
        .innerJoin(projects, eq(projectInvitations.projectId, projects.id))
        .innerJoin(users, eq(projectInvitations.invitedByUserId, users.id))
        .where(eq(projectInvitations.token, input.token))
        .limit(1);

      if (invitation.length === 0) {
        throw new Error("Invitation not found");
      }

      const inv = invitation[0].invitation;
      
      // Check if invitation is expired
      if (new Date() > inv.expiresAt) {
        throw new Error("Invitation has expired");
      }

      // Check if invitation is still pending
      if (inv.status !== "pending") {
        throw new Error("Invitation is no longer valid");
      }

      return {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expiresAt: inv.expiresAt,
        project: invitation[0].project,
        invitedByUser: invitation[0].invitedByUser
      };
    }),

  // Accept invitation (protected route - user must be authenticated)
  accept: protectedProcedure
    .input(v.object({
      token: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();
      
      // Get invitation details
      const invitation = await db
        .select()
        .from(projectInvitations)
        .where(
          and(
            eq(projectInvitations.token, input.token),
            eq(projectInvitations.status, "pending"),
            eq(projectInvitations.email, context.user.email) // Must match user's email
          )
        )
        .limit(1);

      if (invitation.length === 0) {
        throw new Error("Invitation not found or not valid for this user");
      }

      const inv = invitation[0];

      // Check if invitation is expired
      if (new Date() > inv.expiresAt) {
        throw new Error("Invitation has expired");
      }

      // Check if user is already a member of this project
      const existingMember = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.userId, context.user.id),
            eq(projectUsers.projectId, inv.projectId)
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        throw new Error("You are already a member of this project");
      }

      // Begin transaction: Add user to project and mark invitation as accepted
      const newMember = await db
        .insert(projectUsers)
        .values({
          userId: context.user.id,
          projectId: inv.projectId,
          role: inv.role
        })
        .returning();

      // Update invitation status
      await db
        .update(projectInvitations)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(projectInvitations.id, inv.id));

      return {
        success: true,
        membership: newMember[0]
      };
    }),

  // Decline invitation (protected route - user must be authenticated)
  decline: protectedProcedure
    .input(v.object({
      token: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();
      
      // Get invitation details
      const invitation = await db
        .select()
        .from(projectInvitations)
        .where(
          and(
            eq(projectInvitations.token, input.token),
            eq(projectInvitations.status, "pending"),
            eq(projectInvitations.email, context.user.email) // Must match user's email
          )
        )
        .limit(1);

      if (invitation.length === 0) {
        throw new Error("Invitation not found or not valid for this user");
      }

      const inv = invitation[0];

      // Update invitation status
      await db
        .update(projectInvitations)
        .set({
          status: "declined",
          declinedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(projectInvitations.id, inv.id));

      return { success: true };
    }),

  // Get user's pending invitations (protected route)
  getUserInvitations: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      const db = getDb();
      
      const invitations = await db
        .select({
          invitation: projectInvitations,
          project: projects,
          invitedByUser: users
        })
        .from(projectInvitations)
        .innerJoin(projects, eq(projectInvitations.projectId, projects.id))
        .innerJoin(users, eq(projectInvitations.invitedByUserId, users.id))
        .where(
          and(
            eq(projectInvitations.email, context.user.email),
            eq(projectInvitations.status, "pending")
          )
        )
        .orderBy(projectInvitations.createdAt);

      // Filter out expired invitations
      const validInvitations = invitations.filter((inv: any) => 
        new Date() <= inv.invitation.expiresAt
      );

      return validInvitations;
    }),
});