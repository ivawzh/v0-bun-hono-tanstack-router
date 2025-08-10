import { protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { 
  agents, agentSessions, agentActions, tasks, boards, projects 
} from "../db/schema/core";
import { eq, and, desc, isNull } from "drizzle-orm";

const agentRoleEnum = v.picklist(["PM", "Designer", "Architect", "Engineer", "QA"]);
const agentRuntimeEnum = v.picklist(["windows-runner", "cloud"]);
const sessionStateEnum = v.picklist(["booting", "running", "paused", "stopped", "error", "done"]);
const actionTypeEnum = v.picklist(["plan", "tool_call", "code_edit", "commit", "test", "comment"]);

export const agentsRouter = {
  list: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      const agentsList = await db
        .select()
        .from(agents)
        .orderBy(desc(agents.createdAt));
      
      return agentsList;
    }),
  
  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, input.id))
        .limit(1);
      
      if (agent.length === 0) {
        throw new Error("Agent not found");
      }
      
      return agent[0];
    }),
  
  create: protectedProcedure
    .input(v.object({
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      role: agentRoleEnum,
      character: v.optional(v.string()),
      config: v.optional(v.record(v.string(), v.any()), {}),
      runtime: agentRuntimeEnum
    }))
    .handler(async ({ context, input }) => {
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
    }),
  
  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      role: v.optional(agentRoleEnum),
      character: v.optional(v.string()),
      config: v.optional(v.record(v.string(), v.any())),
      runtime: v.optional(agentRuntimeEnum)
    }))
    .handler(async ({ context, input }) => {
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
    }),
  
  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
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
    }),
  
  startSession: protectedProcedure
    .input(v.object({
      agentId: v.pipe(v.string(), v.uuid()),
      taskId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
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
    }),
  
  updateSessionState: protectedProcedure
    .input(v.object({
      sessionId: v.pipe(v.string(), v.uuid()),
      state: sessionStateEnum
    }))
    .handler(async ({ context, input }) => {
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
    }),
  
  addAction: protectedProcedure
    .input(v.object({
      sessionId: v.pipe(v.string(), v.uuid()),
      type: actionTypeEnum,
      payload: v.optional(v.record(v.string(), v.any()), {})
    }))
    .handler(async ({ context, input }) => {
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
    }),
  
  getSessionActions: protectedProcedure
    .input(v.object({
      sessionId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const actions = await db
        .select()
        .from(agentActions)
        .where(eq(agentActions.sessionId, input.sessionId))
        .orderBy(desc(agentActions.at));
      
      return actions;
    }),
  
  getActiveSessions: protectedProcedure
    .input(v.object({
      agentId: v.optional(v.pipe(v.string(), v.uuid()))
    }))
    .handler(async ({ context, input }) => {
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
    }),
  
  pauseSession: protectedProcedure
    .input(v.object({
      sessionId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
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
    }),
  
  resumeSession: protectedProcedure
    .input(v.object({
      sessionId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
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
    })
};