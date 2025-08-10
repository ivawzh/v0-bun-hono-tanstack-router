import { orpc } from "../lib/orpc";
import { z } from "zod";
import { db } from "../db";
import { boards, projects, tasks, automations } from "../db/schema/core";
import { eq, and, desc } from "drizzle-orm";

export const boardsRouter = orpc.protectedRouter
  .route("list", {
    method: "GET",
    input: z.object({
      projectId: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
      // Verify project ownership
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.ownerId, ctx.user.id)
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
    }
  })
  .route("get", {
    method: "GET",
    input: z.object({
      id: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (board.length === 0) {
        throw new Error("Board not found or unauthorized");
      }
      
      return board[0].board;
    }
  })
  .route("create", {
    method: "POST",
    input: z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(255),
      purpose: z.string().optional()
    }),
    handler: async ({ ctx, input }) => {
      // Verify project ownership
      const project = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.ownerId, ctx.user.id)
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
      const defaultAutomations = [
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
      
      await db.insert(automations).values(defaultAutomations);
      
      return newBoard[0];
    }
  })
  .route("update", {
    method: "PUT",
    input: z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      purpose: z.string().optional()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
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
    }
  })
  .route("delete", {
    method: "DELETE",
    input: z.object({
      id: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (board.length === 0) {
        throw new Error("Board not found or unauthorized");
      }
      
      // Delete related data
      await db.delete(tasks).where(eq(tasks.boardId, input.id));
      await db.delete(automations).where(eq(automations.boardId, input.id));
      
      // Delete board
      await db.delete(boards).where(eq(boards.id, input.id));
      
      return { success: true };
    }
  })
  .route("getWithTasks", {
    method: "GET",
    input: z.object({
      id: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
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
        .orderBy(desc(tasks.priority), desc(tasks.createdAt));
      
      return {
        ...board[0].board,
        tasks: boardTasks
      };
    }
  })
  .route("listAutomations", {
    method: "GET",
    input: z.object({
      boardId: z.string().uuid()
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (board.length === 0) {
        throw new Error("Board not found or unauthorized");
      }
      
      const boardAutomations = await db
        .select()
        .from(automations)
        .where(eq(automations.boardId, input.boardId));
      
      return boardAutomations;
    }
  })
  .route("createAutomation", {
    method: "POST",
    input: z.object({
      boardId: z.string().uuid(),
      trigger: z.enum(["stage_change"]),
      fromStage: z.string().default("*"),
      toStage: z.string(),
      action: z.enum(["notify", "start_agent", "stop_agent", "create_checklist"]),
      payload: z.record(z.any()).default({})
    }),
    handler: async ({ ctx, input }) => {
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
            eq(projects.ownerId, ctx.user.id)
          )
        )
        .limit(1);
      
      if (board.length === 0) {
        throw new Error("Board not found or unauthorized");
      }
      
      const newAutomation = await db
        .insert(automations)
        .values({
          boardId: input.boardId,
          trigger: input.trigger,
          fromStage: input.fromStage,
          toStage: input.toStage,
          action: input.action,
          payload: input.payload
        })
        .returning();
      
      return newAutomation[0];
    }
  });