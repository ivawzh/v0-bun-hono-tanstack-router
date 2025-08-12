import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { agents, agentSessions, agentActions, tasks, boards, projects } from "../db/schema/core";
import { eq, and, desc } from "drizzle-orm";
import { notifyClaudeCodeAboutTask } from "../gateway/websocket-handler";

export const agentsRouter = o.router({
  initializeDefaults: protectedProcedure
    .input(v.optional(v.object({})))
    .handler(async ({ context }) => {
      // Create default agents if they don't exist
      const defaultAgents = [
        {
          name: "Day-0 Business Owner",
          role: "PM",
          character: "Visionary entrepreneur focused on market validation and business strategy. Thinks big picture, prioritizes customer value, and makes decisive product decisions. Always considers ROI and business impact.",
          runtime: "windows-runner",
          modelProvider: "claude-code",
          modelName: "claude-3-5-sonnet-20241022"
        },
        {
          name: "Day-0 Product Manager",
          role: "PM", 
          character: "Analytical product strategist who bridges business needs with technical implementation. Expert at writing clear requirements, managing stakeholder expectations, and driving feature prioritization through data-driven decisions.",
          runtime: "windows-runner",
          modelProvider: "claude-code",
          modelName: "claude-3-5-sonnet-20241022"
        },
        {
          name: "Day-0 UX Designer",
          role: "Designer",
          character: "User-centered designer passionate about creating intuitive experiences. Thinks in user journeys, wireframes, and accessibility. Advocates for simplicity and usability while balancing business constraints.",
          runtime: "windows-runner", 
          modelProvider: "claude-code",
          modelName: "claude-3-5-sonnet-20241022"
        },
        {
          name: "Day-0 Developer",
          role: "Engineer",
          character: "Pragmatic full-stack engineer who delivers working solutions quickly. Focuses on clean, maintainable code and follows established patterns. Prefers proven technologies and iterative development.",
          runtime: "windows-runner",
          modelProvider: "claude-code", 
          modelName: "claude-3-5-sonnet-20241022"
        },
        {
          name: "Day-0 QA Engineer",
          role: "QA",
          character: "Detail-oriented quality advocate who thinks like an end user. Expert at edge case discovery, test automation, and ensuring reliable user experiences. Balances thoroughness with delivery speed.",
          runtime: "windows-runner",
          modelProvider: "claude-code",
          modelName: "claude-3-5-sonnet-20241022"
        }
      ];

      const createdAgents = [];
      for (const agentData of defaultAgents) {
        // Check if agent with this name already exists
        const existing = await db
          .select()
          .from(agents)
          .where(eq(agents.name, agentData.name))
          .limit(1);

        if (existing.length === 0) {
          const newAgent = await db
            .insert(agents)
            .values({
              ...agentData,
              config: {}
            })
            .returning();
          
          createdAgents.push(newAgent[0]);
        }
      }

      return { created: createdAgents, message: `Initialized ${createdAgents.length} default agents` };
    }),

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
      modelProvider: v.optional(v.string(), "claude-code"),
      modelName: v.optional(v.string(), "claude-3-5-sonnet-20241022"),
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
              name: "Local Claude Code",
              role: "Engineer",
              character: "Expert software engineer with access to local development environment via Claude Code",
              runtime: "windows-runner",
              modelProvider: "claude-code",
              modelName: "claude-3-5-sonnet-20241022",
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

      // Update task status to in_progress and set activeSessionId
      await db
        .update(tasks)
        .set({
          status: "in_progress",
          activeSessionId: session[0].id
        })
        .where(eq(tasks.id, input.taskId));

      // Log action
      await db.insert(agentActions).values({
        sessionId: session[0].id,
        type: "plan",
        payload: { action: "session_started" }
      });

      // Notify WebSocket clients if available
      console.log('[Agent Router] Notifying Claude Code UI about task...');
      const fullTask = task[0];
      
      // Log task details for debugging
      console.log('[Agent Router] Task details:', {
        taskId: fullTask.task.id,
        title: fullTask.task.title,
        projectName: fullTask.project.name,
        claudeProjectId: fullTask.project.claudeProjectId,
        localRepoPath: fullTask.project.localRepoPath
      });
      
      // Notify Claude Code UI about the task
      try {
        notifyClaudeCodeAboutTask({
          id: fullTask.task.id,
          title: fullTask.task.title,
          description: fullTask.task.bodyMd,
          localRepoPath: fullTask.project.localRepoPath,
          sessionId: session[0].id,
          projectName: fullTask.project.name,
          claudeProjectId: fullTask.project.claudeProjectId,
          priority: fullTask.task.priority,
          stage: fullTask.task.stage
        });
        console.log('[Agent Router] Notification sent successfully');
      } catch (error) {
        console.error('[Agent Router] Error sending notification:', error);
      }

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

      // Clear activeSessionId from task when pausing
      await db
        .update(tasks)
        .set({
          activeSessionId: null
        })
        .where(eq(tasks.activeSessionId, input.sessionId));

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