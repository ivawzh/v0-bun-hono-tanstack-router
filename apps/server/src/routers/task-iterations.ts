import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import {
  tasks,
  projects,
  projectUsers,
  taskIterations,
} from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";

export const taskIterationsRouter = o.router({
  list: protectedProcedure
    .input(
      v.object({
        taskId: v.pipe(v.string(), v.uuid()),
      })
    )
    .handler(async ({ context, input }) => {
      // Verify task ownership through project membership
      const task = await db
        .select({
          task: tasks,
          project: projects,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.taskId),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      // Get all iterations for this task
      const iterations = await db
        .select()
        .from(taskIterations)
        .where(eq(taskIterations.taskId, input.taskId))
        .orderBy(desc(taskIterations.iterationNumber));

      return iterations;
    }),

  get: protectedProcedure
    .input(
      v.object({
        id: v.pipe(v.string(), v.uuid()),
      })
    )
    .handler(async ({ context, input }) => {
      // Get the iteration with task verification
      const result = await db
        .select({
          iteration: taskIterations,
          task: tasks,
          project: projects,
        })
        .from(taskIterations)
        .innerJoin(tasks, eq(taskIterations.taskId, tasks.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(taskIterations.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new Error("Task iteration not found or unauthorized");
      }

      return result[0].iteration;
    }),

  create: protectedProcedure
    .input(
      v.object({
        taskId: v.pipe(v.string(), v.uuid()),
        feedbackReason: v.pipe(v.string(), v.minLength(1)),
        rejectedBy: v.optional(
          v.union([v.literal("human"), v.literal("ai")])
        ),
      })
    )
    .handler(async ({ context, input }) => {
      // Verify task ownership through project membership
      const task = await db
        .select({
          task: tasks,
          project: projects,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.taskId),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      // Get current iteration count for this task
      const currentIterations = await db
        .select()
        .from(taskIterations)
        .where(eq(taskIterations.taskId, input.taskId));

      const iterationNumber = currentIterations.length + 1;

      // Create new iteration
      const newIteration = await db
        .insert(taskIterations)
        .values({
          taskId: input.taskId,
          iterationNumber,
          feedbackReason: input.feedbackReason,
          rejectedBy: input.rejectedBy || "human",
        })
        .returning();

      return newIteration[0];
    }),

  delete: protectedProcedure
    .input(
      v.object({
        id: v.pipe(v.string(), v.uuid()),
      })
    )
    .handler(async ({ context, input }) => {
      // Verify ownership through task and project membership
      const iteration = await db
        .select({
          iteration: taskIterations,
          task: tasks,
          project: projects,
        })
        .from(taskIterations)
        .innerJoin(tasks, eq(taskIterations.taskId, tasks.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(taskIterations.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (iteration.length === 0) {
        throw new Error("Task iteration not found or unauthorized");
      }

      // Delete the iteration
      await db.delete(taskIterations).where(eq(taskIterations.id, input.id));

      return { success: true };
    }),
});