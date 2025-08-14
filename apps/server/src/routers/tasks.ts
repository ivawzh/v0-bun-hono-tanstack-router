import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { 
  tasks, boards, projects, agents, taskEvents, taskArtifacts,
  taskChecklistItems, messages, questions, notifications, taskHooks
} from "../db/schema/core";
import { eq, and, desc, or, inArray } from "drizzle-orm";

const taskStatusEnum = v.picklist(["todo", "in_progress", "qa", "done", "paused"]);
const taskStageEnum = v.picklist(["kickoff", "spec", "design", "dev", "qa", "done"]);

export const tasksRouter = o.router({
  list: protectedProcedure
    .input(v.object({
      boardId: v.optional(v.pipe(v.string(), v.uuid())),
      status: v.optional(taskStatusEnum),
      stage: v.optional(taskStageEnum),
      assignedActorType: v.optional(v.picklist(["agent", "human"]))
    }))
    .handler(async ({ context, input }) => {
      const conditions = [eq(projects.ownerId, context.user.id)];
      if (input.boardId) conditions.push(eq(tasks.boardId, input.boardId));
      if (input.status) conditions.push(eq(tasks.status, input.status));
      if (input.stage) conditions.push(eq(tasks.stage, input.stage));
      if (input.assignedActorType) conditions.push(eq(tasks.assignedActorType, input.assignedActorType));
      
      const results = await db.select({
        task: tasks,
        board: boards,
        project: projects
      })
      .from(tasks)
      .innerJoin(boards, eq(tasks.boardId, boards.id))
      .innerJoin(projects, eq(boards.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(tasks.position, desc(tasks.priority), desc(tasks.createdAt));
      
      return results.map((r: any) => r.task);
    }),
  
  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }
      
      return task[0].task;
    }),
  
  create: protectedProcedure
    .input(v.object({
      boardId: v.pipe(v.string(), v.uuid()),
      title: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      bodyMd: v.optional(v.string()),
      status: v.optional(taskStatusEnum, "todo"),
      stage: v.optional(taskStageEnum, "kickoff"),
      priority: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10)), 0),
      metadata: v.optional(v.record(v.string(), v.any())),
      assignedActorType: v.optional(v.picklist(["agent", "human"])),
      assignedAgentId: v.optional(v.pipe(v.string(), v.uuid())),
      isBlocked: v.optional(v.boolean(), false),
      qaRequired: v.optional(v.boolean(), false),
      agentReady: v.optional(v.boolean(), false)
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
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
          assignedAgentId: input.assignedAgentId,
          isBlocked: input.isBlocked,
          qaRequired: input.qaRequired,
          agentReady: input.agentReady
        })
        .returning();
      
      // Create initial event
      await db.insert(taskEvents).values({
        taskId: newTask[0].id,
        type: "created",
        payload: { user: context.user.id }
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
    }),
  
  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      bodyMd: v.optional(v.string()),
      status: v.optional(taskStatusEnum),
      stage: v.optional(taskStageEnum),
      priority: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10))),
      metadata: v.optional(v.record(v.string(), v.any())),
      assignedActorType: v.nullish(v.picklist(["agent", "human"])),
      assignedAgentId: v.nullish(v.pipe(v.string(), v.uuid())),
      isBlocked: v.optional(v.boolean()),
      qaRequired: v.optional(v.boolean()),
      agentReady: v.optional(v.boolean())
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
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
      if (input.isBlocked !== undefined) updates.isBlocked = input.isBlocked;
      if (input.qaRequired !== undefined) updates.qaRequired = input.qaRequired;
      if (input.agentReady !== undefined) updates.agentReady = input.agentReady;
      
      // Track status change
      if (input.status && input.status !== oldTask.status) {
        updates.status = input.status;
        events.push({
          taskId: input.id,
          type: "status_change",
          payload: { from: oldTask.status, to: input.status, user: context.user.id }
        });
      }
      
      // Track stage change
      if (input.stage && input.stage !== oldTask.stage) {
        updates.stage = input.stage;
        events.push({
          taskId: input.id,
          type: "stage_change",
          payload: { from: oldTask.stage, to: input.stage, user: context.user.id }
        });
        
        // Trigger task hooks
        const boardTaskHooks = await db
          .select()
          .from(taskHooks)
          .where(
            and(
              eq(taskHooks.boardId, oldTask.boardId),
              eq(taskHooks.trigger, "stage_change"),
              or(
                eq(taskHooks.fromStage, "*"),
                eq(taskHooks.fromStage, oldTask.stage)
              ),
              eq(taskHooks.toStage, input.stage)
            )
          );
        
        for (const hook of boardTaskHooks) {
          if (hook.action === "create_checklist" && hook.payload) {
            const items = (hook.payload as any).items || [];
            await db.insert(taskChecklistItems).values(
              items.map((item: string) => ({
                taskId: input.id,
                stage: input.stage,
                title: item,
                state: "open" as const
              }))
            );
          }
          
          if (hook.action === "notify") {
            await db.insert(notifications).values({
              taskId: input.id,
              type: "stage_change",
              channel: "inapp",
              payload: hook.payload,
              webhookUrl: (hook.payload as any).webhookUrl
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
          payload: { user: context.user.id, changes: Object.keys(updates) }
        });
      }
      
      return updated[0];
    }),
  
  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
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
    }),
  
  addMessage: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      contentMd: v.string(),
      author: v.optional(v.picklist(["human", "agent", "system"]), "human")
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
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
    }),
  
  addArtifact: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      kind: v.picklist(["diff", "file", "link", "log"]),
      uri: v.string(),
      meta: v.optional(v.record(v.string(), v.any()))
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
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
    }),
  
  askQuestion: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      text: v.string(),
      askedBy: v.optional(v.picklist(["agent", "human"]), "human")
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
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
    }),
  
  answerQuestion: protectedProcedure
    .input(v.object({
      questionId: v.pipe(v.string(), v.uuid()),
      answer: v.string()
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
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
          answeredBy: context.user.id,
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
    }),
  
  updateChecklistItem: protectedProcedure
    .input(v.object({
      itemId: v.pipe(v.string(), v.uuid()),
      state: v.picklist(["open", "done"])
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
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
    }),
  
  reorder: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      boardId: v.pipe(v.string(), v.uuid()),
      status: taskStatusEnum,
      newPosition: v.pipe(v.number(), v.integer(), v.minValue(0))
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
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
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (board.length === 0) {
        throw new Error("Board not found or unauthorized");
      }

      // Verify task exists and belongs to this board
      const task = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, input.taskId),
            eq(tasks.boardId, input.boardId)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or doesn't belong to this board");
      }

      // Get all tasks in the same status column ordered by position
      const tasksInColumn = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.boardId, input.boardId),
            eq(tasks.status, input.status)
          )
        )
        .orderBy(tasks.position);

      // Update positions: 
      // 1. Remove the task being moved from its current position
      const filteredTasks = tasksInColumn.filter(t => t.id !== input.taskId);
      
      // 2. Insert the task at the new position
      const newOrderedTasks = [
        ...filteredTasks.slice(0, input.newPosition),
        task[0], 
        ...filteredTasks.slice(input.newPosition)
      ];

      // 3. Update all positions in batch
      const updates = newOrderedTasks.map((t, index) => ({
        id: t.id,
        position: index,
        // If this is the moved task and it's changing status, update that too
        ...(t.id === input.taskId && t.status !== input.status ? { status: input.status } : {})
      }));

      // Execute position updates
      for (const update of updates) {
        await db
          .update(tasks)
          .set({ 
            position: update.position, 
            ...(update.status ? { status: update.status } : {}),
            updatedAt: new Date() 
          })
          .where(eq(tasks.id, update.id));
      }

      // Log event if status changed
      if (task[0].status !== input.status) {
        await db.insert(taskEvents).values({
          taskId: input.taskId,
          type: "status_change",
          payload: { 
            from: task[0].status, 
            to: input.status, 
            user: context.user.id,
            reordered: true 
          }
        });
      }

      return { success: true };
    }),
  
  getDetails: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
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
            eq(projects.ownerId, context.user.id)
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
    })
});