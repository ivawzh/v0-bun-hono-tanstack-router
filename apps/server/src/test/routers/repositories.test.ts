/**
 * Repositories Router Tests
 * Tests for all CRUD endpoints with authentication and authorization verification
 */
import { describe, it, expect } from "bun:test";

import { setupDatabaseTests } from "../test-utils";
import { createTestUser, createTestProject, createTestRepository, createCompleteTestSetup } from "../fixtures";
import { 
  testProtectedProcedure,
  assertRealRPCUnauthorized
} from "../rpc-test-helpers";
import { repositoriesRouter } from "../../routers/repositories";

// Setup database for these tests
setupDatabaseTests();

describe("Repositories Router", () => {
  describe("Authentication Requirements", () => {
    it("should require authentication for all endpoints", async () => {
      const sampleProjectId = "550e8400-e29b-41d4-a716-446655440000";
      const sampleRepoId = "550e8400-e29b-41d4-a716-446655440001";
      
      const endpointsToTest = [
        { name: "list", input: { projectId: sampleProjectId } },
        { name: "get", input: { id: sampleRepoId } },
        { name: "create", input: { projectId: sampleProjectId, name: "Test Repo", repoPath: "/tmp/test" } },
        { name: "update", input: { id: sampleRepoId, name: "Updated Repo" } },
        { name: "delete", input: { id: sampleRepoId } },
      ];

      for (const endpoint of endpointsToTest) {
        await assertRealRPCUnauthorized(
          repositoriesRouter[endpoint.name as keyof typeof repositoriesRouter],
          endpoint.input
        );
      }
    });
  });

  describe("Basic CRUD Operations", () => {
    it("should list repositories for project member", async () => {
      const { user, project, repository } = await createCompleteTestSetup();
      
      const result = await testProtectedProcedure(
        repositoriesRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(repository.id);
      expect(result[0].name).toBe(repository.name);
      expect(result[0].repoPath).toBe(repository.repoPath);
      expect(result[0].isDefault).toBe(repository.isDefault);
    });

    it("should get specific repository for project member", async () => {
      const { user, repository } = await createCompleteTestSetup();
      
      const result = await testProtectedProcedure(
        repositoriesRouter.get,
        user,
        { id: repository.id }
      );
      
      expect(result.id).toBe(repository.id);
      expect(result.name).toBe(repository.name);
      expect(result.repoPath).toBe(repository.repoPath);
      expect(result.isDefault).toBe(repository.isDefault);
    });

    it("should create new repository for project member", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      const repoData = {
        projectId: project.id,
        name: "New Test Repository",
        repoPath: "/tmp/new-test-repo",
        isDefault: false,
        maxConcurrencyLimit: 3
      };
      
      const result = await testProtectedProcedure(
        repositoriesRouter.create,
        user,
        repoData
      );
      
      expect(result.name).toBe(repoData.name);
      expect(result.repoPath).toBe(repoData.repoPath);
      expect(result.projectId).toBe(project.id);
      expect(result.isDefault).toBe(repoData.isDefault);
      expect(result.maxConcurrencyLimit).toBe(repoData.maxConcurrencyLimit);
    });

    it("should update repository for project member", async () => {
      const { user, repository } = await createCompleteTestSetup();
      
      const updates = {
        id: repository.id,
        name: "Updated Repository Name",
        repoPath: "/tmp/updated-path",
        maxConcurrencyLimit: 5
      };
      
      const result = await testProtectedProcedure(
        repositoriesRouter.update,
        user,
        updates
      );
      
      expect(result.id).toBe(repository.id);
      expect(result.name).toBe(updates.name);
      expect(result.repoPath).toBe(updates.repoPath);
      expect(result.maxConcurrencyLimit).toBe(updates.maxConcurrencyLimit);
    });

    it("should delete repository for project member", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      // Create an additional repository to delete
      const repoToDelete = await createTestRepository(project.id, { 
        name: "To Delete", 
        repoPath: "/tmp/to-delete",
        isDefault: false
      });
      
      const result = await testProtectedProcedure(
        repositoriesRouter.delete,
        user,
        { id: repoToDelete.id }
      );
      
      expect(result.success).toBe(true);
    });
  });

  describe("Default Repository Management", () => {
    it("should handle setting new default repository", async () => {
      const { user, project, repository: existingRepo } = await createCompleteTestSetup();
      
      // Verify existing repo is default
      expect(existingRepo.isDefault).toBe(true);
      
      const newDefaultRepo = await testProtectedProcedure(
        repositoriesRouter.create,
        user,
        {
          projectId: project.id,
          name: "New Default Repo",
          repoPath: "/tmp/new-default",
          isDefault: true
        }
      );
      
      expect(newDefaultRepo.isDefault).toBe(true);
      
      // Verify old default is no longer default
      const updatedExistingRepo = await testProtectedProcedure(
        repositoriesRouter.get,
        user,
        { id: existingRepo.id }
      );
      expect(updatedExistingRepo.isDefault).toBe(false);
    });

    it("should update default status correctly", async () => {
      const { user, project, repository: existingRepo } = await createCompleteTestSetup();
      
      // Create a second repository
      const secondRepo = await createTestRepository(project.id, {
        name: "Second Repo",
        repoPath: "/tmp/second",
        isDefault: false
      });
      
      // Make second repo the default
      const result = await testProtectedProcedure(
        repositoriesRouter.update,
        user,
        {
          id: secondRepo.id,
          isDefault: true
        }
      );
      
      expect(result.isDefault).toBe(true);
      
      // Verify first repo is no longer default
      const updatedFirstRepo = await testProtectedProcedure(
        repositoriesRouter.get,
        user,
        { id: existingRepo.id }
      );
      expect(updatedFirstRepo.isDefault).toBe(false);
    });
  });

  describe("Authorization & Data Isolation", () => {
    it("should deny access to non-project members", async () => {
      const { project, repository } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      // Test that outsider cannot access project repositories
      try {
        await testProtectedProcedure(
          repositoriesRouter.list,
          outsider,
          { projectId: project.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Project not found or unauthorized");
      }
      
      try {
        await testProtectedProcedure(
          repositoriesRouter.get,
          outsider,
          { id: repository.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });

    it("should isolate repositories between different projects", async () => {
      const user1 = await createTestUser({ displayName: "User 1" });
      const user2 = await createTestUser({ displayName: "User 2" });
      const project1 = await createTestProject(user1.id, { name: "Project 1" });
      const project2 = await createTestProject(user2.id, { name: "Project 2" });
      
      const repo1 = await createTestRepository(project1.id, { name: "Repo 1", repoPath: "/tmp/repo1" });
      const repo2 = await createTestRepository(project2.id, { name: "Repo 2", repoPath: "/tmp/repo2" });
      
      // User1 should only see repo1
      const user1Repos = await testProtectedProcedure(
        repositoriesRouter.list,
        user1,
        { projectId: project1.id }
      );
      expect(user1Repos).toHaveLength(1);
      expect(user1Repos[0].id).toBe(repo1.id);
      
      // User2 should only see repo2
      const user2Repos = await testProtectedProcedure(
        repositoriesRouter.list,
        user2,
        { projectId: project2.id }
      );
      expect(user2Repos).toHaveLength(1);
      expect(user2Repos[0].id).toBe(repo2.id);
      
      // Cross-access should be denied
      try {
        await testProtectedProcedure(repositoriesRouter.get, user1, { id: repo2.id });
        throw new Error("Expected cross-project access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });
  });

  describe("Input Validation", () => {
    it("should return empty list for project with no repositories", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const result = await testProtectedProcedure(
        repositoriesRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(result).toHaveLength(0);
    });

    it("should handle non-existent repository ID", async () => {
      const user = await createTestUser();
      const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";
      
      try {
        await testProtectedProcedure(
          repositoriesRouter.get,
          user,
          { id: nonExistentId }
        );
        throw new Error("Expected repository not found error");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });

    it("should use default values for optional fields", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      const result = await testProtectedProcedure(
        repositoriesRouter.create,
        user,
        {
          projectId: project.id,
          name: "Simple Repo",
          repoPath: "/tmp/simple"
        }
      );
      
      expect(result.isDefault).toBe(false);
      expect(result.maxConcurrencyLimit).toBe(1);
    });

    it("should handle partial updates", async () => {
      const { user, repository } = await createCompleteTestSetup();
      const originalName = repository.name;
      const originalPath = repository.repoPath;
      
      const result = await testProtectedProcedure(
        repositoriesRouter.update,
        user,
        {
          id: repository.id,
          maxConcurrencyLimit: 3
        }
      );
      
      expect(result.name).toBe(originalName); // Should remain unchanged
      expect(result.repoPath).toBe(originalPath); // Should remain unchanged
      expect(result.maxConcurrencyLimit).toBe(3);
    });
  });
});