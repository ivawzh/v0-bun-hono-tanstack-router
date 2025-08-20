/**
 * Repositories Router Tests
 * Tests for repository-related endpoints including authentication and authorization
 */
import { describe, it, expect } from "bun:test";

import { setupDatabaseTests } from "./test-utils";
import { 
  createTestUser, 
  createTestProject,
  createTestRepository,
  createTestUsers,
  createComplexTestScenario
} from "./fixtures";
import { 
  testRealRPCWithAuth,
  assertRealRPCUnauthorized,
  testProjectMembershipValidation
} from "./rpc-test-helpers";
import { repositoriesRouter } from "../routers/repositories";

// Setup database for these tests
setupDatabaseTests();

describe("Repositories Router", () => {
  describe("Authentication Requirements", () => {
    it("should require authentication for all endpoints", async () => {
      // Test that all repositories router endpoints require authentication
      const sampleRepoId = "123e4567-e89b-12d3-a456-426614174000";
      const sampleProjectId = "123e4567-e89b-12d3-a456-426614174001";
      
      const endpointsToTest = [
        { name: "list", input: { projectId: sampleProjectId } },
        { name: "get", input: { id: sampleRepoId } },
        { name: "create", input: { projectId: sampleProjectId, name: "Test Repo", repoPath: "/test/path" } },
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

  describe("Project Membership Authorization", () => {
    it("should require project membership for all endpoints", async () => {
      const { users } = await createTestUsers();
      const user1 = users[0];
      const user2 = users[1];
      
      // User1 creates a project
      const project = await createTestProject(user1.id);
      
      // User1 creates a repository in their project
      const repository = await createTestRepository(project.id);
      
      const endpointsToTest = [
        {
          endpoint: repositoriesRouter.list,
          input: { projectId: project.id },
          description: "list repositories"
        },
        {
          endpoint: repositoriesRouter.get,
          input: { id: repository.id },
          description: "get repository"
        },
        {
          endpoint: repositoriesRouter.create,
          input: { projectId: project.id, name: "Unauthorized Repo", repoPath: "/unauthorized/path" },
          description: "create repository"
        },
        {
          endpoint: repositoriesRouter.update,
          input: { id: repository.id, name: "Updated Name" },
          description: "update repository"
        },
        {
          endpoint: repositoriesRouter.delete,
          input: { id: repository.id },
          description: "delete repository"
        }
      ];
      
      for (const test of endpointsToTest) {
        await testProjectMembershipValidation(
          test.endpoint,
          test.input,
          user1,
          user2,
          test.description
        );
      }
    });
  });

  describe("Data Isolation", () => {
    it("should only return repositories from user's projects", async () => {
      const { users } = await createTestUsers();
      const user1 = users[0];
      const user2 = users[1];
      
      // Create projects for both users
      const project1 = await createTestProject(user1.id);
      const project2 = await createTestProject(user2.id);
      
      // Create repositories in both projects
      const repo1 = await createTestRepository(project1.id);
      const repo2 = await createTestRepository(project2.id);
      
      // User1 should only see repositories from their project
      const user1Repos = await testRealRPCWithAuth(
        repositoriesRouter.list,
        user1,
        { projectId: project1.id }
      );
      
      expect(user1Repos).toHaveLength(1);
      expect(user1Repos[0].id).toBe(repo1.id);
      
      // User2 should only see repositories from their project
      const user2Repos = await testRealRPCWithAuth(
        repositoriesRouter.list,
        user2,
        { projectId: project2.id }
      );
      
      expect(user2Repos).toHaveLength(1);
      expect(user2Repos[0].id).toBe(repo2.id);
    });

    it("should prevent cross-project repository access", async () => {
      const { users } = await createTestUsers();
      const user1 = users[0];
      const user2 = users[1];
      
      // User1 creates a project and repository
      const project1 = await createTestProject(user1.id);
      const repo1 = await createTestRepository(project1.id);
      
      // User2 creates a project
      const project2 = await createTestProject(user2.id);
      
      // User2 should not be able to access User1's repository
      await expect(
        testRealRPCWithAuth(
          repositoriesRouter.get,
          user2,
          { id: repo1.id }
        )
      ).rejects.toThrow(/Repository not found or unauthorized/);
    });
  });

  describe("CRUD Operations", () => {
    it("should create repositories with proper data", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const repoData = {
        projectId: project.id,
        name: "Main Repository",
        repoPath: "/home/user/projects/main-repo",
        isDefault: true,
        maxConcurrencyLimit: 3
      };
      
      const repository = await testRealRPCWithAuth(
        repositoriesRouter.create,
        user,
        repoData
      );
      
      expect(repository.name).toBe(repoData.name);
      expect(repository.repoPath).toBe(repoData.repoPath);
      expect(repository.isDefault).toBe(repoData.isDefault);
      expect(repository.maxConcurrencyLimit).toBe(repoData.maxConcurrencyLimit);
      expect(repository.projectId).toBe(project.id);
    });

    it("should handle default repository logic", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create first repository as default
      const repo1 = await testRealRPCWithAuth(
        repositoriesRouter.create,
        user,
        {
          projectId: project.id,
          name: "First Repo",
          repoPath: "/path/to/first",
          isDefault: true
        }
      );
      
      expect(repo1.isDefault).toBe(true);
      
      // Create second repository as default - should unset the first
      const repo2 = await testRealRPCWithAuth(
        repositoriesRouter.create,
        user,
        {
          projectId: project.id,
          name: "Second Repo",
          repoPath: "/path/to/second",
          isDefault: true
        }
      );
      
      expect(repo2.isDefault).toBe(true);
      
      // Verify first repo is no longer default
      const updatedRepo1 = await testRealRPCWithAuth(
        repositoriesRouter.get,
        user,
        { id: repo1.id }
      );
      
      expect(updatedRepo1.isDefault).toBe(false);
    });

    it("should list repositories with proper ordering", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create multiple repositories
      const repo1 = await createTestRepository(project.id, { name: "Regular Repo", isDefault: false });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const repo2 = await createTestRepository(project.id, { name: "Default Repo", isDefault: true });
      
      const repositories = await testRealRPCWithAuth(
        repositoriesRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(repositories).toHaveLength(2);
      // Should be ordered by isDefault first, then by creation date
      expect(repositories[0].id).toBe(repo2.id); // Default repo first
      expect(repositories[1].id).toBe(repo1.id);
    });

    it("should get individual repositories", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const repository = await createTestRepository(project.id);
      
      const retrievedRepo = await testRealRPCWithAuth(
        repositoriesRouter.get,
        user,
        { id: repository.id }
      );
      
      expect(retrievedRepo.id).toBe(repository.id);
      expect(retrievedRepo.name).toBe(repository.name);
      expect(retrievedRepo.projectId).toBe(project.id);
    });

    it("should update repositories", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const repository = await createTestRepository(project.id);
      
      const updates = {
        id: repository.id,
        name: "Updated Repository Name",
        repoPath: "/updated/path",
        maxConcurrencyLimit: 5
      };
      
      const updatedRepo = await testRealRPCWithAuth(
        repositoriesRouter.update,
        user,
        updates
      );
      
      expect(updatedRepo.name).toBe(updates.name);
      expect(updatedRepo.repoPath).toBe(updates.repoPath);
      expect(updatedRepo.maxConcurrencyLimit).toBe(updates.maxConcurrencyLimit);
      expect(updatedRepo.updatedAt).not.toBe(repository.updatedAt);
    });

    it("should handle default repository updates", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create two repositories
      const repo1 = await createTestRepository(project.id, { name: "Repo 1", isDefault: true });
      const repo2 = await createTestRepository(project.id, { name: "Repo 2", isDefault: false });
      
      // Update repo2 to be default
      const updatedRepo2 = await testRealRPCWithAuth(
        repositoriesRouter.update,
        user,
        {
          id: repo2.id,
          isDefault: true
        }
      );
      
      expect(updatedRepo2.isDefault).toBe(true);
      
      // Verify repo1 is no longer default
      const updatedRepo1 = await testRealRPCWithAuth(
        repositoriesRouter.get,
        user,
        { id: repo1.id }
      );
      
      expect(updatedRepo1.isDefault).toBe(false);
    });

    it("should delete repositories", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const repository = await createTestRepository(project.id);
      
      const result = await testRealRPCWithAuth(
        repositoriesRouter.delete,
        user,
        { id: repository.id }
      );
      
      expect(result.success).toBe(true);
      
      // Verify repository is deleted
      await expect(
        testRealRPCWithAuth(
          repositoriesRouter.get,
          user,
          { id: repository.id }
        )
      ).rejects.toThrow(/Repository not found or unauthorized/);
    });
  });

  describe("Validation", () => {
    it("should validate repository paths", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Test empty path
      await expect(
        testRealRPCWithAuth(
          repositoriesRouter.create,
          user,
          {
            projectId: project.id,
            name: "Empty Path Repo",
            repoPath: ""
          }
        )
      ).rejects.toThrow();
      
      // Test valid path
      const validRepo = await testRealRPCWithAuth(
        repositoriesRouter.create,
        user,
        {
          projectId: project.id,
          name: "Valid Repo",
          repoPath: "/valid/path"
        }
      );
      
      expect(validRepo.repoPath).toBe("/valid/path");
    });

    it("should validate concurrency limits", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Test minimum concurrency limit
      const minRepo = await testRealRPCWithAuth(
        repositoriesRouter.create,
        user,
        {
          projectId: project.id,
          name: "Min Concurrency Repo",
          repoPath: "/min/path",
          maxConcurrencyLimit: 1
        }
      );
      
      expect(minRepo.maxConcurrencyLimit).toBe(1);
      
      // Test maximum concurrency limit
      const maxRepo = await testRealRPCWithAuth(
        repositoriesRouter.create,
        user,
        {
          projectId: project.id,
          name: "Max Concurrency Repo",
          repoPath: "/max/path",
          maxConcurrencyLimit: 10
        }
      );
      
      expect(maxRepo.maxConcurrencyLimit).toBe(10);
    });

    it("should validate name length", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Test empty name
      await expect(
        testRealRPCWithAuth(
          repositoriesRouter.create,
          user,
          {
            projectId: project.id,
            name: "",
            repoPath: "/valid/path"
          }
        )
      ).rejects.toThrow();
      
      // Test maximum length name (100 characters)
      const longName = "a".repeat(100);
      const validRepo = await testRealRPCWithAuth(
        repositoriesRouter.create,
        user,
        {
          projectId: project.id,
          name: longName,
          repoPath: "/valid/path"
        }
      );
      
      expect(validRepo.name).toBe(longName);
      
      // Test too long name (101 characters)
      const tooLongName = "a".repeat(101);
      await expect(
        testRealRPCWithAuth(
          repositoriesRouter.create,
          user,
          {
            projectId: project.id,
            name: tooLongName,
            repoPath: "/valid/path"
          }
        )
      ).rejects.toThrow();
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle multiple repositories in multiple projects", async () => {
      const scenario = await createComplexTestScenario();
      
      // Test that each user can only access their project's repositories
      const user1Repos = await testRealRPCWithAuth(
        repositoriesRouter.list,
        scenario.users[0],
        { projectId: scenario.projects[0].id }
      );
      
      const user2Repos = await testRealRPCWithAuth(
        repositoriesRouter.list,
        scenario.users[1],
        { projectId: scenario.projects[1].id }
      );
      
      // Each project should have its own repositories
      expect(user1Repos.length).toBeGreaterThan(0);
      expect(user2Repos.length).toBeGreaterThan(0);
      
      // Repositories should be project-isolated
      const user1RepoIds = user1Repos.map(r => r.id);
      const user2RepoIds = user2Repos.map(r => r.id);
      expect(user1RepoIds).not.toEqual(user2RepoIds);
    });

    it("should handle concurrent operations safely", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create multiple repositories concurrently
      const promises = Array.from({ length: 3 }, (_, i) =>
        testRealRPCWithAuth(
          repositoriesRouter.create,
          user,
          {
            projectId: project.id,
            name: `Concurrent Repo ${i}`,
            repoPath: `/concurrent/path/${i}`
          }
        )
      );
      
      const repositories = await Promise.all(promises);
      expect(repositories).toHaveLength(3);
      
      // All should be different
      const ids = repositories.map(r => r.id);
      expect(new Set(ids).size).toBe(3);
      
      // All should have different paths
      const paths = repositories.map(r => r.repoPath);
      expect(new Set(paths).size).toBe(3);
    });

    it("should maintain default repository integrity across operations", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create multiple repositories with different default states
      const repo1 = await createTestRepository(project.id, { name: "Repo 1", isDefault: false });
      const repo2 = await createTestRepository(project.id, { name: "Repo 2", isDefault: true });
      const repo3 = await createTestRepository(project.id, { name: "Repo 3", isDefault: false });
      
      // List repositories to verify ordering and default state
      let repos = await testRealRPCWithAuth(
        repositoriesRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(repos[0].isDefault).toBe(true); // Default should be first
      
      // Update another repository to be default
      await testRealRPCWithAuth(
        repositoriesRouter.update,
        user,
        {
          id: repo3.id,
          isDefault: true
        }
      );
      
      // Verify only one repository is default
      repos = await testRealRPCWithAuth(
        repositoriesRouter.list,
        user,
        { projectId: project.id }
      );
      
      const defaultRepos = repos.filter(r => r.isDefault);
      expect(defaultRepos).toHaveLength(1);
      expect(defaultRepos[0].id).toBe(repo3.id);
    });
  });
});