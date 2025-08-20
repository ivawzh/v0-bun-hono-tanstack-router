/**
 * Test infrastructure verification
 * Ensures the test setup is working correctly
 */
import { describe, it, expect } from "bun:test";

import { setupDatabaseTests, getTestDb } from "./test-utils";
import { 
  createTestUser, 
  createTestProject,
  createTestRepository,
  createTestAgent,
  createTestActor,
  createCompleteTestSetup
} from "./fixtures";
import {
  createAuthenticatedContext,
  createUnauthenticatedContext
} from "./auth-mocks";

// Setup database for these tests
setupDatabaseTests();

describe("Test Infrastructure", () => {
  describe("Database Setup", () => {
    it("should connect to test database", async () => {
      const db = getTestDb();
      expect(db).toBeDefined();
    });
  });

  describe("Test Fixtures", () => {
    it("should create test user", async () => {
      const user = await createTestUser({
        email: "test@example.com",
        displayName: "Test User"
      });
      
      expect(user.id).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.displayName).toBe("Test User");
    });

    it("should create test project", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id, {
        name: "Test Project",
        description: "Test Description"
      });
      
      expect(project.id).toBeDefined();
      expect(project.name).toBe("Test Project");
      expect(project.description).toBe("Test Description");
      expect(project.ownerId).toBe(user.id);
    });

    it("should create test repository", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const repository = await createTestRepository(project.id, {
        name: "Test Repo",
        repoPath: "/tmp/test-repo"
      });
      
      expect(repository.id).toBeDefined();
      expect(repository.name).toBe("Test Repo");
      expect(repository.repoPath).toBe("/tmp/test-repo");
      expect(repository.projectId).toBe(project.id);
    });

    it("should create test agent", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const agent = await createTestAgent(project.id, {
        name: "Test Agent",
        agentType: "CLAUDE_CODE"
      });
      
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe("Test Agent");
      expect(agent.agentType).toBe("CLAUDE_CODE");
      expect(agent.projectId).toBe(project.id);
    });

    it("should create test actor", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const actor = await createTestActor(project.id, {
        name: "Test Actor",
        description: "Test actor description"
      });
      
      expect(actor.id).toBeDefined();
      expect(actor.name).toBe("Test Actor");
      expect(actor.description).toBe("Test actor description");
      expect(actor.projectId).toBe(project.id);
    });

    it("should create complete test setup", async () => {
      const setup = await createCompleteTestSetup({
        user: { email: "complete@test.com" },
        project: { name: "Complete Project" },
        repository: { name: "Complete Repo" },
        agent: { name: "Complete Agent" },
        actor: { name: "Complete Actor" }
      });
      
      expect(setup.user.email).toBe("complete@test.com");
      expect(setup.project.name).toBe("Complete Project");
      expect(setup.repository.name).toBe("Complete Repo");
      expect(setup.agent.name).toBe("Complete Agent");
      expect(setup.actor.name).toBe("Complete Actor");
      
      // Verify relationships
      expect(setup.project.ownerId).toBe(setup.user.id);
      expect(setup.repository.projectId).toBe(setup.project.id);
      expect(setup.agent.projectId).toBe(setup.project.id);
      expect(setup.actor.projectId).toBe(setup.project.id);
    });
  });

  describe("Authentication Mocks", () => {
    it("should create authenticated context", async () => {
      const user = await createTestUser();
      const context = createAuthenticatedContext(user);
      
      expect(context.session).toBeDefined();
      expect(context.session?.user.email).toBe(user.email);
      expect(context.session?.user.name).toBe(user.displayName);
      expect(context.appUser).toEqual(user);
    });

    it("should create unauthenticated context", () => {
      const context = createUnauthenticatedContext();
      
      expect(context.session).toBeNull();
      expect(context.appUser).toBeNull();
      expect(context.context).toBeDefined();
    });
  });
});