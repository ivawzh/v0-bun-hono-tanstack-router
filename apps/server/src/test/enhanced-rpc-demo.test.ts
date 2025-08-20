/**
 * Enhanced RPC Testing Infrastructure Demo
 * This file demonstrates the comprehensive testing capabilities for RPC endpoints
 */
import { describe, it, expect, setupDatabaseTests } from "./index";
import {
  createCompleteTestSetup,
  createComplexTestScenario,
  createTestUsers,
  seedTestDatabase
} from "./fixtures";
import {
  testRealRPCWithAuth,
  testRealRPCWithoutAuth,
  assertRealRPCUnauthorized,
  testRealProjectScopedEndpoint,
  testProjectMembershipValidation,
  createRealRPCTestSuite
} from "./rpc-test-helpers";
import { createProtectedContext } from "./auth-mocks";
import { appRouter } from "../routers";

// Setup database for these tests
setupDatabaseTests();

describe("Enhanced RPC Testing Infrastructure", () => {
  describe("Basic Infrastructure", () => {
    it("should test authenticated health check", async () => {
      const setup = await createCompleteTestSetup();
      const result = await testRealRPCWithAuth(
        appRouter.privateData,
        setup.user,
        {}
      );
      
      expect(result.message).toBe("This is private");
      expect(result.user.email).toBe(setup.user.email);
    });

    it("should test unauthenticated endpoints", async () => {
      const result = await testRealRPCWithoutAuth(
        appRouter.healthCheck,
        {}
      );
      
      expect(result).toBe("OK");
    });

    it("should properly handle unauthorized access", async () => {
      await assertRealRPCUnauthorized(
        appRouter.privateData,
        {}
      );
    });
  });

  describe("Project-Scoped Testing", () => {
    it("should test project list access", async () => {
      const scenario = await createComplexTestScenario();
      
      // Owner should see their projects
      const ownerProjects = await testRealRPCWithAuth(
        appRouter.projects.list,
        scenario.users.owner,
        {}
      );
      expect(ownerProjects).toHaveLength(1);
      expect(ownerProjects[0].id).toBe(scenario.project.id);
      
      // Outsider should see no projects
      const outsiderProjects = await testRealRPCWithAuth(
        appRouter.projects.list,
        scenario.users.outsider,
        {}
      );
      expect(outsiderProjects).toHaveLength(0);
    });

    it("should test project get with membership validation", async () => {
      const scenario = await createComplexTestScenario();
      
      await testProjectMembershipValidation(
        appRouter.projects.get,
        scenario.project.id,
        {},
        scenario.users.owner, // should succeed
        scenario.users.outsider // should fail
      );
    });

    it("should test project scoped endpoint authorization", async () => {
      const scenario = await createComplexTestScenario();
      
      await testRealProjectScopedEndpoint(
        appRouter.projects.get,
        scenario.project.id,
        {},
        scenario.users.owner,
        scenario.users.outsider
      );
    });
  });

  describe("Test Suite Helpers", () => {
    it("should use test suite helper for project procedures", async () => {
      const setup = await createCompleteTestSetup();
      
      const testSuite = createRealRPCTestSuite(
        "projects.list",
        appRouter.projects.list,
        {
          requiresAuth: true,
          sampleInput: {},
          setupUser: () => Promise.resolve(setup.user)
        }
      );
      
      // Test authorization requirement
      await testSuite.testRequiresAuth();
      
      // Test with authenticated user
      const result = await testSuite.testWithAuth({});
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle complex multi-user project scenarios", async () => {
      const scenario = await createComplexTestScenario();
      
      // Test that project members can access project
      const memberProjects = await testRealRPCWithAuth(
        appRouter.projects.list,
        scenario.users.member1,
        {}
      );
      expect(memberProjects).toHaveLength(1);
      
      // Test that project member can get project details
      const projectDetails = await testRealRPCWithAuth(
        appRouter.projects.get,
        scenario.users.member2,
        { id: scenario.project.id }
      );
      expect(projectDetails.id).toBe(scenario.project.id);
    });

    it("should work with seeded database", async () => {
      const seeded = await seedTestDatabase({
        userCount: 2,
        projectsPerUser: 1,
        tasksPerProject: 3
      });
      
      expect(seeded.users).toHaveLength(2);
      expect(seeded.projects).toHaveLength(2);
      expect(seeded.tasks).toHaveLength(6);
      
      // Test with seeded data
      const userProjects = await testRealRPCWithAuth(
        appRouter.projects.list,
        seeded.users[0],
        {}
      );
      expect(userProjects).toHaveLength(1);
    });
  });

  describe("Context Creation", () => {
    it("should create proper protected context", () => {
      const user = { 
        id: "user-1", 
        email: "test@example.com", 
        displayName: "Test User",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const context = createProtectedContext(user);
      
      expect(context.session.user.email).toBe(user.email);
      expect(context.user.id).toBe(user.id);
    });
  });
});