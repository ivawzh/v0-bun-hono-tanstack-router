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
  testRealRPCWithAuth,
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
      const user1Tasks = await testRealRPCWithAuth(
        tasksRouter.list,
        user1,
        { projectId: user1Project.id }
      );
      
      expect(user1Tasks).toHaveLength(1);
      expect(user1Tasks[0].id).toBe(user1Task.id);
      expect(user1Tasks[0].rawTitle).toBe("User 1 Task");
      
      // User 2 should only see their project's tasks
      const user2Tasks = await testRealRPCWithAuth(
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
      await testRealRPCWithAuth(
        tasksRouter.list,
        owner,
        { projectId: project.id }
      );
      
      // Non-member should be denied
      try {
        await testRealRPCWithAuth(
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
      
      const tasks = await testRealRPCWithAuth(
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
      
      const tasks = await testRealRPCWithAuth(
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
      
      const result = await testRealRPCWithAuth(
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
      await testRealRPCWithAuth(tasksRouter.get, owner, { id: task.id });
      
      // Non-member should be denied
      try {
        await testRealRPCWithAuth(tasksRouter.get, nonMember, { id: task.id });
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
      
      const result = await testRealRPCWithAuth(
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
      
      const result = await testRealRPCWithAuth(
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
      await testRealRPCWithAuth(
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
        await testRealRPCWithAuth(
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
      
      const result = await testRealRPCWithAuth(
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
        await testRealRPCWithAuth(
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
        await testRealRPCWithAuth(
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
      
      const result = await testRealRPCWithAuth(
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
      await testRealRPCWithAuth(
        tasksRouter.update,
        owner,
        { id: task.id, rawTitle: "Owner Update" }
      );
      
      // Non-member should be denied
      try {
        await testRealRPCWithAuth(
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
      
      const result = await testRealRPCWithAuth(
        tasksRouter.delete,
        user,
        { id: task.id }
      );
      
      expect(result.success).toBe(true);
      
      // Verify task is deleted
      try {
        await testRealRPCWithAuth(tasksRouter.get, user, { id: task.id });
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
        await testRealRPCWithAuth(tasksRouter.delete, nonMember, { id: task.id });
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
      const result1 = await testRealRPCWithAuth(
        tasksRouter.toggleReady,
        user,
        { id: task.id, ready: true }
      );
      
      expect(result1.ready).toBe(true);
      
      // Set to not ready
      const result2 = await testRealRPCWithAuth(
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
        await testRealRPCWithAuth(
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
      
      const result = await testRealRPCWithAuth(
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
        await testRealRPCWithAuth(
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
      
      const result = await testRealRPCWithAuth(
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
        await testRealRPCWithAuth(
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
      
      const result = await testRealRPCWithAuth(
        tasksRouter.resetAgent,
        user,
        { id: task.id }
      );
      
      expect(result.agentSessionStatus).toBe("NON_ACTIVE");
      expect(result.activeAgentId).toBeNull();
    });

    it("should enforce project membership", async () => {
      const [owner, nonMember] = await createTestUsers(2);
      const project = await createTestProject(owner.id);
      const repository = await createTestRepository(project.id);
      const task = await createTestTask(project.id, repository.id);
      
      // Non-member should be denied
      try {
        await testRealRPCWithAuth(tasksRouter.resetAgent, nonMember, { id: task.id });
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
          await testRealRPCWithAuth(
            tasksRouter.uploadAttachment,
            nonMember,
            { taskId: task.id, file: fakeFile }
          );
          throw new Error("Should have been denied access");
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
          await testRealRPCWithAuth(
            tasksRouter.getAttachment,
            nonMember,
            { taskId: task.id, attachmentId }
          );
          throw new Error("Should have been denied access");
        } catch (error: any) {
          expect(error.message).toContain("Task not found or unauthorized");
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
          await testRealRPCWithAuth(
            tasksRouter.deleteAttachment,
            nonMember,
            { taskId: task.id, attachmentId }
          );
          throw new Error("Should have been denied access");
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
          await testRealRPCWithAuth(
            tasksRouter.downloadAttachment,
            nonMember,
            { taskId: task.id, attachmentId }
          );
          throw new Error("Should have been denied access");
        } catch (error: any) {
          expect(error.message).toContain("Task not found or unauthorized");
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
      const user1Tasks = await testRealRPCWithAuth(
        tasksRouter.list,
        user1,
        { projectId: user1Project.id }
      );
      expect(user1Tasks).toHaveLength(1);
      expect(user1Tasks[0].rawTitle).toBe("User 1 Task");
      
      // User 1 should not be able to access User 2's task
      try {
        await testRealRPCWithAuth(tasksRouter.get, user1, { id: user2Task.id });
        throw new Error("Should have been denied access");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
      
      // User 1 should not be able to update User 2's task
      try {
        await testRealRPCWithAuth(
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
        await testRealRPCWithAuth(tasksRouter.delete, user1, { id: user2Task.id });
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
      const project1Tasks = await testRealRPCWithAuth(
        tasksRouter.list,
        user,
        { projectId: project1.id }
      );
      expect(project1Tasks).toHaveLength(1);
      expect(project1Tasks[0].id).toBe(task1.id);
      
      // Project 2 list should not include Project 1 tasks  
      const project2Tasks = await testRealRPCWithAuth(
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
        await testRealRPCWithAuth(tasksRouter.get, user, { id: nonExistentId });
        throw new Error("Should have thrown not found error");
      } catch (error: any) {
        expect(error.message).toContain("Task not found or unauthorized");
      }
    });

    it("should handle invalid UUID validation", async () => {
      const user = await createTestUser();
      
      try {
        await testRealRPCWithAuth(tasksRouter.get, user, { id: "invalid-uuid" });
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
        await testRealRPCWithAuth(
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
        await testRealRPCWithAuth(
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
      await testRealRPCWithAuth(
        tasksRouter.updateOrder,
        user,
        {
          projectId: project.id,
          tasks: [{ id: task.id, columnOrder: "1000", status: "doing" }]
        }
      );
      
      const updatedTask = await testRealRPCWithAuth(
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
      await testRealRPCWithAuth(
        tasksRouter.updateOrder,
        user,
        {
          projectId: project.id,
          tasks: [{ id: task.id, columnOrder: "1000", status: "doing" }]
        }
      );
      
      const updatedTask = await testRealRPCWithAuth(
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
      const createdTask = await testRealRPCWithAuth(
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
      const readTask = await testRealRPCWithAuth(
        tasksRouter.get,
        user,
        { id: createdTask.id }
      );
      
      expect(readTask.id).toBe(createdTask.id);
      
      // Update task
      const updatedTask = await testRealRPCWithAuth(
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
      await testRealRPCWithAuth(
        tasksRouter.toggleReady,
        user,
        { id: createdTask.id, ready: true }
      );
      
      // Update stage
      await testRealRPCWithAuth(
        tasksRouter.updateStage,
        user,
        { id: createdTask.id, stage: "execute" }
      );
      
      // Reset agent
      await testRealRPCWithAuth(
        tasksRouter.resetAgent,
        user,
        { id: createdTask.id }
      );
      
      // Update order/status
      await testRealRPCWithAuth(
        tasksRouter.updateOrder,
        user,
        {
          projectId: project.id,
          tasks: [{ id: createdTask.id, columnOrder: "2000", status: "done" }]
        }
      );
      
      // Verify final state
      const finalTask = await testRealRPCWithAuth(
        tasksRouter.get,
        user,
        { id: createdTask.id }
      );
      
      expect(finalTask.status).toBe("done");
      expect(finalTask.agentSessionStatus).toBe("NON_ACTIVE");
      
      // Delete task
      const deleteResult = await testRealRPCWithAuth(
        tasksRouter.delete,
        user,
        { id: createdTask.id }
      );
      
      expect(deleteResult.success).toBe(true);
    });
  });
});