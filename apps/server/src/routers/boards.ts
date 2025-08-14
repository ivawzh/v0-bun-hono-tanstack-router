import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { db } from "../db";
import { boards, projects, tasks, taskHooks } from "../db/schema/core";
import { eq, and, desc } from "drizzle-orm";

export const boardsRouter = o.router({
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
      
      const boardList = await db
        .select()
        .from(boards)
        .where(eq(boards.projectId, input.projectId))
        .orderBy(desc(boards.createdAt));
      
      return boardList;
    }),
  
  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const board = await db
        .select({
          board: boards,
          project: projects
        })
        .from(boards)
        .innerJoin(projects, eq(boards.projectId, projects.id))
        .where(
          and(
            eq(boards.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (board.length === 0) {
        throw new Error("Board not found or unauthorized");
      }
      
      return board[0].board;
    }),
  
  create: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(255)),
      purpose: v.optional(v.string())
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
      
      const newBoard = await db
        .insert(boards)
        .values({
          projectId: input.projectId,
          name: input.name,
          purpose: input.purpose
        })
        .returning();
      
      // Create default automations for the board
      const defaultHooks = [
        {
          boardId: newBoard[0].id,
          trigger: "stage_change",
          fromStage: "kickoff",
          toStage: "spec",
          action: "create_checklist",
          payload: {
            items: [
              "Review requirements",
              "Identify constraints",
              "Define acceptance criteria"
            ]
          }
        },
        {
          boardId: newBoard[0].id,
          trigger: "stage_change",
          fromStage: "*",
          toStage: "dev",
          action: "notify",
          payload: {
            message: "Development stage started"
          }
        }
      ];
      
      await db.insert(taskHooks).values(defaultHooks);
      
      return newBoard[0];
    }),
  
  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      purpose: v.optional(v.string())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const board = await db
        .select({
          board: boards,
          project: projects
        })
        .from(boards)
        .innerJoin(projects, eq(boards.projectId, projects.id))
        .where(
          and(
            eq(boards.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (board.length === 0) {
        throw new Error("Board not found or unauthorized");
      }
      
      const updated = await db
        .update(boards)
        .set({
          name: input.name,
          purpose: input.purpose,
          updatedAt: new Date()
        })
        .where(eq(boards.id, input.id))
        .returning();
      
      return updated[0];
    }),
  
  delete: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
      const board = await db
        .select({
          board: boards,
          project: projects
        })
        .from(boards)
        .innerJoin(projects, eq(boards.projectId, projects.id))
        .where(
          and(
            eq(boards.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (board.length === 0) {
        throw new Error("Board not found or unauthorized");
      }
      
      // Delete related data
      await db.delete(tasks).where(eq(tasks.boardId, input.id));
      await db.delete(taskHooks).where(eq(taskHooks.boardId, input.id));
      
      // Delete board
      await db.delete(boards).where(eq(boards.id, input.id));
      
      return { success: true };
    }),
  
  getWithTasks: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const board = await db
        .select({
          board: boards,
          project: projects
        })
        .from(boards)
        .innerJoin(projects, eq(boards.projectId, projects.id))
        .where(
          and(
            eq(boards.id, input.id),
            eq(projects.ownerId, context.user.id)
          )
        )
        .limit(1);
      
      if (board.length === 0) {
        throw new Error("Board not found or unauthorized");
      }
      
      const boardTasks = await db
        .select()
        .from(tasks)
        .where(eq(tasks.boardId, input.id))
        .orderBy(tasks.position, desc(tasks.priority), desc(tasks.createdAt));
      
      return {
        ...board[0].board,
        tasks: boardTasks
      };
    }),
  
  listTaskHooks: protectedProcedure
    .input(v.object({
      boardId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
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
      
      const boardTaskHooks = await db
        .select()
        .from(taskHooks)
        .where(eq(taskHooks.boardId, input.boardId));
      
      return boardTaskHooks;
    }),
  
  createTaskHook: protectedProcedure
    .input(v.object({
      boardId: v.pipe(v.string(), v.uuid()),
      trigger: v.picklist(["stage_change"]),
      fromStage: v.optional(v.string(), "*"),
      toStage: v.string(),
      action: v.picklist(["notify", "start_agent", "stop_agent", "create_checklist"]),
      payload: v.optional(v.record(v.string(), v.any()), {})
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership through project
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
      
      const newTaskHook = await db
        .insert(taskHooks)
        .values({
          boardId: input.boardId,
          trigger: input.trigger,
          fromStage: input.fromStage,
          toStage: input.toStage,
          action: input.action,
          payload: input.payload
        })
        .returning();
      
      return newTaskHook[0];
    })
});