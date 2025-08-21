/**
 * Repositories Router Tests
 * Tests for all CRUD endpoints with authentication and authorization verification
 */
import { describe, it, expect } from "bun:test";

import { setupDatabaseTests } from "../test-utils";
import { createTestUser, createTestProject, createTestRepository, createCompleteTestSetup } from "../fixtures";
import { 
  testRealRPCWithAuth,
  testRealRPCWithoutAuth,
  assertRealRPCUnauthorized,
  testRealProjectScopedEndpoint,
  testProjectMembershipValidation
} from "../rpc-test-helpers";
import { repositoriesRouter } from "../../routers/repositories";

// Setup database for these tests
setupDatabaseTests();

describe("Repositories Router", () => {
  describe("list endpoint", () => {
    it("should require authentication", async () => {
      const sampleInput = { projectId: "550e8400-e29b-41d4-a716-446655440000" };
      await assertRealRPCUnauthorized(repositoriesRouter.list, sampleInput);
    });

    it("should list repositories for project member", async () => {
      const { user, project, repository } = await createCompleteTestSetup();
      
      const result = await testRealRPCWithAuth(
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

    it("should deny access to non-project members", async () => {
      const { project } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.list,
          outsider,
          { projectId: project.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Project not found or unauthorized");
      }
    });

    it("should return empty array for project with no repositories", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const result = await testRealRPCWithAuth(
        repositoriesRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(result).toHaveLength(0);
    });

    it("should order by default status and creation date", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      // Create additional repositories
      const repo2 = await createTestRepository(project.id, { 
        name: "Repo 2", 
        isDefault: false,
        repoPath: "/tmp/repo2"
      });
      const repo3 = await createTestRepository(project.id, { 
        name: "Repo 3", 
        isDefault: false,
        repoPath: "/tmp/repo3"
      });
      
      const result = await testRealRPCWithAuth(
        repositoriesRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(result).toHaveLength(3);
      // Default repository should be first
      expect(result[0].isDefault).toBe(true);
    });

    it("should validate project ID format", async () => {
      const user = await createTestUser();
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.list,
          user,
          { projectId: "invalid-uuid" }
        );
        throw new Error("Expected validation error");
      } catch (error: any) {
        expect(error.message).toContain("Invalid");
      }
    });
  });

  describe("get endpoint", () => {
    it("should require authentication", async () => {
      const sampleInput = { id: "550e8400-e29b-41d4-a716-446655440000" };
      await assertRealRPCUnauthorized(repositoriesRouter.get, sampleInput);
    });

    it("should return repository for project member", async () => {
      const { user, repository } = await createCompleteTestSetup();
      
      const result = await testRealRPCWithAuth(
        repositoriesRouter.get,
        user,
        { id: repository.id }
      );
      
      expect(result.id).toBe(repository.id);
      expect(result.name).toBe(repository.name);
      expect(result.repoPath).toBe(repository.repoPath);
      expect(result.isDefault).toBe(repository.isDefault);
      expect(result.maxConcurrencyLimit).toBe(repository.maxConcurrencyLimit);
    });

    it("should deny access to non-project members", async () => {
      const { repository } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.get,
          outsider,
          { id: repository.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });

    it("should handle non-existent repository ID", async () => {
      const user = await createTestUser();
      const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.get,
          user,
          { id: nonExistentId }
        );
        throw new Error("Expected repository not found error");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });

    it("should validate repository ID format", async () => {
      const user = await createTestUser();
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.get,
          user,
          { id: "invalid-uuid" }
        );
        throw new Error("Expected validation error");
      } catch (error: any) {
        expect(error.message).toContain("Invalid");
      }
    });
  });

  describe("create endpoint", () => {
    it("should require authentication", async () => {
      const sampleInput = {
        projectId: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test Repo",
        repoPath: "/tmp/test-repo"
      };
      await assertRealRPCUnauthorized(repositoriesRouter.create, sampleInput);
    });

    it("should create repository for project member", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      const repoData = {
        projectId: project.id,
        name: "New Test Repository",
        repoPath: "/tmp/new-test-repo",
        isDefault: false,
        maxConcurrencyLimit: 3
      };
      
      const result = await testRealRPCWithAuth(
        repositoriesRouter.create,
        user,
        repoData
      );
      
      expect(result.name).toBe(repoData.name);
      expect(result.repoPath).toBe(repoData.repoPath);
      expect(result.projectId).toBe(project.id);
      expect(result.isDefault).toBe(repoData.isDefault);
      expect(result.maxConcurrencyLimit).toBe(repoData.maxConcurrencyLimit);
      expect(result.id).toBeDefined();
    });

    it("should deny access to non-project members", async () => {
      const { project } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.create,
          outsider,
          {
            projectId: project.id,
            name: "Unauthorized Repo",
            repoPath: "/tmp/unauthorized"
          }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Project not found or unauthorized");
      }
    });

    it("should handle setting new default repository", async () => {
      const { user, project, repository: existingRepo } = await createCompleteTestSetup();
      
      // Verify existing repo is default
      expect(existingRepo.isDefault).toBe(true);
      
      const newDefaultRepo = await testRealRPCWithAuth(
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
      const updatedExistingRepo = await testRealRPCWithAuth(
        repositoriesRouter.get,
        user,
        { id: existingRepo.id }
      );
      expect(updatedExistingRepo.isDefault).toBe(false);
    });

    it("should validate required fields", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      // Test missing name
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.create,
          user,
          {
            projectId: project.id,
            name: "",
            repoPath: "/tmp/test"
          }
        );
        throw new Error("Expected validation error");
      } catch (error: any) {
        expect(error.message).toContain("Invalid");
      }
      
      // Test missing repoPath
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.create,
          user,
          {
            projectId: project.id,
            name: "Test Repo",
            repoPath: ""
          }
        );
        throw new Error("Expected validation error");
      } catch (error: any) {
        expect(error.message).toContain("Invalid");
      }
    });

    it("should use default values for optional fields", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      const result = await testRealRPCWithAuth(
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

    it("should validate maxConcurrencyLimit range", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.create,
          user,
          {
            projectId: project.id,
            name: "Invalid Repo",
            repoPath: "/tmp/invalid",
            maxConcurrencyLimit: 0 // Below minimum
          }
        );
        throw new Error("Expected validation error");
      } catch (error: any) {
        expect(error.message).toContain("Invalid");
      }
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.create,
          user,
          {
            projectId: project.id,
            name: "Invalid Repo 2",
            repoPath: "/tmp/invalid2",
            maxConcurrencyLimit: 11 // Above maximum
          }
        );
        throw new Error("Expected validation error");
      } catch (error: any) {
        expect(error.message).toContain("Invalid");
      }
    });
  });

  describe("update endpoint", () => {
    it("should require authentication", async () => {
      const sampleInput = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Updated Repo"
      };
      await assertRealRPCUnauthorized(repositoriesRouter.update, sampleInput);
    });

    it("should update repository for project member", async () => {
      const { user, repository } = await createCompleteTestSetup();
      
      const updates = {
        id: repository.id,
        name: "Updated Repository Name",
        repoPath: "/tmp/updated-path",
        maxConcurrencyLimit: 5
      };
      
      const result = await testRealRPCWithAuth(
        repositoriesRouter.update,
        user,
        updates
      );
      
      expect(result.id).toBe(repository.id);
      expect(result.name).toBe(updates.name);
      expect(result.repoPath).toBe(updates.repoPath);
      expect(result.maxConcurrencyLimit).toBe(updates.maxConcurrencyLimit);
      expect(result.updatedAt).toBeDefined();
    });

    it("should deny access to non-project members", async () => {
      const { repository } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.update,
          outsider,
          {
            id: repository.id,
            name: "Unauthorized Update"
          }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });

    it("should handle setting as new default", async () => {
      const { user, project, repository: existingRepo } = await createCompleteTestSetup();
      
      // Create a second repository
      const secondRepo = await createTestRepository(project.id, {
        name: "Second Repo",
        repoPath: "/tmp/second",
        isDefault: false
      });
      
      // Make second repo the default
      const result = await testRealRPCWithAuth(
        repositoriesRouter.update,
        user,
        {
          id: secondRepo.id,
          isDefault: true
        }
      );
      
      expect(result.isDefault).toBe(true);
      
      // Verify first repo is no longer default
      const updatedFirstRepo = await testRealRPCWithAuth(
        repositoriesRouter.get,
        user,
        { id: existingRepo.id }
      );
      expect(updatedFirstRepo.isDefault).toBe(false);
    });

    it("should handle partial updates", async () => {
      const { user, repository } = await createCompleteTestSetup();
      const originalName = repository.name;
      const originalPath = repository.repoPath;
      
      const result = await testRealRPCWithAuth(
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

    it("should handle non-existent repository ID", async () => {
      const user = await createTestUser();
      const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.update,
          user,
          {
            id: nonExistentId,
            name: "Update Non-existent"
          }
        );
        throw new Error("Expected repository not found error");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });

    it("should validate update values", async () => {
      const { user, repository } = await createCompleteTestSetup();
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.update,
          user,
          {
            id: repository.id,
            name: "" // Invalid empty name
          }
        );
        throw new Error("Expected validation error");
      } catch (error: any) {
        expect(error.message).toContain("Invalid");
      }
    });
  });

  describe("delete endpoint", () => {
    it("should require authentication", async () => {
      const sampleInput = { id: "550e8400-e29b-41d4-a716-446655440000" };
      await assertRealRPCUnauthorized(repositoriesRouter.delete, sampleInput);
    });

    it("should delete repository for project member", async () => {
      const { user, repository } = await createCompleteTestSetup();
      
      const result = await testRealRPCWithAuth(
        repositoriesRouter.delete,
        user,
        { id: repository.id }
      );
      
      expect(result.success).toBe(true);
      
      // Verify repository is actually deleted
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.get,
          user,
          { id: repository.id }
        );
        throw new Error("Expected repository to be deleted");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });

    it("should deny access to non-project members", async () => {
      const { repository } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.delete,
          outsider,
          { id: repository.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });

    it("should handle non-existent repository ID", async () => {
      const user = await createTestUser();
      const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";
      
      try {
        await testRealRPCWithAuth(
          repositoriesRouter.delete,
          user,
          { id: nonExistentId }
        );
        throw new Error("Expected repository not found error");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });
  });

  describe("Data isolation and project membership", () => {
    it("should isolate repositories between different projects", async () => {
      const user1 = await createTestUser({ displayName: "User 1" });
      const user2 = await createTestUser({ displayName: "User 2" });
      const project1 = await createTestProject(user1.id, { name: "Project 1" });
      const project2 = await createTestProject(user2.id, { name: "Project 2" });
      
      const repo1 = await createTestRepository(project1.id, { name: "Repo 1", repoPath: "/tmp/repo1" });
      const repo2 = await createTestRepository(project2.id, { name: "Repo 2", repoPath: "/tmp/repo2" });
      
      // User1 should only see repo1
      const user1Repos = await testRealRPCWithAuth(
        repositoriesRouter.list,
        user1,
        { projectId: project1.id }
      );
      expect(user1Repos).toHaveLength(1);
      expect(user1Repos[0].id).toBe(repo1.id);
      
      // User2 should only see repo2
      const user2Repos = await testRealRPCWithAuth(
        repositoriesRouter.list,
        user2,
        { projectId: project2.id }
      );
      expect(user2Repos).toHaveLength(1);
      expect(user2Repos[0].id).toBe(repo2.id);
      
      // Cross-access should be denied
      try {
        await testRealRPCWithAuth(repositoriesRouter.get, user1, { id: repo2.id });
        throw new Error("Expected cross-project access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Repository not found or unauthorized");
      }
    });

    it("should verify project membership for all operations", async () => {
      const { user, project, repository } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      // Test all endpoints deny access to non-members
      const deniedOperations = [
        () => testRealRPCWithAuth(repositoriesRouter.list, outsider, { projectId: project.id }),
        () => testRealRPCWithAuth(repositoriesRouter.get, outsider, { id: repository.id }),
        () => testRealRPCWithAuth(repositoriesRouter.create, outsider, { projectId: project.id, name: "Test", repoPath: "/tmp/test" }),
        () => testRealRPCWithAuth(repositoriesRouter.update, outsider, { id: repository.id, name: "Test" }),
        () => testRealRPCWithAuth(repositoriesRouter.delete, outsider, { id: repository.id }),
      ];
      
      for (const operation of deniedOperations) {
        try {
          await operation();
          throw new Error("Expected operation to be denied");
        } catch (error: any) {
          expect(error.message).toMatch(/not found|unauthorized/i);
        }
      }
    });

    it("should handle multiple repositories with default status correctly", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      // Create multiple repositories, only one should be default at a time
      const repo1 = await createTestRepository(project.id, { 
        name: "Repo 1", 
        repoPath: "/tmp/repo1",
        isDefault: true 
      });
      
      const repo2 = await createTestRepository(project.id, { 
        name: "Repo 2", 
        repoPath: "/tmp/repo2",
        isDefault: true  // This should make repo1 non-default
      });
      
      // Check that only repo2 is default
      const repos = await testRealRPCWithAuth(
        repositoriesRouter.list,
        user,
        { projectId: project.id }
      );
      
      const defaultRepos = repos.filter(r => r.isDefault);
      expect(defaultRepos).toHaveLength(1);
      expect(defaultRepos[0].id).toBe(repo2.id);
    });
  });
});