import { orpc } from "../lib/orpc";
import { z } from "zod";
import { db } from "../db";
import { 
  tasks, boards, projects, agents, taskEvents, taskArtifacts,
  taskChecklistItems, messages, questions, notifications, automations
} from "../db/schema/core";
import { eq, and, desc, or, inArray } from "drizzle-orm";

const taskStatusEnum = z.enum(["todo", "in_progress", "blocked", "done", "paused"]);
const taskStageEnum = z.enum(["kickoff", "spec", "design", "dev", "qa", "done"]);

export const tasksRouter = orpc.protectedRouter
  .route("list", {
    method: "GET",
    input: z.object({
      boardId: z.string().uuid().optional(),
      status: taskStatusEnum.optional(),
      stage: taskStageEnum.optional(),
      assignedActorType: z.enum(["agent", "human"]).optional()
    }),
    handler: async ({ ctx, input }) => {
      let query = db.select({
        task: tasks,
        board: boards,
        project: projects
      })
      .from(tasks)
      .innerJoin(boards, eq(tasks.boardId, boards.id))
      .innerJoin(projects, eq(boards.projectId, projects.id))
      .where(eq(projects.ownerId, ctx.user.id));
      
      const conditions = [];
      if (input.boardId) conditions.push(eq(tasks.boardId, input.boardId));
      if (input.status) conditions.push(eq(tasks.status, input.status));
      if (input.stage) conditions.push(eq(tasks.stage, input.stage));
      if (input.assignedActorType) conditions.push(eq(tasks.assignedActorType, input.assignedActorType));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions, eq(projects.ownerId, ctx.user.id)));
      }
      
      const results = await query.orderBy(desc(tasks.priority), desc(tasks.createdAt));
      
      return results.map(r => r.task);
    }
  })
  .route("get", {
    method: "GET",
    input: z.object({
      id: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(tasks.id, input.id),
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }
      
      return task[0].task;
    }
  })
  .route("create", {
    method: "POST",
    input: z.object({
      boardId: z.string().uuid(),
      title: z.string().min(1).max(255),
      bodyMd: z.string().optional(),
      status: taskStatusEnum.default("todo"),
      stage: taskStageEnum.default("kickoff"),
      priority: z.number().int().min(0).max(10).default(0),
      metadata: z.record(z.any()).optional(),
      assignedActorType: z.enum(["agent", "human"]).optional(),
      assignedAgentId: z.string().uuid().optional()
    }),
    handler: async ({ ctx, input }) => {
      // Verify board ownership
      const board = await db
        .select({
          board: boards,
          project: projects
        })
        .from(boards)
        .innerJoin(projects, eq(boards.projectId, projects.id))
        .where(
          and(
            eq(boards.id, input.boardId),
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (board.length === 0) {
        throw new Error("Board not found or unauthorized");
      }
      
      const newTask = await db
        .insert(tasks)
        .values({
          boardId: input.boardId,
          title: input.title,
          bodyMd: input.bodyMd,
          status: input.status,
          stage: input.stage,
          priority: input.priority,
          metadata: input.metadata || {},
          assignedActorType: input.assignedActorType,
          assignedAgentId: input.assignedAgentId
        })
        .returning();
      
      // Create initial event
      await db.insert(taskEvents).values({
        taskId: newTask[0].id,
        type: "created",
        payload: { user: ctx.user.id }
      });
      
      // Create kickoff checklist if stage is kickoff
      if (input.stage === "kickoff") {
        const kickoffItems = [
          "Clarify the requirement",
          "Challenge assumptions and identify risks",
          "List and rank solution options",
          "Select optimal solution",
          "Write acceptance criteria"
        ];
        
        await db.insert(taskChecklistItems).values(
          kickoffItems.map(item => ({
            taskId: newTask[0].id,
            stage: "kickoff",
            title: item,
            state: "open" as const
          }))
        );
      }
      
      return newTask[0];
    }
  })
  .route("update", {
    method: "PUT",
    input: z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(255).optional(),
      bodyMd: z.string().optional(),
      status: taskStatusEnum.optional(),
      stage: taskStageEnum.optional(),
      priority: z.number().int().min(0).max(10).optional(),
      metadata: z.record(z.any()).optional(),
      assignedActorType: z.enum(["agent", "human"]).nullish(),
      assignedAgentId: z.string().uuid().nullish()
    }),
    handler: async ({ ctx, input }) => {
      // Verify ownership
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
            eq(tasks.id, input.id),
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }
      
      const oldTask = task[0].task;
      const updates: any = { updatedAt: new Date() };
      const events: any[] = [];
      
      if (input.title !== undefined) updates.title = input.title;
      if (input.bodyMd !== undefined) updates.bodyMd = input.bodyMd;
      if (input.priority !== undefined) updates.priority = input.priority;
      if (input.metadata !== undefined) updates.metadata = input.metadata;
      if (input.assignedActorType !== undefined) updates.assignedActorType = input.assignedActorType;
      if (input.assignedAgentId !== undefined) updates.assignedAgentId = input.assignedAgentId;
      
      // Track status change
      if (input.status && input.status !== oldTask.status) {
        updates.status = input.status;
        events.push({
          taskId: input.id,
          type: "status_change",
          payload: { from: oldTask.status, to: input.status, user: ctx.user.id }
        });
      }
      
      // Track stage change
      if (input.stage && input.stage !== oldTask.stage) {
        updates.stage = input.stage;
        events.push({
          taskId: input.id,
          type: "stage_change",
          payload: { from: oldTask.stage, to: input.stage, user: ctx.user.id }
        });
        
        // Trigger automations
        const boardAutomations = await db
          .select()
          .from(automations)
          .where(
            and(
              eq(automations.boardId, oldTask.boardId),
              eq(automations.trigger, "stage_change"),
              or(
                eq(automations.fromStage, "*"),
                eq(automations.fromStage, oldTask.stage)
              ),
              eq(automations.toStage, input.stage)
            )
          );
        
        for (const automation of boardAutomations) {
          if (automation.action === "create_checklist" && automation.payload) {
            const items = (automation.payload as any).items || [];
            await db.insert(taskChecklistItems).values(
              items.map((item: string) => ({
                taskId: input.id,
                stage: input.stage,
                title: item,
                state: "open" as const
              }))
            );
          }
          
          if (automation.action === "notify") {
            await db.insert(notifications).values({
              taskId: input.id,
              type: "stage_change",
              channel: "inapp",
              payload: automation.payload
            });
          }
        }
      }
      
      const updated = await db
        .update(tasks)
        .set(updates)
        .where(eq(tasks.id, input.id))
        .returning();
      
      // Insert events
      if (events.length > 0) {
        await db.insert(taskEvents).values(events);
      } else if (Object.keys(updates).length > 1) {
        // Generic update event if no specific events
        await db.insert(taskEvents).values({
          taskId: input.id,
          type: "updated",
          payload: { user: ctx.user.id, changes: Object.keys(updates) }
        });
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
      // Verify ownership
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
            eq(tasks.id, input.id),
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }
      
      // Delete related data
      await db.delete(taskEvents).where(eq(taskEvents.taskId, input.id));
      await db.delete(taskArtifacts).where(eq(taskArtifacts.taskId, input.id));
      await db.delete(taskChecklistItems).where(eq(taskChecklistItems.taskId, input.id));
      await db.delete(messages).where(eq(messages.taskId, input.id));
      await db.delete(questions).where(eq(questions.taskId, input.id));
      await db.delete(notifications).where(eq(notifications.taskId, input.id));
      
      // Delete task
      await db.delete(tasks).where(eq(tasks.id, input.id));
      
      return { success: true };
    }
  })
  .route("addMessage", {
    method: "POST",
    input: z.object({
      taskId: z.string().uuid(),
      contentMd: z.string(),
      author: z.enum(["human", "agent", "system"]).default("human")
    }),
    handler: async ({ ctx, input }) => {
      // Verify ownership
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
      
      const newMessage = await db
        .insert(messages)
        .values({
          taskId: input.taskId,
          author: input.author,
          contentMd: input.contentMd
        })
        .returning();
      
      // Add comment event
      await db.insert(taskEvents).values({
        taskId: input.taskId,
        type: "comment",
        payload: { messageId: newMessage[0].id, author: input.author }
      });
      
      return newMessage[0];
    }
  })
  .route("addArtifact", {
    method: "POST",
    input: z.object({
      taskId: z.string().uuid(),
      kind: z.enum(["diff", "file", "link", "log"]),
      uri: z.string(),
      meta: z.record(z.any()).optional()
    }),
    handler: async ({ ctx, input }) => {
      // Verify ownership
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
      
      const newArtifact = await db
        .insert(taskArtifacts)
        .values({
          taskId: input.taskId,
          kind: input.kind,
          uri: input.uri,
          meta: input.meta || {}
        })
        .returning();
      
      // Add artifact event
      await db.insert(taskEvents).values({
        taskId: input.taskId,
        type: "artifact_added",
        payload: { artifactId: newArtifact[0].id, kind: input.kind }
      });
      
      return newArtifact[0];
    }
  })
  .route("askQuestion", {
    method: "POST",
    input: z.object({
      taskId: z.string().uuid(),
      text: z.string(),
      askedBy: z.enum(["agent", "human"]).default("human")
    }),
    handler: async ({ ctx, input }) => {
      // Verify ownership
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
      
      const newQuestion = await db
        .insert(questions)
        .values({
          taskId: input.taskId,
          askedBy: input.askedBy,
          text: input.text,
          status: "open"
        })
        .returning();
      
      // Add question event and mark task as blocked if asked by agent
      await db.insert(taskEvents).values({
        taskId: input.taskId,
        type: "question",
        payload: { questionId: newQuestion[0].id, askedBy: input.askedBy }
      });
      
      if (input.askedBy === "agent") {
        await db
          .update(tasks)
          .set({ status: "blocked", updatedAt: new Date() })
          .where(eq(tasks.id, input.taskId));
        
        // Create notification
        await db.insert(notifications).values({
          taskId: input.taskId,
          type: "question",
          channel: "inapp",
          payload: { questionId: newQuestion[0].id, text: input.text }
        });
      }
      
      return newQuestion[0];
    }
  })
  .route("answerQuestion", {
    method: "POST",
    input: z.object({
      questionId: z.string().uuid(),
      answer: z.string()
    }),
    handler: async ({ ctx, input }) => {
      // Verify ownership through task
      const question = await db
        .select({
          question: questions,
          task: tasks,
          board: boards,
          project: projects
        })
        .from(questions)
        .innerJoin(tasks, eq(questions.taskId, tasks.id))
        .innerJoin(boards, eq(tasks.boardId, boards.id))
        .innerJoin(projects, eq(boards.projectId, projects.id))
        .where(
          and(
            eq(questions.id, input.questionId),
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (question.length === 0) {
        throw new Error("Question not found or unauthorized");
      }
      
      const updated = await db
        .update(questions)
        .set({
          status: "answered",
          answer: input.answer,
          answeredBy: ctx.user.id,
          resolvedAt: new Date()
        })
        .where(eq(questions.id, input.questionId))
        .returning();
      
      // If task was blocked due to this question, unblock it
      if (question[0].task.status === "blocked") {
        // Check if there are other open questions
        const openQuestions = await db
          .select()
          .from(questions)
          .where(
            and(
              eq(questions.taskId, question[0].task.id),
              eq(questions.status, "open")
            )
          );
        
        if (openQuestions.length === 0) {
          await db
            .update(tasks)
            .set({ status: "in_progress", updatedAt: new Date() })
            .where(eq(tasks.id, question[0].task.id));
        }
      }
      
      return updated[0];
    }
  })
  .route("updateChecklistItem", {
    method: "PUT",
    input: z.object({
      itemId: z.string().uuid(),
      state: z.enum(["open", "done"])
    }),
    handler: async ({ ctx, input }) => {
      // Verify ownership through task
      const item = await db
        .select({
          item: taskChecklistItems,
          task: tasks,
          board: boards,
          project: projects
        })
        .from(taskChecklistItems)
        .innerJoin(tasks, eq(taskChecklistItems.taskId, tasks.id))
        .innerJoin(boards, eq(tasks.boardId, boards.id))
        .innerJoin(projects, eq(boards.projectId, projects.id))
        .where(
          and(
            eq(taskChecklistItems.id, input.itemId),
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (item.length === 0) {
        throw new Error("Checklist item not found or unauthorized");
      }
      
      const updated = await db
        .update(taskChecklistItems)
        .set({
          state: input.state,
          updatedAt: new Date()
        })
        .where(eq(taskChecklistItems.id, input.itemId))
        .returning();
      
      return updated[0];
    }
  })
  .route("getDetails", {
    method: "GET",
    input: z.object({
      id: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
      // Verify ownership
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
            eq(tasks.id, input.id),
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }
      
      // Get all related data
      const [events, artifacts, checklistItems, taskMessages, taskQuestions] = await Promise.all([
        db.select().from(taskEvents).where(eq(taskEvents.taskId, input.id)).orderBy(desc(taskEvents.at)),
        db.select().from(taskArtifacts).where(eq(taskArtifacts.taskId, input.id)),
        db.select().from(taskChecklistItems).where(eq(taskChecklistItems.taskId, input.id)),
        db.select().from(messages).where(eq(messages.taskId, input.id)).orderBy(desc(messages.at)),
        db.select().from(questions).where(eq(questions.taskId, input.id))
      ]);
      
      return {
        ...task[0].task,
        board: task[0].board,
        project: task[0].project,
        events,
        artifacts,
        checklistItems,
        messages: taskMessages,
        questions: taskQuestions
      };
    }
  });