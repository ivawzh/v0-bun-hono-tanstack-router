import { o, protectedProcedure } from "../lib/orpc";
import * as v from "valibot";
import { z } from "zod";
import { db as mainDb } from "../db";
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

// Use test database when running tests, otherwise use main database
function getDb() {
  // Check various indicators that we're in a test environment
  const isTestEnvironment = 
    process.env.NODE_ENV === "test" || 
    process.env.BUN_TEST ||
    // Check if we're being called from a test file by examining the call stack
    (new Error().stack?.includes('.test.') || new Error().stack?.includes('bun:test')) ||
    // Check if the test setup module is available and has been initialized
    (global as any).__TEST_DB_ACTIVE;
  
  if (isTestEnvironment) {
    try {
      const { getTestDb } = require("../test/setup");
      return getTestDb();
    } catch {
      // Fallback to main db if test setup not available
      return mainDb;
    }
  }
  return mainDb;
}

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
      const db = getDb();
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
      const db = getDb();
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
      attachments: z.array(z.object({
        id: z.string().optional(),
        file: z.instanceof(File),
        preview: z.string().optional()
      })).optional().default([]),
      status: z.enum(["todo", "doing", "done", "loop"]).optional().default("todo"),
      stage: z.enum(["clarify", "plan", "execute", "loop"]).nullable().optional(),
      dependencyIds: z.array(z.string().uuid()).optional().default([])
    }))
    .handler(async ({ context, input }) => {
      console.log('Task creation with', input.attachments?.length || 0, 'attachments');
      // Verify project membership
      const db = getDb();
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
        for (const attachmentWrapper of input.attachments) {
          try {
            // Extract the actual File object from the wrapper
            const file = attachmentWrapper.file;
            
            if (!file || !(file instanceof File)) {
              console.warn('Skipping invalid attachment - not a File object:', attachmentWrapper);
              continue;
            }
            
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

      // Insert dependencies
      if (input.dependencyIds && input.dependencyIds.length > 0) {
        // Verify all dependency tasks exist and belong to the same project
        const dependencyTasks = await db
          .select()
          .from(tasks)
          .where(
            and(
              inArray(tasks.id, input.dependencyIds),
              eq(tasks.projectId, input.projectId)
            )
          );

        if (dependencyTasks.length !== input.dependencyIds.length) {
          throw new Error("Some dependency tasks not found or don't belong to project");
        }

        const dependencyInserts = input.dependencyIds.map(dependsOnTaskId => ({
          taskId,
          dependsOnTaskId
        }));

        await db.insert(taskDependencies).values(dependencyInserts);
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
      const db = getDb();
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
      const db = getDb();
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
      const db = getDb();
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
      const db = getDb();
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
      const db = getDb();
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


  deleteAttachment: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      attachmentId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();
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
      const db = getDb();
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
      const db = getDb();
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

  // oRPC upload procedure using native File support
  uploadAttachment: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      file: z.instanceof(File)
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();
      try {
        console.log('📎 oRPC attachment upload request received');
        console.log('📎 Upload details:', {
          taskId: input.taskId,
          fileName: input.file.name,
          fileSize: input.file.size,
          fileType: input.file.type
        });

        // Convert File to buffer
        const buffer = await input.file.arrayBuffer();

        // Verify task ownership with project membership
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
          throw new Error('Task not found or unauthorized');
        }

        const existingAttachments = (task[0].task.attachments as AttachmentMetadata[]) || [];

        // Validate total size
        await validateTotalAttachmentSize(input.taskId, input.file.size, existingAttachments);

        // Save attachment file
        console.log('💾 Saving attachment to filesystem...');
        const attachment = await saveAttachment(input.taskId, {
          buffer: new Uint8Array(buffer),
          originalName: input.file.name,
          type: input.file.type,
          size: input.file.size
        });
        console.log('💾 Attachment saved:', attachment);

        // Update task with new attachment
        const updatedAttachments = [...existingAttachments, attachment];

        console.log('🗄️ Updating database...');
        await db
          .update(tasks)
          .set({
            attachments: updatedAttachments,
            updatedAt: new Date()
          })
          .where(eq(tasks.id, input.taskId));

        // Broadcast flush to invalidate all queries for this project
        broadcastFlush(task[0].project.id);

        console.log('✅ Upload completed successfully');
        return {
          attachment,
          projectId: task[0].project.id
        };
      } catch (error) {
        console.error('Upload error:', error);
        throw error;
      }
    }),

  // New oRPC download procedure matching REST endpoint pattern
  downloadAttachment: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      attachmentId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();
      try {
        // Verify task ownership with project membership
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
          throw new Error('Task not found or unauthorized');
        }

        const attachments = (task[0].task.attachments as AttachmentMetadata[]) || [];
        const attachment = attachments.find(a => a.id === input.attachmentId);

        if (!attachment) {
          throw new Error('Attachment not found');
        }

        const buffer = await getAttachmentFile(input.taskId, input.attachmentId, attachments);

        return {
          buffer,
          metadata: attachment
        };
      } catch (error) {
        console.error('Download error:', error);
        throw new Error('File not found');
      }
    }),

  // Dependency management endpoints
  addDependency: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      dependsOnTaskId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();
      
      // Verify both tasks exist and belong to user's projects
      const [task, dependsOnTask] = await Promise.all([
        db
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
          .limit(1),
        db
          .select({
            task: tasks,
            project: projects
          })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
          .where(
            and(
              eq(tasks.id, input.dependsOnTaskId),
              eq(projectUsers.userId, context.user.id)
            )
          )
          .limit(1)
      ]);

      if (task.length === 0 || dependsOnTask.length === 0) {
        throw new Error("Task not found or unauthorized");
      }

      // Prevent self-dependency
      if (input.taskId === input.dependsOnTaskId) {
        throw new Error("Task cannot depend on itself");
      }

      // Check for circular dependencies using simple depth-first search
      async function hasCircularDependency(startTaskId: string, targetTaskId: string, visited = new Set<string>()): Promise<boolean> {
        if (visited.has(startTaskId)) {
          return true; // Found a cycle
        }
        
        if (startTaskId === targetTaskId) {
          return true; // Found the target, would create a cycle
        }

        visited.add(startTaskId);

        const dependencies = await db
          .select({ dependsOnTaskId: taskDependencies.dependsOnTaskId })
          .from(taskDependencies)
          .where(eq(taskDependencies.taskId, startTaskId));

        for (const dep of dependencies) {
          if (await hasCircularDependency(dep.dependsOnTaskId, targetTaskId, new Set(visited))) {
            return true;
          }
        }

        return false;
      }

      // Check if adding this dependency would create a circular dependency
      if (await hasCircularDependency(input.dependsOnTaskId, input.taskId)) {
        throw new Error("Adding this dependency would create a circular dependency");
      }

      // Check if dependency already exists
      const existingDep = await db
        .select()
        .from(taskDependencies)
        .where(
          and(
            eq(taskDependencies.taskId, input.taskId),
            eq(taskDependencies.dependsOnTaskId, input.dependsOnTaskId)
          )
        )
        .limit(1);

      if (existingDep.length > 0) {
        throw new Error("Dependency already exists");
      }

      // Add the dependency
      await db.insert(taskDependencies).values({
        taskId: input.taskId,
        dependsOnTaskId: input.dependsOnTaskId
      });

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return { success: true };
    }),

  removeDependency: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid()),
      dependsOnTaskId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();
      
      // Verify task exists and belongs to user's project
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

      // Remove the dependency
      await db
        .delete(taskDependencies)
        .where(
          and(
            eq(taskDependencies.taskId, input.taskId),
            eq(taskDependencies.dependsOnTaskId, input.dependsOnTaskId)
          )
        );

      // Broadcast flush to invalidate all queries for this project
      broadcastFlush(task[0].project.id);

      return { success: true };
    }),

  getDependencies: protectedProcedure
    .input(v.object({
      taskId: v.pipe(v.string(), v.uuid())
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();
      
      // Verify task exists and belongs to user's project
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

      // Get all dependencies and dependents
      const [dependencies, dependents] = await Promise.all([
        // Tasks this task depends on
        db
          .select({
            id: tasks.id,
            rawTitle: tasks.rawTitle,
            refinedTitle: tasks.refinedTitle,
            status: tasks.status,
            priority: tasks.priority
          })
          .from(taskDependencies)
          .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
          .where(eq(taskDependencies.taskId, input.taskId)),
        
        // Tasks that depend on this task
        db
          .select({
            id: tasks.id,
            rawTitle: tasks.rawTitle,
            refinedTitle: tasks.refinedTitle,
            status: tasks.status,
            priority: tasks.priority
          })
          .from(taskDependencies)
          .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
          .where(eq(taskDependencies.dependsOnTaskId, input.taskId))
      ]);

      return {
        dependencies,
        dependents
      };
    }),

  getAvailableDependencies: protectedProcedure
    .input(v.object({
      projectId: v.pipe(v.string(), v.uuid()),
      excludeTaskId: v.optional(v.pipe(v.string(), v.uuid()))
    }))
    .handler(async ({ context, input }) => {
      const db = getDb();
      
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

      // Get all tasks in the project except the excluded one and completed tasks
      let query = db
        .select({
          id: tasks.id,
          rawTitle: tasks.rawTitle,
          refinedTitle: tasks.refinedTitle,
          status: tasks.status,
          priority: tasks.priority
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.projectId, input.projectId),
            // Exclude done tasks as they can't be dependencies for new tasks
            sql`${tasks.status} != 'done'`
          )
        )
        .orderBy(desc(tasks.priority), tasks.rawTitle);

      if (input.excludeTaskId) {
        query = query.where(
          and(
            eq(tasks.projectId, input.projectId),
            sql`${tasks.status} != 'done'`,
            sql`${tasks.id} != ${input.excludeTaskId}`
          )
        );
      }

      const availableTasks = await query;

      return availableTasks;
    }),
});
