import { protectedProcedure } from "../lib/orpc";
import { z } from "zod";
import { db } from "../db";
import { boards, projects, tasks, automations } from "../db/schema/core";
import { eq, and, desc } from "drizzle-orm";

export const boardsRouter = {
  list: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid()
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
    .input(z.object({
      id: z.string().uuid()
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
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(255),
      purpose: z.string().optional()
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
    }),
  
  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(255).optional(),
      purpose: z.string().optional()
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
    .input(z.object({
      id: z.string().uuid()
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
      await db.delete(automations).where(eq(automations.boardId, input.id));
      
      // Delete board
      await db.delete(boards).where(eq(boards.id, input.id));
      
      return { success: true };
    }),
  
  getWithTasks: protectedProcedure
    .input(z.object({
      id: z.string().uuid()
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
        .orderBy(desc(tasks.priority), desc(tasks.createdAt));
      
      return {
        ...board[0].board,
        tasks: boardTasks
      };
    }),
  
  listAutomations: protectedProcedure
    .input(z.object({
      boardId: z.string().uuid()
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
      
      const boardAutomations = await db
        .select()
        .from(automations)
        .where(eq(automations.boardId, input.boardId));
      
      return boardAutomations;
    }),
  
  createAutomation: protectedProcedure
    .input(z.object({
      boardId: z.string().uuid(),
      trigger: z.enum(["stage_change"]),
      fromStage: z.string().default("*"),
      toStage: z.string(),
      action: z.enum(["notify", "start_agent", "stop_agent", "create_checklist"]),
      payload: z.record(z.any()).default({})
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
    })
};