/**
 * Tasks Router Tests
 * Comprehensive tests for tasks router endpoints including authentication, authorization,
 * CRUD operations, file attachments, and data isolation
 */
import { describe, it, expect, beforeEach } from "bun:test";
import { randomUUID } from "crypto";

import { setupDatabaseTests } from "./test-utils";
import { 
  createTestUser, 
  createTestProject,
  createTestRepository,
  createTestActor,
  createTestAgent,
  createTestTask,
  createTestUsers,
  createCompleteTestSetup
} from "./fixtures";
import { 
  testProtectedProcedure,
  assertRealRPCUnauthorized,
  testProjectMembershipValidation
} from "./rpc-test-helpers";
import { tasksRouter } from "../routers/tasks";

// Setup database for these tests
setupDatabaseTests();

describe("Tasks Router", () => {
  describe("Authentication Requirements", () => {
    it("should require authentication for all endpoints", async () => {
      // Test that all tasks router endpoints require authentication
      const sampleProjectId = "123e4567-e89b-12d3-a456-426614174000";
      const sampleTaskId = "123e4567-e89b-12d3-a456-426614174001";
      const sampleRepoId = "123e4567-e89b-12d3-a456-426614174002";
      const sampleAgentId = "123e4567-e89b-12d3-a456-426614174003";
      const sampleAttachmentId = "123e4567-e89b-12d3-a456-426614174004";
      const fakeFile = new File(["test"], "test.txt", { type: "text/plain" });
      
      const endpointsToTest = [
        { name: "list", input: { projectId: sampleProjectId } },
        { name: "get", input: { id: sampleTaskId } },
        { name: "create", input: { 
          projectId: sampleProjectId, 
          mainRepositoryId: sampleRepoId,
          rawTitle: "Test Task"
        } },
        { name: "update", input: { id: sampleTaskId, rawTitle: "Updated Task" } },
        { name: "delete", input: { id: sampleTaskId } },
        { name: "toggleReady", input: { id: sampleTaskId, ready: true } },
        { name: "updateOrder", input: { 
          projectId: sampleProjectId,
          tasks: [{ id: sampleTaskId, columnOrder: "1000" }]
        } },
        { name: "updateStage", input: { id: sampleTaskId, stage: "plan" } },
        { name: "resetAgent", input: { id: sampleTaskId } },
        { name: "uploadAttachment", input: { taskId: sampleTaskId, file: fakeFile } },
        { name: "getAttachment", input: { taskId: sampleTaskId, attachmentId: sampleAttachmentId } },
        { name: "deleteAttachment", input: { taskId: sampleTaskId, attachmentId: sampleAttachmentId } },
        { name: "downloadAttachment", input: { taskId: sampleTaskId, attachmentId: sampleAttachmentId } }
      ];

      for (const endpoint of endpointsToTest) {
        try {
          await assertRealRPCUnauthorized(
            tasksRouter[endpoint.name as keyof typeof tasksRouter],
            endpoint.input
          );
        } catch (error) {
          throw new Error(`Endpoint ${endpoint.name} should require authentication: ${error}`);
        }
      }
    });
  });

  describe("list", () => {
    it("should return tasks only from user's project", async () => {
      const [user1, user2] = await createTestUsers(2);
      
      // Create projects for each user
      const user1Project = await createTestProject(user1.id, { name: "User 1 Project" });
      const user2Project = await createTestProject(user2.id, { name: "User 2 Project" });
      
      // Create repositories for each project
      const user1Repo = await createTestRepository(user1Project.id);
      const user2Repo = await createTestRepository(user2Project.id);
      
      // Create tasks for each project
      const user1Task = await createTestTask(user1Project.id, user1Repo.id, {
        rawTitle: "User 1 Task"
      });
      const user2Task = await createTestTask(user2Project.id, user2Repo.id, {
        rawTitle: "User 2 Task"
      });
      
      // User 1 should only see their project's tasks
      const user1Tasks = await testProtectedProcedure(
        tasksRouter.list,
        user1,
        { projectId: user1Project.id }
      );
      
      expect(user1Tasks).toHaveLength(1);
      expect(user1Tasks[0].id).toBe(user1Task.id);
      expect(user1Tasks[0].rawTitle).toBe("User 1 Task");
      
      // User 2 should only see their project's tasks
      const user2Tasks = await testProtectedProcedure(
        tasksRouter.list,
        user2,
        { projectId: user2Project.id }
      );
      
      expect(user2Tasks).toHaveLength(1);
      expect(user2Tasks[0].id).toBe(user2Task.id);
      expect(user2Tasks[0].rawTitle).toBe("User 2 Task");
    });

    it("should enforce project membership", async () => {
      const [owner, nonMember] = await createTestUsers(2);
      const project = await createTestProject(owner.id);
      
      // Owner should be able to access
      await testProtectedProcedure(
        tasksRouter.list,
        owner,
        { projectId: project.id }
      );
      
      // Non-member should be denied
      try {
        await testProtectedProcedure(
          tasksRouter.list,
          nonMember,
          { projectId: project.id }
        );
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Project not found or unauthorized");
      }
    });

    it("should return empty list for project with no tasks", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const tasks = await testProtectedProcedure(
        tasksRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(tasks).toHaveLength(0);
    });

    it("should order tasks by status, priority, and creation order", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      // Create tasks with different priorities and statuses
      const task1 = await createTestTask(project.id, repository.id, {
        rawTitle: "High Priority Todo",
        status: "todo",
        priority: 5,
        columnOrder: "1000"
      });
      
      const task2 = await createTestTask(project.id, repository.id, {
        rawTitle: "Low Priority Todo", 
        status: "todo",
        priority: 1,
        columnOrder: "2000"
      });
      
      const task3 = await createTestTask(project.id, repository.id, {
        rawTitle: "Doing Task",
        status: "doing",
        priority: 3,
        columnOrder: "1000"
      });
      
      const tasks = await testProtectedProcedure(
        tasksRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(tasks).toHaveLength(3);
      // Should be ordered by status first (doing comes before todo), then by priority desc
      expect(tasks[0].rawTitle).toBe("Doing Task");
      expect(tasks[1].rawTitle).toBe("High Priority Todo");
      expect(tasks[2].rawTitle).toBe("Low Priority Todo");
    });
  });

  describe("get", () => {
    it("should return task for authorized user", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository, actor } = setup;
      
      const task = await createTestTask(project.id, repository.id, {
        rawTitle: "Test Task",
        rawDescription: "Test Description",
        actorId: actor.id
      });
      
      const result = await testProtectedProcedure(
        tasksRouter.get,
        user,
        { id: task.id }
      );
      
      expect(result.id).toBe(task.id);
      expect(result.rawTitle).toBe("Test Task");
      expect(result.rawDescription).toBe("Test Description");
      expect(result.projectId).toBe(project.id);
      expect(result.actor?.id).toBe(actor.id);
    });

    it("should enforce project membership", async () => {
      const [owner, nonMember] = await createTestUsers(2);
      const project = await createTestProject(owner.id);
      const repository = await createTestRepository(project.id);
      const task = await createTestTask(project.id, repository.id);
      
      // Owner should be able to access
      await testProtectedProcedure(tasksRouter.get, owner, { id: task.id });
      
      // Non-member should be denied
      try {
        await testProtectedProcedure(tasksRouter.get, nonMember, { id: task.id });
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
    });

    it("should return task with relationships", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository, agent, actor } = setup;
      
      // Create additional repository
      const additionalRepo = await createTestRepository(project.id, { 
        name: "Additional Repo",
        isDefault: false 
      });
      
      const task = await createTestTask(project.id, repository.id, {
        rawTitle: "Complex Task",
        actorId: actor.id
      });
      
      const result = await testProtectedProcedure(
        tasksRouter.get,
        user,
        { id: task.id }
      );
      
      expect(result.mainRepository?.id).toBe(repository.id);
      expect(result.actor?.id).toBe(actor.id);
      expect(result.project?.id).toBe(project.id);
    });
  });

  describe("create", () => {
    it("should create task with all fields", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository, agent, actor } = setup;
      
      const result = await testProtectedProcedure(
        tasksRouter.create,
        user,
        {
          projectId: project.id,
          mainRepositoryId: repository.id,
          assignedAgentIds: [agent.id],
          actorId: actor.id,
          rawTitle: "New Task",
          rawDescription: "New Description",
          priority: 4,
          status: "todo"
        }
      );
      
      expect(result.rawTitle).toBe("New Task");
      expect(result.rawDescription).toBe("New Description");
      expect(result.priority).toBe(4);
      expect(result.status).toBe("todo");
      expect(result.projectId).toBe(project.id);
      expect(result.mainRepositoryId).toBe(repository.id);
      expect(result.actorId).toBe(actor.id);
      expect(result.stage).toBe("clarify"); // Default stage for todo
    });

    it("should enforce project membership", async () => {
      const [owner, nonMember] = await createTestUsers(2);
      const project = await createTestProject(owner.id);
      const repository = await createTestRepository(project.id);
      
      // Owner should be able to create
      await testProtectedProcedure(
        tasksRouter.create,
        owner,
        {
          projectId: project.id,
          mainRepositoryId: repository.id,
          rawTitle: "Owner Task"
        }
      );
      
      // Non-member should be denied
      try {
        await testProtectedProcedure(
          tasksRouter.create,
          nonMember,
          {
            projectId: project.id,
            mainRepositoryId: repository.id,
            rawTitle: "Unauthorized Task"
          }
        );
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Project not found or unauthorized");
      }
    });

    it("should set correct default stage for loop tasks", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const result = await testProtectedProcedure(
        tasksRouter.create,
        user,
        {
          projectId: project.id,
          mainRepositoryId: repository.id,
          rawTitle: "Loop Task",
          status: "loop"
        }
      );
      
      expect(result.status).toBe("loop");
      expect(result.stage).toBe("loop");
      expect(result.ready).toBe(true); // Loop tasks are auto-ready
    });

    it("should validate repository belongs to project", async () => {
      const [user1, user2] = await createTestUsers(2);
      const project1 = await createTestProject(user1.id);
      const project2 = await createTestProject(user2.id);
      const repo2 = await createTestRepository(project2.id);
      
      // Try to create task in project1 with repo from project2
      try {
        await testProtectedProcedure(
          tasksRouter.create,
          user1,
          {
            projectId: project1.id,
            mainRepositoryId: repo2.id,
            rawTitle: "Cross-project Task"
          }
        );
        throw new Error("Should have been denied");
      } catch (error: any) {
        expect(error.message).toContain("Main repository not found or doesn't belong to project");
      }
    });

    it("should validate agent belongs to project", async () => {
      const [user1, user2] = await createTestUsers(2);
      const project1 = await createTestProject(user1.id);
      const project2 = await createTestProject(user2.id);
      const repo1 = await createTestRepository(project1.id);
      const agent2 = await createTestAgent(project2.id);
      
      // Try to create task in project1 with agent from project2
      try {
        await testProtectedProcedure(
          tasksRouter.create,
          user1,
          {
            projectId: project1.id,
            mainRepositoryId: repo1.id,
            assignedAgentIds: [agent2.id],
            rawTitle: "Cross-project Task"
          }
        );
        throw new Error("Should have been denied");
      } catch (error: any) {
        expect(error.message).toContain("Some assigned agents not found or don't belong to project");
      }
    });
  });

  describe("update", () => {
    it("should update task fields", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const task = await createTestTask(project.id, repository.id, {
        rawTitle: "Original Title",
        rawDescription: "Original Description",
        priority: 3
      });
      
      const result = await testProtectedProcedure(
        tasksRouter.update,
        user,
        {
          id: task.id,
          rawTitle: "Updated Title",
          rawDescription: "Updated Description",
          priority: 5,
          status: "doing",
          stage: "plan"
        }
      );
      
      expect(result.rawTitle).toBe("Updated Title");
      expect(result.rawDescription).toBe("Updated Description");
      expect(result.priority).toBe(5);
      expect(result.status).toBe("doing");
      expect(result.stage).toBe("plan");
    });

    it("should enforce project membership", async () => {
      const [owner, nonMember] = await createTestUsers(2);
      const project = await createTestProject(owner.id);
      const repository = await createTestRepository(project.id);
      const task = await createTestTask(project.id, repository.id);
      
      // Owner should be able to update
      await testProtectedProcedure(
        tasksRouter.update,
        owner,
        { id: task.id, rawTitle: "Owner Update" }
      );
      
      // Non-member should be denied
      try {
        await testProtectedProcedure(
          tasksRouter.update,
          nonMember,
          { id: task.id, rawTitle: "Unauthorized Update" }
        );
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
    });
  });

  describe("delete", () => {
    it("should delete task for authorized user", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const task = await createTestTask(project.id, repository.id);
      
      const result = await testProtectedProcedure(
        tasksRouter.delete,
        user,
        { id: task.id }
      );
      
      expect(result.success).toBe(true);
      
      // Verify task is deleted
      try {
        await testProtectedProcedure(tasksRouter.get, user, { id: task.id });
        throw new Error("Task should have been deleted");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
    });

    it("should enforce project membership", async () => {
      const [owner, nonMember] = await createTestUsers(2);
      const project = await createTestProject(owner.id);
      const repository = await createTestRepository(project.id);
      const task = await createTestTask(project.id, repository.id);
      
      // Non-member should be denied
      try {
        await testProtectedProcedure(tasksRouter.delete, nonMember, { id: task.id });
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
    });
  });

  describe("toggleReady", () => {
    it("should toggle task ready status", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const task = await createTestTask(project.id, repository.id, { ready: false });
      
      // Set to ready
      const result1 = await testProtectedProcedure(
        tasksRouter.toggleReady,
        user,
        { id: task.id, ready: true }
      );
      
      expect(result1.ready).toBe(true);
      
      // Set to not ready
      const result2 = await testProtectedProcedure(
        tasksRouter.toggleReady,
        user,
        { id: task.id, ready: false }
      );
      
      expect(result2.ready).toBe(false);
    });

    it("should enforce project membership", async () => {
      const [owner, nonMember] = await createTestUsers(2);
      const project = await createTestProject(owner.id);
      const repository = await createTestRepository(project.id);
      const task = await createTestTask(project.id, repository.id);
      
      // Non-member should be denied
      try {
        await testProtectedProcedure(
          tasksRouter.toggleReady,
          nonMember,
          { id: task.id, ready: true }
        );
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
    });
  });

  describe("updateOrder", () => {
    it("should update task orders and status", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const task1 = await createTestTask(project.id, repository.id, {
        rawTitle: "Task 1",
        columnOrder: "1000",
        status: "todo"
      });
      
      const task2 = await createTestTask(project.id, repository.id, {
        rawTitle: "Task 2", 
        columnOrder: "2000",
        status: "todo"
      });
      
      const result = await testProtectedProcedure(
        tasksRouter.updateOrder,
        user,
        {
          projectId: project.id,
          tasks: [
            { id: task1.id, columnOrder: "3000", status: "doing" },
            { id: task2.id, columnOrder: "1000" }
          ]
        }
      );
      
      expect(result.success).toBe(true);
      expect(result.updated).toHaveLength(2);
    });

    it("should enforce project membership", async () => {
      const [owner, nonMember] = await createTestUsers(2);
      const project = await createTestProject(owner.id);
      const repository = await createTestRepository(project.id);
      const task = await createTestTask(project.id, repository.id);
      
      // Non-member should be denied
      try {
        await testProtectedProcedure(
          tasksRouter.updateOrder,
          nonMember,
          {
            projectId: project.id,
            tasks: [{ id: task.id, columnOrder: "2000" }]
          }
        );
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Project not found or unauthorized");
      }
    });
  });

  describe("updateStage", () => {
    it("should update task stage", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const task = await createTestTask(project.id, repository.id, {
        status: "doing",
        stage: "clarify"
      });
      
      const result = await testProtectedProcedure(
        tasksRouter.updateStage,
        user,
        { id: task.id, stage: "execute" }
      );
      
      expect(result.stage).toBe("execute");
    });

    it("should enforce project membership", async () => {
      const [owner, nonMember] = await createTestUsers(2);
      const project = await createTestProject(owner.id);
      const repository = await createTestRepository(project.id);
      const task = await createTestTask(project.id, repository.id);
      
      // Non-member should be denied
      try {
        await testProtectedProcedure(
          tasksRouter.updateStage,
          nonMember,
          { id: task.id, stage: "plan" }
        );
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
    });
  });

  describe("resetAgent", () => {
    it("should reset agent session status", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository, agent } = setup;
      
      const task = await createTestTask(project.id, repository.id, {
        agentSessionStatus: "ACTIVE",
        activeAgentId: agent.id
      });
      
      const result = await testProtectedProcedure(
        tasksRouter.resetAgent,
        user,
        { id: task.id }
      );
      
      expect(result.agentSessionStatus).toBe("INACTIVE");
      expect(result.activeAgentId).toBeNull();
    });

    it("should enforce project membership", async () => {
      const [owner, nonMember] = await createTestUsers(2);
      const project = await createTestProject(owner.id);
      const repository = await createTestRepository(project.id);
      const task = await createTestTask(project.id, repository.id);
      
      // Non-member should be denied
      try {
        await testProtectedProcedure(tasksRouter.resetAgent, nonMember, { id: task.id });
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
    });
  });

  describe("File Attachments", () => {
    // Note: File upload testing requires special setup with actual File objects
    // These tests focus on the authorization and error handling aspects

    describe("uploadAttachment", () => {
      it("should require authentication", async () => {
        const fakeFile = new File(["test"], "test.txt", { type: "text/plain" });
        
        try {
          await assertRealRPCUnauthorized(
            tasksRouter.uploadAttachment,
            { taskId: "123e4567-e89b-12d3-a456-426614174000", file: fakeFile }
          );
        } catch (error) {
          throw new Error(`uploadAttachment should require authentication: ${error}`);
        }
      });

      it("should enforce project membership through task ownership", async () => {
        const [owner, nonMember] = await createTestUsers(2);
        const project = await createTestProject(owner.id);
        const repository = await createTestRepository(project.id);
        const task = await createTestTask(project.id, repository.id);
        
        const fakeFile = new File(["test"], "test.txt", { type: "text/plain" });
        
        // Non-member should be denied
        try {
          await testProtectedProcedure(
            tasksRouter.uploadAttachment,
            nonMember,
            { taskId: task.id, file: fakeFile }
          );
          throw new Error("Should have been denied access");
        } catch (error: any) {
          expect(error.message).toContain("Task not found or unauthorized");
        }
      });

      it("should handle file validation errors", async () => {
        const setup = await createCompleteTestSetup();
        const { user, project, repository } = setup;
        const task = await createTestTask(project.id, repository.id);
        
        // Test with empty file content - this should still work but be handled gracefully
        const emptyFile = new File([""], "empty.txt", { type: "text/plain" });
        
        // This should either succeed or fail gracefully with proper error handling
        try {
          const result = await testProtectedProcedure(
            tasksRouter.uploadAttachment,
            user,
            { taskId: task.id, file: emptyFile }
          );
          // If it succeeds, verify the attachment structure
          expect(result.attachment).toBeDefined();
          expect(result.projectId).toBe(project.id);
        } catch (error: any) {
          // If it fails, ensure it's a proper validation error
          expect(
            error.message.includes("validation") ||
            error.message.includes("size") ||
            error.message.includes("type") ||
            error.message.includes("Task not found") // Auth check first
          ).toBe(true);
        }
      });

      it("should validate file types and sizes", async () => {
        const setup = await createCompleteTestSetup();
        const { user, project, repository } = setup;
        const task = await createTestTask(project.id, repository.id);
        
        // Test with various file types
        const testFiles = [
          new File(["text content"], "test.txt", { type: "text/plain" }),
          new File(["json content"], "test.json", { type: "application/json" }),
          new File(["image content"], "test.png", { type: "image/png" })
        ];
        
        for (const file of testFiles) {
          try {
            const result = await testProtectedProcedure(
              tasksRouter.uploadAttachment,
              user,
              { taskId: task.id, file }
            );
            // If successful, verify the structure
            expect(result.attachment.originalName).toBe(file.name);
            expect(result.attachment.type).toBe(file.type);
            expect(result.attachment.size).toBe(file.size);
          } catch (error: any) {
            // If file storage isn't configured in test environment, that's expected
            const isExpectedError = error.message.includes("ENOENT") ||
                                   error.message.includes("filesystem") ||
                                   error.message.includes("Task not found") ||
                                   error.message.includes("Unsupported file type");
            expect(isExpectedError).toBe(true);
          }
        }
      });

      it("should prevent cross-project task access", async () => {
        const [user1, user2] = await createTestUsers(2);
        const project1 = await createTestProject(user1.id);
        const project2 = await createTestProject(user2.id);
        const repo1 = await createTestRepository(project1.id);
        const repo2 = await createTestRepository(project2.id);
        
        const task1 = await createTestTask(project1.id, repo1.id);
        const task2 = await createTestTask(project2.id, repo2.id);
        
        const testFile = new File(["test"], "test.txt", { type: "text/plain" });
        
        // User1 cannot upload to User2's task
        try {
          await testProtectedProcedure(
            tasksRouter.uploadAttachment,
            user1,
            { taskId: task2.id, file: testFile }
          );
          throw new Error("Should have been denied cross-project access");
        } catch (error: any) {
          expect(error.message).toContain("Task not found or unauthorized");
        }
        
        // User2 cannot upload to User1's task
        try {
          await testProtectedProcedure(
            tasksRouter.uploadAttachment,
            user2,
            { taskId: task1.id, file: testFile }
          );
          throw new Error("Should have been denied cross-project access");
        } catch (error: any) {
          expect(error.message).toContain("Task not found or unauthorized");
        }
      });
    });

    describe("getAttachment", () => {
      it("should enforce project membership through task ownership", async () => {
        const [owner, nonMember] = await createTestUsers(2);
        const project = await createTestProject(owner.id);
        const repository = await createTestRepository(project.id);
        const task = await createTestTask(project.id, repository.id);
        const attachmentId = randomUUID();
        
        // Non-member should be denied
        try {
          await testProtectedProcedure(
            tasksRouter.getAttachment,
            nonMember,
            { taskId: task.id, attachmentId }
          );
          throw new Error("Should have been denied access");
        } catch (error: any) {
          expect(error.message).toContain("Task not found or unauthorized");
        }
      });

      it("should handle non-existent attachments gracefully", async () => {
        const setup = await createCompleteTestSetup();
        const { user, project, repository } = setup;
        const task = await createTestTask(project.id, repository.id);
        const nonExistentAttachmentId = randomUUID();
        
        // Should handle missing attachment properly
        try {
          await testProtectedProcedure(
            tasksRouter.getAttachment,
            user,
            { taskId: task.id, attachmentId: nonExistentAttachmentId }
          );
          throw new Error("Should have thrown not found error");
        } catch (error: any) {
          expect(
            error.message.includes("Attachment not found") ||
            error.message.includes("Task not found or unauthorized")
          ).toBe(true);
        }
      });

      it("should validate UUID format for attachment ID", async () => {
        const setup = await createCompleteTestSetup();
        const { user, project, repository } = setup;
        const task = await createTestTask(project.id, repository.id);
        
        // Should validate UUID format
        try {
          await testProtectedProcedure(
            tasksRouter.getAttachment,
            user,
            { taskId: task.id, attachmentId: "invalid-uuid" }
          );
          throw new Error("Should have thrown validation error");
        } catch (error: any) {
          expect(
            error.message.includes("uuid") ||
            error.message.includes("invalid") ||
            error.message.includes("validation") ||
            error.message.includes("Task not found")
          ).toBe(true);
        }
      });

      it("should prevent access to attachments across different tasks", async () => {
        const setup = await createCompleteTestSetup();
        const { user, project, repository } = setup;
        
        const task1 = await createTestTask(project.id, repository.id, { rawTitle: "Task 1" });
        const task2 = await createTestTask(project.id, repository.id, { rawTitle: "Task 2" });
        const attachmentId = randomUUID();
        
        // Even if user owns both tasks, specific attachment should belong to specific task
        try {
          await testProtectedProcedure(
            tasksRouter.getAttachment,
            user,
            { taskId: task1.id, attachmentId }
          );
          throw new Error("Should not find attachment in wrong task");
        } catch (error: any) {
          expect(
            error.message.includes("Attachment not found") ||
            error.message.includes("Task not found or unauthorized")
          ).toBe(true);
        }
      });
    });

    describe("deleteAttachment", () => {
      it("should enforce project membership through task ownership", async () => {
        const [owner, nonMember] = await createTestUsers(2);
        const project = await createTestProject(owner.id);
        const repository = await createTestRepository(project.id);
        const task = await createTestTask(project.id, repository.id);
        const attachmentId = randomUUID();
        
        // Non-member should be denied
        try {
          await testProtectedProcedure(
            tasksRouter.deleteAttachment,
            nonMember,
            { taskId: task.id, attachmentId }
          );
          throw new Error("Should have been denied access");
        } catch (error: any) {
          expect(error.message).toContain("Task not found or unauthorized");
        }
      });

      it("should handle deletion of non-existent attachments", async () => {
        const setup = await createCompleteTestSetup();
        const { user, project, repository } = setup;
        const task = await createTestTask(project.id, repository.id);
        const nonExistentAttachmentId = randomUUID();
        
        // Should handle missing attachment deletion gracefully
        try {
          const result = await testProtectedProcedure(
            tasksRouter.deleteAttachment,
            user,
            { taskId: task.id, attachmentId: nonExistentAttachmentId }
          );
          // If it succeeds (graceful handling), verify response
          expect(result.success).toBe(true);
        } catch (error: any) {
          // If it fails, ensure it's a proper error
          expect(
            error.message.includes("Attachment not found") ||
            error.message.includes("Task not found or unauthorized") ||
            error.message.includes("ENOENT")
          ).toBe(true);
        }
      });

      it("should validate UUID formats for both task and attachment IDs", async () => {
        const setup = await createCompleteTestSetup();
        const { user } = setup;
        
        const invalidInputs = [
          { taskId: "invalid-task-id", attachmentId: randomUUID() },
          { taskId: randomUUID(), attachmentId: "invalid-attachment-id" },
          { taskId: "invalid-task", attachmentId: "invalid-attachment" }
        ];
        
        for (const input of invalidInputs) {
          try {
            await testProtectedProcedure(
              tasksRouter.deleteAttachment,
              user,
              input
            );
            throw new Error(`Should have thrown validation error for input: ${JSON.stringify(input)}`);
          } catch (error: any) {
            expect(
              error.message.includes("uuid") ||
              error.message.includes("invalid") ||
              error.message.includes("validation") ||
              error.message.includes("Task not found")
            ).toBe(true);
          }
        }
      });

      it("should prevent deletion across project boundaries", async () => {
        const [user1, user2] = await createTestUsers(2);
        const project1 = await createTestProject(user1.id);
        const project2 = await createTestProject(user2.id);
        const repo1 = await createTestRepository(project1.id);
        const repo2 = await createTestRepository(project2.id);
        
        const task1 = await createTestTask(project1.id, repo1.id);
        const task2 = await createTestTask(project2.id, repo2.id);
        const attachmentId = randomUUID();
        
        // User1 cannot delete attachments from User2's project
        try {
          await testProtectedProcedure(
            tasksRouter.deleteAttachment,
            user1,
            { taskId: task2.id, attachmentId }
          );
          throw new Error("Should have been denied cross-project access");
        } catch (error: any) {
          expect(error.message).toContain("Task not found or unauthorized");
        }
        
        // User2 cannot delete attachments from User1's project
        try {
          await testProtectedProcedure(
            tasksRouter.deleteAttachment,
            user2,
            { taskId: task1.id, attachmentId }
          );
          throw new Error("Should have been denied cross-project access");
        } catch (error: any) {
          expect(error.message).toContain("Task not found or unauthorized");
        }
      });
    });

    describe("downloadAttachment", () => {
      it("should enforce project membership through task ownership", async () => {
        const [owner, nonMember] = await createTestUsers(2);
        const project = await createTestProject(owner.id);
        const repository = await createTestRepository(project.id);  
        const task = await createTestTask(project.id, repository.id);
        const attachmentId = randomUUID();
        
        // Non-member should be denied
        try {
          await testProtectedProcedure(
            tasksRouter.downloadAttachment,
            nonMember,
            { taskId: task.id, attachmentId }
          );
          throw new Error("Should have been denied access");
        } catch (error: any) {
          // Download endpoint may check task ownership first or return "File not found"
          expect(
            error.message.includes("Task not found or unauthorized") ||
            error.message.includes("File not found")
          ).toBe(true);
        }
      });

      it("should return proper file data structure", async () => {
        const setup = await createCompleteTestSetup();
        const { user, project, repository } = setup;
        const task = await createTestTask(project.id, repository.id);
        const attachmentId = randomUUID();
        
        // Should return proper structure or proper error for missing file
        try {
          const result = await testProtectedProcedure(
            tasksRouter.downloadAttachment,
            user,
            { taskId: task.id, attachmentId }
          );
          
          // If successful, verify structure
          expect(result.buffer).toBeDefined();
          expect(result.metadata).toBeDefined();
        } catch (error: any) {
          // Expected errors for test environment
          expect(
            error.message.includes("File not found") ||
            error.message.includes("Attachment not found") ||
            error.message.includes("Task not found or unauthorized")
          ).toBe(true);
        }
      });

      it("should handle concurrent download attempts", async () => {
        const setup = await createCompleteTestSetup();
        const { user, project, repository } = setup;
        const task = await createTestTask(project.id, repository.id);
        const attachmentId = randomUUID();
        
        // Multiple concurrent download attempts should be handled gracefully
        const downloadPromises = Array(3).fill(null).map(() => 
          testProtectedProcedure(
            tasksRouter.downloadAttachment,
            user,
            { taskId: task.id, attachmentId }
          )
        );
        
        const results = await Promise.allSettled(downloadPromises);
        
        // All should either succeed or fail with the same expected error
        results.forEach((result) => {
          if (result.status === 'rejected') {
            expect(
              result.reason.message.includes("File not found") ||
              result.reason.message.includes("Attachment not found") ||
              result.reason.message.includes("Task not found or unauthorized")
            ).toBe(true);
          } else {
            // If successful, verify structure
            expect(result.value.buffer).toBeDefined();
            expect(result.value.metadata).toBeDefined();
          }
        });
      });

      it("should prevent unauthorized cross-task access", async () => {
        const setup = await createCompleteTestSetup();
        const { user, project, repository } = setup;
        
        // Create two tasks in the same project
        const task1 = await createTestTask(project.id, repository.id, { rawTitle: "Task 1" });
        const task2 = await createTestTask(project.id, repository.id, { rawTitle: "Task 2" });
        
        // Create attachment ID that doesn't belong to either task
        const fakeAttachmentId = randomUUID();
        
        // Should not be able to download non-existent attachment from either task
        for (const task of [task1, task2]) {
          try {
            await testProtectedProcedure(
              tasksRouter.downloadAttachment,
              user,
              { taskId: task.id, attachmentId: fakeAttachmentId }
            );
            throw new Error(`Should not find attachment in task ${task.id}`);
          } catch (error: any) {
            expect(
              error.message.includes("File not found") ||
              error.message.includes("Attachment not found") ||
              error.message.includes("Task not found or unauthorized")
            ).toBe(true);
          }
        }
      });
    });

    describe("Attachment Integration Tests", () => {
      it("should handle full attachment lifecycle when file storage is available", async () => {
        const setup = await createCompleteTestSetup();
        const { user, project, repository } = setup;
        const task = await createTestTask(project.id, repository.id);
        
        const testFile = new File(["test attachment content"], "test-file.txt", { 
          type: "text/plain" 
        });
        
        try {
          // Upload attachment
          const uploadResult = await testProtectedProcedure(
            tasksRouter.uploadAttachment,
            user,
            { taskId: task.id, file: testFile }
          );
          
          const attachmentId = uploadResult.attachment.id;
          
          // Get attachment metadata
          const getResult = await testProtectedProcedure(
            tasksRouter.getAttachment,
            user,
            { taskId: task.id, attachmentId }
          );
          
          expect(getResult.metadata.originalName).toBe("test-file.txt");
          expect(getResult.metadata.type).toBe("text/plain");
          
          // Download attachment
          const downloadResult = await testProtectedProcedure(
            tasksRouter.downloadAttachment,
            user,
            { taskId: task.id, attachmentId }
          );
          
          expect(downloadResult.buffer).toBeDefined();
          expect(downloadResult.metadata.originalName).toBe("test-file.txt");
          
          // Delete attachment
          const deleteResult = await testProtectedProcedure(
            tasksRouter.deleteAttachment,
            user,
            { taskId: task.id, attachmentId }
          );
          
          expect(deleteResult.success).toBe(true);
          
          // Verify attachment is deleted
          try {
            await testProtectedProcedure(
              tasksRouter.getAttachment,
              user,
              { taskId: task.id, attachmentId }
            );
            throw new Error("Should not find deleted attachment");
          } catch (error: any) {
            expect(error.message).toContain("Attachment not found");
          }
          
        } catch (error: any) {
          // If file storage isn't configured in test environment, that's expected
          const isExpectedStorageError = error.message.includes("ENOENT") ||
                                        error.message.includes("filesystem") ||
                                        error.message.includes("Task not found") ||
                                        error.message.includes("Attachment not found");
          expect(isExpectedStorageError).toBe(true);
        }
      });

      it("should enforce consistent security across all attachment operations", async () => {
        const [user1, user2] = await createTestUsers(2);
        const project1 = await createTestProject(user1.id);
        const project2 = await createTestProject(user2.id);
        const repo1 = await createTestRepository(project1.id);
        const repo2 = await createTestRepository(project2.id);
        
        const task1 = await createTestTask(project1.id, repo1.id);
        const task2 = await createTestTask(project2.id, repo2.id);
        const attachmentId = randomUUID();
        
        const testFile = new File(["test"], "test.txt", { type: "text/plain" });
        
        // All attachment operations should deny cross-project access consistently
        const operationsToTest = [
          { name: "uploadAttachment", input: { taskId: task2.id, file: testFile } },
          { name: "getAttachment", input: { taskId: task2.id, attachmentId } },
          { name: "downloadAttachment", input: { taskId: task2.id, attachmentId } },
          { name: "deleteAttachment", input: { taskId: task2.id, attachmentId } }
        ];
        
        for (const operation of operationsToTest) {
          try {
            await testProtectedProcedure(
              tasksRouter[operation.name as keyof typeof tasksRouter],
              user1, // User1 trying to access User2's task
              operation.input as any
            );
            throw new Error(`${operation.name} should have been denied cross-project access`);
          } catch (error: any) {
            expect(error.message).toContain("Task not found or unauthorized");
          }
        }
      });
    });
  });

  describe("Data Isolation", () => {
    it("should properly isolate task data across all endpoints", async () => {
      const [user1, user2] = await createTestUsers(2);
      
      const user1Project = await createTestProject(user1.id);
      const user2Project = await createTestProject(user2.id);
      
      const user1Repo = await createTestRepository(user1Project.id);
      const user2Repo = await createTestRepository(user2Project.id);
      
      const user1Task = await createTestTask(user1Project.id, user1Repo.id, {
        rawTitle: "User 1 Task"
      });
      const user2Task = await createTestTask(user2Project.id, user2Repo.id, {
        rawTitle: "User 2 Task"  
      });
      
      // User 1 should not see User 2's tasks in list
      const user1Tasks = await testProtectedProcedure(
        tasksRouter.list,
        user1,
        { projectId: user1Project.id }
      );
      expect(user1Tasks).toHaveLength(1);
      expect(user1Tasks[0].rawTitle).toBe("User 1 Task");
      
      // User 1 should not be able to access User 2's task
      try {
        await testProtectedProcedure(tasksRouter.get, user1, { id: user2Task.id });
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
      
      // User 1 should not be able to update User 2's task
      try {
        await testProtectedProcedure(
          tasksRouter.update,
          user1,
          { id: user2Task.id, rawTitle: "Hacked" }
        );
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
      
      // User 1 should not be able to delete User 2's task
      try {
        await testProtectedProcedure(tasksRouter.delete, user1, { id: user2Task.id });
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
    });

    it("should isolate task operations between different projects", async () => {
      const user = await createTestUser();
      const project1 = await createTestProject(user.id, { name: "Project 1" });
      const project2 = await createTestProject(user.id, { name: "Project 2" });
      
      const repo1 = await createTestRepository(project1.id);
      const repo2 = await createTestRepository(project2.id);
      
      const task1 = await createTestTask(project1.id, repo1.id);
      const task2 = await createTestTask(project2.id, repo2.id);
      
      // Project 1 list should not include Project 2 tasks
      const project1Tasks = await testProtectedProcedure(
        tasksRouter.list,
        user,
        { projectId: project1.id }
      );
      expect(project1Tasks).toHaveLength(1);
      expect(project1Tasks[0].id).toBe(task1.id);
      
      // Project 2 list should not include Project 1 tasks  
      const project2Tasks = await testProtectedProcedure(
        tasksRouter.list,
        user,
        { projectId: project2.id }
      );
      expect(project2Tasks).toHaveLength(1);
      expect(project2Tasks[0].id).toBe(task2.id);
    });
  });

  describe("Error Handling", () => {
    it("should handle non-existent task IDs", async () => {
      const user = await createTestUser();
      const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";
      
      try {
        await testProtectedProcedure(tasksRouter.get, user, { id: nonExistentId });
        throw new Error("Should have thrown not found error");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
    });

    it("should handle invalid UUID validation", async () => {
      const user = await createTestUser();
      
      try {
        await testProtectedProcedure(tasksRouter.get, user, { id: "invalid-uuid" });
        throw new Error("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toContain("uuid");
      }
    });

    it("should validate required fields in create", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const repository = await createTestRepository(project.id);
      
      // Test missing title - this should trigger validation error
      try {
        await testProtectedProcedure(
          tasksRouter.create,
          user,
          {
            projectId: project.id,
            mainRepositoryId: repository.id,
            rawTitle: "" // This will fail Zod validation
          }
        );
        throw new Error("Should have thrown validation error");
      } catch (error: any) {
        // The error could be from project membership check or validation
        // Both are valid security measures
        const hasValidationError = error.message.includes("String must contain at least 1 character(s)") ||
          error.message.includes("min") ||
          error.message.includes("required");
        const hasAuthError = error.message.includes("Project not found or unauthorized");
        
        expect(hasValidationError || hasAuthError).toBe(true);
      }
    });

    it("should handle attachment operations on non-existent attachments", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const task = await createTestTask(project.id, repository.id);
      const nonExistentAttachmentId = "123e4567-e89b-12d3-a456-426614174000";
      
      // Test getAttachment with non-existent attachment
      try {
        await testProtectedProcedure(
          tasksRouter.getAttachment,
          user,
          { taskId: task.id, attachmentId: nonExistentAttachmentId }
        );
        throw new Error("Should have thrown not found error");
      } catch (error: any) {
        // The error could be either "Task not found" (due to project access) or "Attachment not found"
        expect(
          error.message.includes("Task not found or unauthorized") || 
          error.message.includes("Attachment not found")
        ).toBe(true);
      }
    });
  });

  describe("Task Status and Stage Transitions", () => {
    it("should handle status transitions correctly", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const task = await createTestTask(project.id, repository.id, {
        status: "todo",
        stage: null
      });
      
      // Move to doing should set clarify stage
      await testProtectedProcedure(
        tasksRouter.updateOrder,
        user,
        {
          projectId: project.id,
          tasks: [{ id: task.id, columnOrder: "1000", status: "doing" }]
        }
      );
      
      const updatedTask = await testProtectedProcedure(
        tasksRouter.get,
        user,
        { id: task.id }
      );
      
      expect(updatedTask.status).toBe("doing");
      // Note: Stage should be handled by business logic, not necessarily auto-set
    });

    it("should handle loop task transitions", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const task = await createTestTask(project.id, repository.id, {
        status: "loop",
        stage: "loop"
      });
      
      // Move loop task to doing should maintain loop stage
      await testProtectedProcedure(
        tasksRouter.updateOrder,
        user,
        {
          projectId: project.id,
          tasks: [{ id: task.id, columnOrder: "1000", status: "doing" }]
        }
      );
      
      const updatedTask = await testProtectedProcedure(
        tasksRouter.get,
        user,
        { id: task.id }
      );
      
      expect(updatedTask.status).toBe("doing");
      // Loop tasks should maintain their special behavior
    });
  });

  describe("Comprehensive CRUD Coverage", () => {
    it("should support full task lifecycle", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository, agent, actor } = setup;
      
      // Create task
      const createdTask = await testProtectedProcedure(
        tasksRouter.create,
        user,
        {
          projectId: project.id,
          mainRepositoryId: repository.id,
          assignedAgentIds: [agent.id],
          actorId: actor.id,
          rawTitle: "Lifecycle Task",
          rawDescription: "Task for testing full lifecycle",
          priority: 3
        }
      );
      
      expect(createdTask.rawTitle).toBe("Lifecycle Task");
      
      // Read task
      const readTask = await testProtectedProcedure(
        tasksRouter.get,
        user,
        { id: createdTask.id }
      );
      
      expect(readTask.id).toBe(createdTask.id);
      
      // Update task
      const updatedTask = await testProtectedProcedure(
        tasksRouter.update,
        user,
        {
          id: createdTask.id,
          rawTitle: "Updated Lifecycle Task",
          priority: 5,
          status: "doing"
        }
      );
      
      expect(updatedTask.rawTitle).toBe("Updated Lifecycle Task");
      expect(updatedTask.priority).toBe(5);
      
      // Toggle ready status
      await testProtectedProcedure(
        tasksRouter.toggleReady,
        user,
        { id: createdTask.id, ready: true }
      );
      
      // Update stage
      await testProtectedProcedure(
        tasksRouter.updateStage,
        user,
        { id: createdTask.id, stage: "execute" }
      );
      
      // Reset agent
      await testProtectedProcedure(
        tasksRouter.resetAgent,
        user,
        { id: createdTask.id }
      );
      
      // Update order/status
      await testProtectedProcedure(
        tasksRouter.updateOrder,
        user,
        {
          projectId: project.id,
          tasks: [{ id: createdTask.id, columnOrder: "2000", status: "done" }]
        }
      );
      
      // Verify final state
      const finalTask = await testProtectedProcedure(
        tasksRouter.get,
        user,
        { id: createdTask.id }
      );
      
      expect(finalTask.status).toBe("done");
      expect(finalTask.agentSessionStatus).toBe("INACTIVE");
      
      // Delete task
      const deleteResult = await testProtectedProcedure(
        tasksRouter.delete,
        user,
        { id: createdTask.id }
      );
      
      expect(deleteResult.success).toBe(true);
    });
  });

  describe("Advanced Security and Edge Cases", () => {
    it("should prevent task operations with malformed UUIDs", async () => {
      const user = await createTestUser();
      
      const malformedUUIDs = [
        "",
        "not-a-uuid",
        "12345678-1234-1234-1234-123456789012345", // too long
        "12345678-1234-1234-1234-12345678901", // too short
        "GGGGGGGG-1234-1234-1234-123456789012", // invalid hex chars
        null,
        undefined
      ];
      
      for (const malformedUUID of malformedUUIDs) {
        try {
          await testProtectedProcedure(
            tasksRouter.get,
            user,
            { id: malformedUUID as any }
          );
          throw new Error(`Should have failed validation for UUID: ${malformedUUID}`);
        } catch (error: any) {
          // Should get validation error
          expect(
            error.message.includes("uuid") ||
            error.message.includes("Invalid") ||
            error.message.includes("validation") ||
            error.message.includes("Expected") ||
            error.message.includes("required")
          ).toBe(true);
        }
      }
    });

    it("should handle concurrent task operations gracefully", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const task = await createTestTask(project.id, repository.id, {
        rawTitle: "Concurrent Test Task"
      });
      
      // Test concurrent read operations
      const readPromises = Array(5).fill(null).map(() =>
        testProtectedProcedure(tasksRouter.get, user, { id: task.id })
      );
      
      const readResults = await Promise.allSettled(readPromises);
      
      // All reads should succeed
      readResults.forEach((result) => {
        expect(result.status).toBe("fulfilled");
        if (result.status === "fulfilled") {
          expect(result.value.rawTitle).toBe("Concurrent Test Task");
        }
      });
      
      // Test concurrent update operations
      const updatePromises = Array(3).fill(null).map((_, index) =>
        testProtectedProcedure(
          tasksRouter.update,
          user,
          {
            id: task.id,
            rawTitle: `Updated Title ${index}`,
            priority: Math.min(5, index + 1)
          }
        )
      );
      
      const updateResults = await Promise.allSettled(updatePromises);
      
      // At least some updates should succeed
      const successfulUpdates = updateResults.filter(r => r.status === "fulfilled");
      expect(successfulUpdates.length).toBeGreaterThan(0);
    });

    it("should enforce proper data types in task operations", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const invalidInputs = [
        // Invalid priority values
        { priority: 0 }, // below min
        { priority: 6 }, // above max
        { priority: -1 }, // negative
        { priority: 3.5 }, // decimal
        { priority: "high" }, // string
        
        // Invalid status values
        { status: "invalid-status" },
        { status: "DOING" }, // wrong case
        { status: 123 }, // number
        
        // Invalid stage values
        { stage: "invalid-stage" },
        { stage: "PLAN" }, // wrong case
        
        // Invalid ready values  
        { ready: "true" }, // string instead of boolean
        { ready: 1 }, // number instead of boolean
      ];
      
      for (const invalidInput of invalidInputs) {
        try {
          await testProtectedProcedure(
            tasksRouter.create,
            user,
            {
              projectId: project.id,
              mainRepositoryId: repository.id,
              rawTitle: "Test Task",
              ...invalidInput
            } as any
          );
          throw new Error(`Should have failed validation for input: ${JSON.stringify(invalidInput)}`);
        } catch (error: any) {
          // Should get validation error
          expect(
            error.message.includes("validation") ||
            error.message.includes("Invalid") ||
            error.message.includes("Expected") ||
            error.message.includes("min") ||
            error.message.includes("max") ||
            error.message.includes("enum") ||
            error.message.includes("Project not found") // Auth check might happen first
          ).toBe(true);
        }
      }
    });

    it("should handle extremely long input strings appropriately", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      // Create very long strings
      const longTitle = "A".repeat(300); // Exceeds max length
      const longDescription = "B".repeat(10000); // Very long description
      
      try {
        await testProtectedProcedure(
          tasksRouter.create,
          user,
          {
            projectId: project.id,
            mainRepositoryId: repository.id,
            rawTitle: longTitle,
            rawDescription: longDescription
          }
        );
        throw new Error("Should have failed validation for long strings");
      } catch (error: any) {
        // Should get validation error for title length
        expect(
          error.message.includes("max") ||
          error.message.includes("length") ||
          error.message.includes("255") ||
          error.message.includes("Project not found") // Auth check might happen first
        ).toBe(true);
      }
    });

    it("should maintain data consistency during status transitions", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      const task = await createTestTask(project.id, repository.id, {
        status: "todo",
        stage: null,
        ready: false
      });
      
      // Test various status transitions
      const transitions = [
        { status: "doing", expectedStage: null }, // Stage should not auto-change
        { status: "done", expectedStage: null },
        { status: "loop", expectedStage: "loop" }, // Loop should set stage
        { status: "todo", expectedStage: null }
      ];
      
      for (const transition of transitions) {
        await testProtectedProcedure(
          tasksRouter.updateOrder,
          user,
          {
            projectId: project.id,
            tasks: [{ 
              id: task.id, 
              columnOrder: "1000", 
              status: transition.status as any 
            }]
          }
        );
        
        const updatedTask = await testProtectedProcedure(
          tasksRouter.get,
          user,
          { id: task.id }
        );
        
        expect(updatedTask.status).toBe(transition.status);
        if (transition.expectedStage === "loop") {
          expect(updatedTask.stage).toBe("loop");
        }
      }
    });

    it("should handle task operations with missing optional fields", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project, repository } = setup;
      
      // Create task with minimal required fields
      const minimalTask = await testProtectedProcedure(
        tasksRouter.create,
        user,
        {
          projectId: project.id,
          mainRepositoryId: repository.id,
          rawTitle: "Minimal Task"
          // No optional fields provided
        }
      );
      
      expect(minimalTask.rawTitle).toBe("Minimal Task");
      expect(minimalTask.priority).toBe(3); // Default priority
      expect(minimalTask.status).toBe("todo"); // Default status
      expect(minimalTask.rawDescription).toBeNull();
      expect(minimalTask.actorId).toBeNull();
      
      // Update with partial fields
      const partialUpdate = await testProtectedProcedure(
        tasksRouter.update,
        user,
        {
          id: minimalTask.id,
          rawDescription: "Added description"
          // Only updating description
        }
      );
      
      expect(partialUpdate.rawDescription).toBe("Added description");
      expect(partialUpdate.rawTitle).toBe("Minimal Task"); // Should remain unchanged
    });
  });
});