import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { agents, agentSessions, agentActions, tasks, boards, projects } from "../db/schema/core";
import { eq, and, desc } from "drizzle-orm";

export const agentsRouter = o.router({
  list: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      const agentList = await db
        .select()
        .from(agents)
        .orderBy(desc(agents.createdAt));
      
      return agentList;
    }),

  create: protectedProcedure
    .input(v.object({
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      role: v.picklist(["PM", "Designer", "Architect", "Engineer", "QA"]),
      character: v.optional(v.string()),
      runtime: v.picklist(["windows-runner", "cloud"]),
      modelProvider: v.optional(v.string(), "openai"),
      modelName: v.optional(v.string(), "gpt-4"),
      modelConfig: v.optional(v.record(v.string(), v.any()))
    }))
    .handler(async ({ context, input }) => {
      const newAgent = await db
        .insert(agents)
        .values({
          name: input.name,
          role: input.role,
          character: input.character,
          runtime: input.runtime,
          modelProvider: input.modelProvider,
          modelName: input.modelName,
          modelConfig: input.modelConfig || {},
          config: {}
        })
        .returning();
      
      return newAgent[0];
    }),

  startSession: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      agentId: v.optional(v.pipe(v.string(), v.uuid()))
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

      // Get or create default agent
      let agentId = input.agentId;
      if (!agentId) {
        const defaultAgent = await db
          .select()
          .from(agents)
          .where(eq(agents.role, "Engineer"))
          .limit(1);
        
        if (defaultAgent.length === 0) {
          // Create a default agent
          const newAgent = await db
            .insert(agents)
            .values({
              name: "Default Engineer",
              role: "Engineer",
              character: "Helpful and thorough software engineer",
              runtime: "cloud",
              modelProvider: "openai",
              modelName: "gpt-4",
              config: {}
            })
            .returning();
          
          agentId = newAgent[0].id;
        } else {
          agentId = defaultAgent[0].id;
        }
      }

      // Create session
      const session = await db
        .insert(agentSessions)
        .values({
          agentId: agentId!,
          taskId: input.taskId,
          state: "running"
        })
        .returning();

      // Log action
      await db.insert(agentActions).values({
        sessionId: session[0].id,
        type: "plan",
        payload: { action: "session_started" }
      });

      return session[0];
    }),

  pauseSession: protectedProcedure
    .input(v.object({
      sessionId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // TODO: Verify session ownership through task
      
      const updated = await db
        .update(agentSessions)
        .set({
          state: "paused"
        })
        .where(eq(agentSessions.id, input.sessionId))
        .returning();

      if (updated.length === 0) {
        throw new Error("Session not found");
      }

      // Log action
      await db.insert(agentActions).values({
        sessionId: input.sessionId,
        type: "plan",
        payload: { action: "session_paused" }
      });

      return updated[0];
    }),

  resumeSession: protectedProcedure
    .input(v.object({
      sessionId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // TODO: Verify session ownership through task
      
      const updated = await db
        .update(agentSessions)
        .set({
          state: "running"
        })
        .where(eq(agentSessions.id, input.sessionId))
        .returning();

      if (updated.length === 0) {
        throw new Error("Session not found");
      }

      // Log action
      await db.insert(agentActions).values({
        sessionId: input.sessionId,
        type: "plan",
        payload: { action: "session_resumed" }
      });

      return updated[0];
    }),

  stopSession: protectedProcedure
    .input(v.object({
      sessionId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // TODO: Verify session ownership through task
      
      const updated = await db
        .update(agentSessions)
        .set({
          state: "stopped",
          endedAt: new Date()
        })
        .where(eq(agentSessions.id, input.sessionId))
        .returning();

      if (updated.length === 0) {
        throw new Error("Session not found");
      }

      // Log action
      await db.insert(agentActions).values({
        sessionId: input.sessionId,
        type: "plan",
        payload: { action: "session_stopped" }
      });

      return updated[0];
    })
});