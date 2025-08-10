import { orpc } from "../lib/orpc";
import { z } from "zod";
import { db } from "../db";
import { 
  agents, agentSessions, agentActions, tasks, boards, projects 
} from "../db/schema/core";
import { eq, and, desc, isNull } from "drizzle-orm";

const agentRoleEnum = z.enum(["PM", "Designer", "Architect", "Engineer", "QA"]);
const agentRuntimeEnum = z.enum(["windows-runner", "cloud"]);
const sessionStateEnum = z.enum(["booting", "running", "paused", "stopped", "error", "done"]);
const actionTypeEnum = z.enum(["plan", "tool_call", "code_edit", "commit", "test", "comment"]);

export const agentsRouter = orpc.protectedRouter
  .route("list", {
    method: "GET",
    input: z.object({}).optional(),
    handler: async ({ ctx }) => {
      const agentsList = await db
        .select()
        .from(agents)
        .orderBy(desc(agents.createdAt));
      
      return agentsList;
    }
  })
  .route("get", {
    method: "GET",
    input: z.object({
      id: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.id))
        .limit(1);
      
      if (agent.length === 0) {
        throw new Error("Agent not found");
      }
      
      return agent[0];
    }
  })
  .route("create", {
    method: "POST",
    input: z.object({
      name: z.string().min(1).max(255),
      role: agentRoleEnum,
      character: z.string().optional(),
      config: z.record(z.any()).default({}),
      runtime: agentRuntimeEnum
    }),
    handler: async ({ ctx, input }) => {
      const newAgent = await db
        .insert(agents)
        .values({
          name: input.name,
          role: input.role,
          character: input.character,
          config: input.config,
          runtime: input.runtime
        })
        .returning();
      
      return newAgent[0];
    }
  })
  .route("update", {
    method: "PUT",
    input: z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      role: agentRoleEnum.optional(),
      character: z.string().optional(),
      config: z.record(z.any()).optional(),
      runtime: agentRuntimeEnum.optional()
    }),
    handler: async ({ ctx, input }) => {
      const updates: any = { updatedAt: new Date() };
      
      if (input.name !== undefined) updates.name = input.name;
      if (input.role !== undefined) updates.role = input.role;
      if (input.character !== undefined) updates.character = input.character;
      if (input.config !== undefined) updates.config = input.config;
      if (input.runtime !== undefined) updates.runtime = input.runtime;
      
      const updated = await db
        .update(agents)
        .set(updates)
        .where(eq(agents.id, input.id))
        .returning();
      
      if (updated.length === 0) {
        throw new Error("Agent not found");
      }
      
      return updated[0];
    }
  })
  .route("delete", {
    method: "DELETE",
    input: z.object({
      id: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
      // Check if agent has active sessions
      const activeSessions = await db
        .select()
        .from(agentSessions)
        .where(
          and(
            eq(agentSessions.agentId, input.id),
            isNull(agentSessions.endedAt)
          )
        );
      
      if (activeSessions.length > 0) {
        throw new Error("Cannot delete agent with active sessions");
      }
      
      await db.delete(agents).where(eq(agents.id, input.id));
      
      return { success: true };
    }
  })
  .route("startSession", {
    method: "POST",
    input: z.object({
      agentId: z.string().uuid(),
      taskId: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
      // Verify task ownership
      const task = await db
        .select({
          task: tasks,
          board: boards,
          project: projects
        })
        .from(tasks)
        .innerJoin(boards, eq(tasks.boardId, boards.id))
        .innerJoin(projects, eq(boards.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.taskId),
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }
      
      // Check if there's already an active session for this task
      const existingSession = await db
        .select()
        .from(agentSessions)
        .where(
          and(
            eq(agentSessions.taskId, input.taskId),
            isNull(agentSessions.endedAt)
          )
        );
      
      if (existingSession.length > 0) {
        throw new Error("Task already has an active session");
      }
      
      // Create new session
      const newSession = await db
        .insert(agentSessions)
        .values({
          agentId: input.agentId,
          taskId: input.taskId,
          state: "booting"
        })
        .returning();
      
      // Update task to in_progress and assign agent
      await db
        .update(tasks)
        .set({
          status: "in_progress",
          assignedActorType: "agent",
          assignedAgentId: input.agentId,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, input.taskId));
      
      return newSession[0];
    }
  })
  .route("updateSessionState", {
    method: "PUT",
    input: z.object({
      sessionId: z.string().uuid(),
      state: sessionStateEnum
    }),
    handler: async ({ ctx, input }) => {
      const updates: any = { state: input.state };
      
      if (input.state === "stopped" || input.state === "done" || input.state === "error") {
        updates.endedAt = new Date();
      }
      
      const updated = await db
        .update(agentSessions)
        .set(updates)
        .where(eq(agentSessions.id, input.sessionId))
        .returning();
      
      if (updated.length === 0) {
        throw new Error("Session not found");
      }
      
      // If session ended, update task status
      if (updates.endedAt) {
        const session = updated[0];
        const newStatus = input.state === "done" ? "done" : 
                         input.state === "error" ? "blocked" : "paused";
        
        await db
          .update(tasks)
          .set({
            status: newStatus,
            updatedAt: new Date()
          })
          .where(eq(tasks.id, session.taskId));
      }
      
      return updated[0];
    }
  })
  .route("addAction", {
    method: "POST",
    input: z.object({
      sessionId: z.string().uuid(),
      type: actionTypeEnum,
      payload: z.record(z.any()).default({})
    }),
    handler: async ({ ctx, input }) => {
      // Verify session exists and is active
      const session = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, input.sessionId))
        .limit(1);
      
      if (session.length === 0) {
        throw new Error("Session not found");
      }
      
      if (session[0].endedAt) {
        throw new Error("Cannot add action to ended session");
      }
      
      const newAction = await db
        .insert(agentActions)
        .values({
          sessionId: input.sessionId,
          type: input.type,
          payload: input.payload
        })
        .returning();
      
      return newAction[0];
    }
  })
  .route("getSessionActions", {
    method: "GET",
    input: z.object({
      sessionId: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
      const actions = await db
        .select()
        .from(agentActions)
        .where(eq(agentActions.sessionId, input.sessionId))
        .orderBy(desc(agentActions.at));
      
      return actions;
    }
  })
  .route("getActiveSessions", {
    method: "GET",
    input: z.object({
      agentId: z.string().uuid().optional()
    }),
    handler: async ({ ctx, input }) => {
      let query = db
        .select({
          session: agentSessions,
          agent: agents,
          task: tasks
        })
        .from(agentSessions)
        .innerJoin(agents, eq(agentSessions.agentId, agents.id))
        .innerJoin(tasks, eq(agentSessions.taskId, tasks.id))
        .where(isNull(agentSessions.endedAt));
      
      if (input.agentId) {
        query = query.where(
          and(
            isNull(agentSessions.endedAt),
            eq(agentSessions.agentId, input.agentId)
          )
        );
      }
      
      const sessions = await query.orderBy(desc(agentSessions.startedAt));
      
      return sessions;
    }
  })
  .route("pauseSession", {
    method: "POST",
    input: z.object({
      sessionId: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
      const updated = await db
        .update(agentSessions)
        .set({ state: "paused" })
        .where(
          and(
            eq(agentSessions.id, input.sessionId),
            eq(agentSessions.state, "running")
          )
        )
        .returning();
      
      if (updated.length === 0) {
        throw new Error("Session not found or not running");
      }
      
      // Update task status to paused
      await db
        .update(tasks)
        .set({
          status: "paused",
          updatedAt: new Date()
        })
        .where(eq(tasks.id, updated[0].taskId));
      
      return updated[0];
    }
  })
  .route("resumeSession", {
    method: "POST",
    input: z.object({
      sessionId: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
      const updated = await db
        .update(agentSessions)
        .set({ state: "running" })
        .where(
          and(
            eq(agentSessions.id, input.sessionId),
            eq(agentSessions.state, "paused")
          )
        )
        .returning();
      
      if (updated.length === 0) {
        throw new Error("Session not found or not paused");
      }
      
      // Update task status to in_progress
      await db
        .update(tasks)
        .set({
          status: "in_progress",
          updatedAt: new Date()
        })
        .where(eq(tasks.id, updated[0].taskId));
      
      return updated[0];
    }
  });