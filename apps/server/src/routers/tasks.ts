import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { z } from "zod";
import { db } from "../db";
import { tasks, projects, repositories, agents, actors, taskDependencies, taskAgents, taskAdditionalRepositories, projectUsers } from "../db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { broadcastFlush } from "../websocket/websocket-server";
import {
  saveAttachment,
  deleteAttachment,
  getAttachmentFile,
  validateTotalAttachmentSize,
  type AttachmentMetadata
} from "../utils/file-storage";
import { randomUUID } from "crypto";

const taskStatusEnum = v.picklist(["todo", "doing", "done", "loop"]);
const taskStageEnum = v.nullable(v.picklist(["clarify", "plan", "execute", "loop"]));
const prioritySchema = v.pipe(v.number(), v.minValue(1), v.maxValue(5));

export const tasksRouter = o.router({
  list: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify project membership
      const membership = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.projectId, input.projectId),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (membership.length === 0) {
        throw new Error("Project not found or unauthorized");
      }

      const results = await db
        .select({
          task: tasks,
          mainRepository: repositories,
          actor: actors
        })
        .from(tasks)
        .leftJoin(repositories, eq(tasks.mainRepositoryId, repositories.id))
        .leftJoin(actors, eq(tasks.actorId, actors.id))
        .where(eq(tasks.projectId, input.projectId))
        .orderBy(
          tasks.status,
          desc(tasks.priority), // Higher numbers = higher priority (5 > 4 > 3 > 2 > 1)
          sql`CAST(${tasks.columnOrder} AS DECIMAL)`,
          desc(tasks.createdAt)
        );

      // Fetch dependencies for all tasks in the project
      const allTaskIds = results.map(r => r.task.id);
      const dependencies = await db
        .select({
          taskId: taskDependencies.taskId,
          dependsOnTaskId: taskDependencies.dependsOnTaskId,
          dependsOnTask: {
            id: tasks.id,
            rawTitle: tasks.rawTitle,
            refinedTitle: tasks.refinedTitle,
            status: tasks.status
          }
        })
        .from(taskDependencies)
        .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
        .where(inArray(taskDependencies.taskId, allTaskIds));

      // Group dependencies by task ID
      const dependenciesByTask = dependencies.reduce((acc, dep) => {
        if (!acc[dep.taskId]) {
          acc[dep.taskId] = [];
        }
        acc[dep.taskId].push(dep.dependsOnTask);
        return acc;
      }, {} as Record<string, any[]>);

      return results.map(r => ({
        ...r.task,
        mainRepository: r.mainRepository,
        actor: r.actor,
        dependencies: dependenciesByTask[r.task.id] || []
      }));
    }),

  get: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const result = await db
        .select({
          task: tasks,
          project: projects,
          mainRepository: repositories,
          actor: actors
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .leftJoin(repositories, eq(tasks.mainRepositoryId, repositories.id))
        .leftJoin(actors, eq(tasks.actorId, actors.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (result.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      const taskId = result[0].task.id;

      // Fetch additional repositories
      const additionalRepos = await db
        .select({ repository: repositories })
        .from(taskAdditionalRepositories)
        .innerJoin(repositories, eq(taskAdditionalRepositories.repositoryId, repositories.id))
        .where(eq(taskAdditionalRepositories.taskId, taskId));

      // Fetch assigned agents
      const assignedAgentsData = await db
        .select({ agent: agents })
        .from(taskAgents)
        .innerJoin(agents, eq(taskAgents.agentId, agents.id))
        .where(eq(taskAgents.taskId, taskId));

      return {
        ...result[0].task,
        project: result[0].project,
        mainRepository: result[0].mainRepository,
        actor: result[0].actor,
        additionalRepositories: additionalRepos.map(r => r.repository),
        additionalRepositoryIds: additionalRepos.map(r => r.repository.id),
        assignedAgents: assignedAgentsData.map(a => a.agent),
        assignedAgentIds: assignedAgentsData.map(a => a.agent.id)
      };
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      mainRepositoryId: z.string().uuid(),
      additionalRepositoryIds: z.array(z.string().uuid()).optional().default([]),
      assignedAgentIds: z.array(z.string().uuid()).optional().default([]),
      actorId: z.string().uuid().optional(),
      rawTitle: z.string().min(1).max(255),
      rawDescription: z.string().optional(),
      priority: z.number().min(1).max(5).optional().default(3),
      attachments: z.array(z.instanceof(File)).optional().default([]),
      status: z.enum(["todo", "doing", "done", "loop"]).optional().default("todo"),
      stage: z.enum(["clarify", "plan", "execute", "loop"]).nullable().optional()
    }))
    .handler(async ({ context, input }) => {
      // Verify project membership
      const membership = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.projectId, input.projectId),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (membership.length === 0) {
        throw new Error("Project not found or unauthorized");
      }

      // Verify main repository belongs to project
      const mainRepo = await db
        .select()
        .from(repositories)
        .where(
          and(
            eq(repositories.id, input.mainRepositoryId),
            eq(repositories.projectId, input.projectId)
          )
        )
        .limit(1);

      if (mainRepo.length === 0) {
        throw new Error("Main repository not found or doesn't belong to project");
      }

      // Verify additional repositories belong to project (if provided)
      if (input.additionalRepositoryIds && input.additionalRepositoryIds.length > 0) {
        const additionalRepos = await db
          .select()
          .from(repositories)
          .where(
            and(
              inArray(repositories.id, input.additionalRepositoryIds),
              eq(repositories.projectId, input.projectId)
            )
          );

        if (additionalRepos.length !== input.additionalRepositoryIds.length) {
          throw new Error("Some additional repositories not found or don't belong to project");
        }
      }

      // Verify assigned agents belong to project (if provided)
      if (input.assignedAgentIds && input.assignedAgentIds.length > 0) {
        const assignedAgents = await db
          .select()
          .from(agents)
          .where(
            and(
              inArray(agents.id, input.assignedAgentIds),
              eq(agents.projectId, input.projectId)
            )
          );

        if (assignedAgents.length !== input.assignedAgentIds.length) {
          throw new Error("Some assigned agents not found or don't belong to project");
        }
      }

      // Verify actor belongs to project (if provided)
      if (input.actorId) {
        const actor = await db
          .select()
          .from(actors)
          .where(
            and(
              eq(actors.id, input.actorId),
              eq(actors.projectId, input.projectId)
            )
          )
          .limit(1);

        if (actor.length === 0) {
          throw new Error("Actor not found or doesn't belong to project");
        }
      }

      // Determine the stage value to use
      let stageToUse = input.stage;
      if (stageToUse === undefined) {
        // Apply intelligent defaults if no stage provided
        if (input.status === "loop") {
          stageToUse = "loop";
        } else {
          stageToUse = "clarify"; // Default for non-loop tasks
        }
      }

      // Create task first without attachments
      const newTask = await db
        .insert(tasks)
        .values({
          projectId: input.projectId,
          mainRepositoryId: input.mainRepositoryId,
          actorId: input.actorId,
          rawTitle: input.rawTitle,
          rawDescription: input.rawDescription,
          priority: input.priority,
          attachments: [], // Start empty, will be populated after processing files
          status: input.status,
          stage: stageToUse,
          ready: input.status === "loop" ? true : false // Loop tasks are always ready
        })
        .returning();

      const taskId = newTask[0].id;

      // Process file attachments after task creation so we have the real task ID
      let processedAttachments: AttachmentMetadata[] = [];
      
      if (input.attachments && input.attachments.length > 0) {
        for (const file of input.attachments) {
          try {
            // Convert File to buffer for processing
            const buffer = new Uint8Array(await file.arrayBuffer());
            
            // Validate total size before processing
            await validateTotalAttachmentSize(taskId, file.size, processedAttachments);
            
            // Save the attachment using the actual task ID
            const attachment = await saveAttachment(taskId, {
              buffer: buffer,
              originalName: file.name,
              type: file.type,
              size: file.size
            });
            
            processedAttachments.push(attachment);
          } catch (error) {
            console.error('Failed to process file attachment during task creation:', error);
            // Continue with other attachments
          }
        }

        // Update task with processed attachments
        if (processedAttachments.length > 0) {
          await db
            .update(tasks)
            .set({
              attachments: processedAttachments,
              updatedAt: new Date()
            })
            .where(eq(tasks.id, taskId));
        }
      }

      // Insert additional repositories
      if (input.additionalRepositoryIds && input.additionalRepositoryIds.length > 0) {
        const additionalRepoInserts = input.additionalRepositoryIds.map(repoId => ({
          taskId,
          repositoryId: repoId
        }));

        await db.insert(taskAdditionalRepositories).values(additionalRepoInserts);
      }

      // Insert assigned agents
      if (input.assignedAgentIds && input.assignedAgentIds.length > 0) {
        const agentInserts = input.assignedAgentIds.map(agentId => ({
          taskId,
          agentId
        }));

        await db.insert(taskAgents).values(agentInserts);
      }

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(input.projectId);

      // Return the task with updated attachments
      return {
        ...newTask[0],
        attachments: processedAttachments
      };
    }),

  update: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      rawTitle: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(255))),
      rawDescription: v.optional(v.string()),
      refinedTitle: v.optional(v.string()),
      refinedDescription: v.optional(v.string()),
      plan: v.optional(v.any()),
      status: v.optional(taskStatusEnum),
      stage: v.optional(taskStageEnum),
      priority: v.optional(prioritySchema),
      ready: v.optional(v.boolean()),
      attachments: v.optional(v.array(v.any())),
      columnOrder: v.optional(v.string()),
      // V2 fields
      mainRepositoryId: v.optional(v.pipe(v.string(), v.uuid())),
      additionalRepositoryIds: v.optional(v.array(v.pipe(v.string(), v.uuid()))),
      assignedAgentIds: v.optional(v.array(v.pipe(v.string(), v.uuid()))),
      actorId: v.optional(v.pipe(v.string(), v.uuid()))
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      const updates: any = { updatedAt: new Date() };

      if (input.rawTitle !== undefined) updates.rawTitle = input.rawTitle;
      if (input.rawDescription !== undefined) updates.rawDescription = input.rawDescription;
      if (input.refinedTitle !== undefined) updates.refinedTitle = input.refinedTitle;
      if (input.refinedDescription !== undefined) updates.refinedDescription = input.refinedDescription;
      if (input.plan !== undefined) updates.plan = input.plan;
      if (input.status !== undefined) updates.status = input.status;
      if (input.stage !== undefined) updates.stage = input.stage;
      if (input.priority !== undefined) updates.priority = input.priority;
      if (input.ready !== undefined) updates.ready = input.ready;
      if (input.attachments !== undefined) updates.attachments = input.attachments;
      if (input.columnOrder !== undefined) updates.columnOrder = input.columnOrder;

      // V2 fields
      if (input.mainRepositoryId !== undefined) updates.mainRepositoryId = input.mainRepositoryId;
      if (input.actorId !== undefined) updates.actorId = input.actorId;

      const updated = await db
        .update(tasks)
        .set(updates)
        .where(eq(tasks.id, input.id))
        .returning();

      const updatedTask = updated[0];

      // Handle additional repositories update
      if (input.additionalRepositoryIds !== undefined) {
        // Delete existing additional repositories
        await db
          .delete(taskAdditionalRepositories)
          .where(eq(taskAdditionalRepositories.taskId, input.id));

        // Insert new additional repositories
        if (input.additionalRepositoryIds.length > 0) {
          const additionalRepoInserts = input.additionalRepositoryIds.map(repoId => ({
            taskId: input.id,
            repositoryId: repoId
          }));
          await db.insert(taskAdditionalRepositories).values(additionalRepoInserts);
        }
      }

      // Handle assigned agents update
      if (input.assignedAgentIds !== undefined) {
        // Delete existing agent assignments
        await db
          .delete(taskAgents)
          .where(eq(taskAgents.taskId, input.id));

        // Insert new agent assignments
        if (input.assignedAgentIds.length > 0) {
          const agentInserts = input.assignedAgentIds.map(agentId => ({
            taskId: input.id,
            agentId
          }));
          await db.insert(taskAgents).values(agentInserts);
        }
      }

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return updatedTask;
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
          project: projects
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      // Delete task (no cascading needed in simplified model)
      await db.delete(tasks).where(eq(tasks.id, input.id));

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return { success: true };
    }),

  toggleReady: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      ready: v.boolean()
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      const updated = await db
        .update(tasks)
        .set({
          ready: input.ready,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, input.id))
        .returning();

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return updated[0];
    }),

  updateOrder: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      tasks: v.array(v.object({
        id: v.pipe(v.string(), v.uuid()),
        columnOrder: v.string(),
        status: v.optional(taskStatusEnum) // Allow moving between columns
      }))
    }))
    .handler(async ({ context, input }) => {
      // Verify project membership
      const membership = await db
        .select()
        .from(projectUsers)
        .where(
          and(
            eq(projectUsers.projectId, input.projectId),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (membership.length === 0) {
        throw new Error("Project not found or unauthorized");
      }

      // Update all tasks in a transaction
      const updatedTasks = [];

      for (const taskUpdate of input.tasks) {
        // Verify task belongs to project and user
        const task = await db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.id, taskUpdate.id),
              eq(tasks.projectId, input.projectId)
            )
          )
          .limit(1);

        if (task.length === 0) {
          throw new Error(`Task ${taskUpdate.id} not found or unauthorized`);
        }

        const updates: any = {
          columnOrder: taskUpdate.columnOrder,
          updatedAt: new Date()
        };

        if (taskUpdate.status !== undefined) {
          updates.status = taskUpdate.status;
          // Handle stage transitions for different statuses
          if (taskUpdate.status === 'todo' || taskUpdate.status === 'done') {
            updates.stage = null;
          } else if (taskUpdate.status === 'loop') {
            updates.stage = 'loop'; // Loop tasks always have loop stage
          }
        }

        const updated = await db
          .update(tasks)
          .set(updates)
          .where(eq(tasks.id, taskUpdate.id))
          .returning();

        updatedTasks.push(updated[0]);
      }

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(input.projectId);

      return { success: true, updated: updatedTasks };
    }),

  updateStage: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid()),
      stage: taskStageEnum
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      const updated = await db
        .update(tasks)
        .set({
          stage: input.stage,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, input.id))
        .returning();

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return updated[0];
    }),

  uploadAttachment: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      file: v.object({
        buffer: v.any(), // Buffer or Uint8Array
        originalName: v.string(),
        type: v.string(),
        size: v.number()
      })
    }))
    .handler(async ({ context, input }) => {
      try {
        // Verify task ownership
        const task = await db
          .select({
            task: tasks,
            project: projects
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

        const existingAttachments = (task[0].task.attachments as AttachmentMetadata[]) || [];

        // Validate total size
        await validateTotalAttachmentSize(input.taskId, input.file.size, existingAttachments);

        // Save attachment file
        const attachment = await saveAttachment(input.taskId, input.file);

        // Update task with new attachment
        const updatedAttachments = [...existingAttachments, attachment];

        const updated = await db
          .update(tasks)
          .set({
            attachments: updatedAttachments,
            updatedAt: new Date()
          })
          .where(eq(tasks.id, input.taskId))
          .returning();

        // Broadcast flush to invalidate all queries for this project
        broadcastFlush(task[0].project.id);

        return attachment;
      } catch (error) {
        console.error('Upload attachment error:', error);
        throw error;
      }
    }),

  deleteAttachment: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      attachmentId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify task ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
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

      const attachments = (task[0].task.attachments as AttachmentMetadata[]) || [];

      // Delete the file
      await deleteAttachment(input.taskId, input.attachmentId, attachments);

      // Remove from task attachments
      const updatedAttachments = attachments.filter(a => a.id !== input.attachmentId);

      await db
        .update(tasks)
        .set({
          attachments: updatedAttachments,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, input.taskId));

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return { success: true };
    }),

  getAttachment: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      attachmentId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify task ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
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

      const attachments = (task[0].task.attachments as AttachmentMetadata[]) || [];
      const attachment = attachments.find(a => a.id === input.attachmentId);

      if (!attachment) {
        throw new Error("Attachment not found");
      }

      const buffer = await getAttachmentFile(input.taskId, input.attachmentId, attachments);

      return {
        buffer,
        metadata: attachment
      };
    }),

  resetAgent: protectedProcedure
    .input(v.object({
      id: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      // Verify ownership
      const task = await db
        .select({
          task: tasks,
          project: projects
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
        .where(
          and(
            eq(tasks.id, input.id),
            eq(projectUsers.userId, context.user.id)
          )
        )
        .limit(1);

      if (task.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      // Reset agent session status
      const updated = await db
        .update(tasks)
        .set({
          agentSessionStatus: 'NON_ACTIVE',
          activeAgentId: null,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, input.id))
        .returning();

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return updated[0];
    }),
});
