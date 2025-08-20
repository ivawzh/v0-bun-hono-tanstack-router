/**
 * Actors Router Tests
 * Tests for actor-related endpoints including authentication and authorization
 */
import { describe, it, expect } from "bun:test";

import { setupDatabaseTests } from "./test-utils";
import { 
  createTestUser, 
  createTestProject,
  createTestActor,
  createTestUsers,
  createComplexTestScenario
} from "./fixtures";
import { 
  testRealRPCWithAuth,
  assertRealRPCUnauthorized,
  testProjectMembershipValidation
} from "./rpc-test-helpers";
import { actorsRouter } from "../routers/actors";

// Setup database for these tests
setupDatabaseTests();

describe("Actors Router", () => {
  describe("Authentication Requirements", () => {
    it("should require authentication for all endpoints", async () => {
      // Test that all actors router endpoints require authentication
      const sampleActorId = "123e4567-e89b-12d3-a456-426614174000";
      const sampleProjectId = "123e4567-e89b-12d3-a456-426614174001";
      
      const endpointsToTest = [
        { name: "list", input: { projectId: sampleProjectId } },
        { name: "get", input: { id: sampleActorId } },
        { name: "create", input: { projectId: sampleProjectId, name: "Test Actor", description: "Test description" } },
        { name: "update", input: { id: sampleActorId, name: "Updated Actor" } },
        { name: "delete", input: { id: sampleActorId } },
      ];

      for (const endpoint of endpointsToTest) {
        await assertRealRPCUnauthorized(
          actorsRouter[endpoint.name as keyof typeof actorsRouter],
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
      
      // User1 creates an actor in their project
      const actor = await createTestActor(project.id);
      
      const endpointsToTest = [
        {
          endpoint: actorsRouter.list,
          input: { projectId: project.id },
          description: "list actors"
        },
        {
          endpoint: actorsRouter.get,
          input: { id: actor.id },
          description: "get actor"
        },
        {
          endpoint: actorsRouter.create,
          input: { projectId: project.id, name: "Unauthorized Actor", description: "Unauthorized description" },
          description: "create actor"
        },
        {
          endpoint: actorsRouter.update,
          input: { id: actor.id, name: "Updated Name" },
          description: "update actor"
        },
        {
          endpoint: actorsRouter.delete,
          input: { id: actor.id },
          description: "delete actor"
        }
      ];
      
      for (const test of endpointsToTest) {
        await testProjectMembershipValidation(
          test.endpoint,
          project.id,
          test.input,
          user1,
          user2
        );
      }
    });
  });

  describe("Data Isolation", () => {
    it("should only return actors from user's projects", async () => {
      const { users } = await createTestUsers();
      const user1 = users[0];
      const user2 = users[1];
      
      // Create projects for both users
      const project1 = await createTestProject(user1.id);
      const project2 = await createTestProject(user2.id);
      
      // Create actors in both projects
      const actor1 = await createTestActor(project1.id);
      const actor2 = await createTestActor(project2.id);
      
      // User1 should only see actors from their project
      const user1Actors = await testRealRPCWithAuth(
        actorsRouter.list,
        user1,
        { projectId: project1.id }
      );
      
      expect(user1Actors).toHaveLength(1);
      expect(user1Actors[0].id).toBe(actor1.id);
      
      // User2 should only see actors from their project
      const user2Actors = await testRealRPCWithAuth(
        actorsRouter.list,
        user2,
        { projectId: project2.id }
      );
      
      expect(user2Actors).toHaveLength(1);
      expect(user2Actors[0].id).toBe(actor2.id);
    });

    it("should prevent cross-project actor access", async () => {
      const { users } = await createTestUsers();
      const user1 = users[0];
      const user2 = users[1];
      
      // User1 creates a project and actor
      const project1 = await createTestProject(user1.id);
      const actor1 = await createTestActor(project1.id);
      
      // User2 creates a project
      const project2 = await createTestProject(user2.id);
      
      // User2 should not be able to access User1's actor
      await expect(
        testRealRPCWithAuth(
          actorsRouter.get,
          user2,
          { id: actor1.id }
        )
      ).rejects.toThrow(/Actor not found or unauthorized/);
    });
  });

  describe("CRUD Operations", () => {
    it("should create actors with proper data", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const actorData = {
        projectId: project.id,
        name: "Senior Full-Stack Engineer",
        description: "Experienced full-stack engineer specializing in React, Node.js, and TypeScript. Focuses on clean code, testing, and scalable architecture.",
        isDefault: true
      };
      
      const actor = await testRealRPCWithAuth(
        actorsRouter.create,
        user,
        actorData
      );
      
      expect(actor.name).toBe(actorData.name);
      expect(actor.description).toBe(actorData.description);
      expect(actor.isDefault).toBe(actorData.isDefault);
      expect(actor.projectId).toBe(project.id);
    });

    it("should handle default actor logic", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create first actor as default
      const actor1 = await testRealRPCWithAuth(
        actorsRouter.create,
        user,
        {
          projectId: project.id,
          name: "First Actor",
          description: "First actor description",
          isDefault: true
        }
      );
      
      expect(actor1.isDefault).toBe(true);
      
      // Create second actor as default - should unset the first
      const actor2 = await testRealRPCWithAuth(
        actorsRouter.create,
        user,
        {
          projectId: project.id,
          name: "Second Actor",
          description: "Second actor description",
          isDefault: true
        }
      );
      
      expect(actor2.isDefault).toBe(true);
      
      // Verify first actor is no longer default
      const updatedActor1 = await testRealRPCWithAuth(
        actorsRouter.get,
        user,
        { id: actor1.id }
      );
      
      expect(updatedActor1.isDefault).toBe(false);
    });

    it("should list actors with proper ordering", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create multiple actors
      const actor1 = await createTestActor(project.id, { name: "Regular Actor", isDefault: false });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const actor2 = await createTestActor(project.id, { name: "Default Actor", isDefault: true });
      
      const actors = await testRealRPCWithAuth(
        actorsRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(actors).toHaveLength(2);
      // Should be ordered by isDefault first, then by creation date
      expect(actors[0].id).toBe(actor2.id); // Default actor first
      expect(actors[1].id).toBe(actor1.id);
    });

    it("should get individual actors", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const actor = await createTestActor(project.id);
      
      const retrievedActor = await testRealRPCWithAuth(
        actorsRouter.get,
        user,
        { id: actor.id }
      );
      
      expect(retrievedActor.id).toBe(actor.id);
      expect(retrievedActor.name).toBe(actor.name);
      expect(retrievedActor.projectId).toBe(project.id);
    });

    it("should update actors", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const actor = await createTestActor(project.id);
      
      const updates = {
        id: actor.id,
        name: "Updated Actor Name",
        description: "Updated actor description with new methodology and focus areas.",
        isDefault: true
      };
      
      const updatedActor = await testRealRPCWithAuth(
        actorsRouter.update,
        user,
        updates
      );
      
      expect(updatedActor.name).toBe(updates.name);
      expect(updatedActor.description).toBe(updates.description);
      expect(updatedActor.isDefault).toBe(updates.isDefault);
      expect(updatedActor.updatedAt).not.toBe(actor.updatedAt);
    });

    it("should handle default actor updates", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create two actors
      const actor1 = await createTestActor(project.id, { name: "Actor 1", isDefault: true });
      const actor2 = await createTestActor(project.id, { name: "Actor 2", isDefault: false });
      
      // Update actor2 to be default
      const updatedActor2 = await testRealRPCWithAuth(
        actorsRouter.update,
        user,
        {
          id: actor2.id,
          isDefault: true
        }
      );
      
      expect(updatedActor2.isDefault).toBe(true);
      
      // Verify actor1 is no longer default
      const updatedActor1 = await testRealRPCWithAuth(
        actorsRouter.get,
        user,
        { id: actor1.id }
      );
      
      expect(updatedActor1.isDefault).toBe(false);
    });

    it("should delete actors", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create two actors so we can delete one
      const actor1 = await createTestActor(project.id, { name: "Actor 1", isDefault: false });
      const actor2 = await createTestActor(project.id, { name: "Actor 2", isDefault: true });
      
      const result = await testRealRPCWithAuth(
        actorsRouter.delete,
        user,
        { id: actor1.id }
      );
      
      expect(result.success).toBe(true);
      
      // Verify actor is deleted
      await expect(
        testRealRPCWithAuth(
          actorsRouter.get,
          user,
          { id: actor1.id }
        )
      ).rejects.toThrow(/Actor not found or unauthorized/);
    });

    it("should prevent deleting the only actor", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const actor = await createTestActor(project.id, { isDefault: true });
      
      // Should not be able to delete the only actor
      await expect(
        testRealRPCWithAuth(
          actorsRouter.delete,
          user,
          { id: actor.id }
        )
      ).rejects.toThrow(/Cannot delete the only actor in the project/);
    });

    it("should handle default actor deletion", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create two actors, first one default
      const actor1 = await createTestActor(project.id, { name: "Default Actor", isDefault: true });
      const actor2 = await createTestActor(project.id, { name: "Regular Actor", isDefault: false });
      
      // Delete the default actor
      const result = await testRealRPCWithAuth(
        actorsRouter.delete,
        user,
        { id: actor1.id }
      );
      
      expect(result.success).toBe(true);
      
      // Verify the remaining actor became default
      const updatedActor2 = await testRealRPCWithAuth(
        actorsRouter.get,
        user,
        { id: actor2.id }
      );
      
      expect(updatedActor2.isDefault).toBe(true);
    });
  });

  describe("Validation", () => {
    it("should validate actor names", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Test empty name
      await expect(
        testRealRPCWithAuth(
          actorsRouter.create,
          user,
          {
            projectId: project.id,
            name: "",
            description: "Valid description"
          }
        )
      ).rejects.toThrow();
      
      // Test maximum length name (255 characters)
      const longName = "a".repeat(255);
      const validActor = await testRealRPCWithAuth(
        actorsRouter.create,
        user,
        {
          projectId: project.id,
          name: longName,
          description: "Valid description"
        }
      );
      
      expect(validActor.name).toBe(longName);
      
      // Test too long name (256 characters)
      const tooLongName = "a".repeat(256);
      await expect(
        testRealRPCWithAuth(
          actorsRouter.create,
          user,
          {
            projectId: project.id,
            name: tooLongName,
            description: "Valid description"
          }
        )
      ).rejects.toThrow();
    });

    it("should validate actor descriptions", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Test empty description
      await expect(
        testRealRPCWithAuth(
          actorsRouter.create,
          user,
          {
            projectId: project.id,
            name: "Valid Name",
            description: ""
          }
        )
      ).rejects.toThrow();
      
      // Test valid long description
      const longDescription = "This is a very detailed description of an actor with specific methodologies, focus areas, and expertise. ".repeat(10);
      const validActor = await testRealRPCWithAuth(
        actorsRouter.create,
        user,
        {
          projectId: project.id,
          name: "Detailed Actor",
          description: longDescription
        }
      );
      
      expect(validActor.description).toBe(longDescription);
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle multiple actors in multiple projects", async () => {
      const scenario = await createComplexTestScenario();
      
      // Test that each user can only access their project's actors
      const user1Actors = await testRealRPCWithAuth(
        actorsRouter.list,
        scenario.users[0],
        { projectId: scenario.projects[0].id }
      );
      
      const user2Actors = await testRealRPCWithAuth(
        actorsRouter.list,
        scenario.users[1],
        { projectId: scenario.projects[1].id }
      );
      
      // Each project should have its own actors
      expect(user1Actors.length).toBeGreaterThan(0);
      expect(user2Actors.length).toBeGreaterThan(0);
      
      // Actors should be project-isolated
      const user1ActorIds = user1Actors.map(a => a.id);
      const user2ActorIds = user2Actors.map(a => a.id);
      expect(user1ActorIds).not.toEqual(user2ActorIds);
    });

    it("should handle concurrent operations safely", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create multiple actors concurrently
      const promises = Array.from({ length: 3 }, (_, i) =>
        testRealRPCWithAuth(
          actorsRouter.create,
          user,
          {
            projectId: project.id,
            name: `Concurrent Actor ${i}`,
            description: `Description for concurrent actor ${i}`
          }
        )
      );
      
      const actors = await Promise.all(promises);
      expect(actors).toHaveLength(3);
      
      // All should be different
      const ids = actors.map(a => a.id);
      expect(new Set(ids).size).toBe(3);
      
      // All should have different names
      const names = actors.map(a => a.name);
      expect(new Set(names).size).toBe(3);
    });

    it("should maintain default actor integrity across operations", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create multiple actors with different default states
      const actor1 = await createTestActor(project.id, { name: "Actor 1", isDefault: false });
      const actor2 = await createTestActor(project.id, { name: "Actor 2", isDefault: true });
      const actor3 = await createTestActor(project.id, { name: "Actor 3", isDefault: false });
      
      // List actors to verify ordering and default state
      let actors = await testRealRPCWithAuth(
        actorsRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(actors[0].isDefault).toBe(true); // Default should be first
      
      // Update another actor to be default
      await testRealRPCWithAuth(
        actorsRouter.update,
        user,
        {
          id: actor3.id,
          isDefault: true
        }
      );
      
      // Verify only one actor is default
      actors = await testRealRPCWithAuth(
        actorsRouter.list,
        user,
        { projectId: project.id }
      );
      
      const defaultActors = actors.filter(a => a.isDefault);
      expect(defaultActors).toHaveLength(1);
      expect(defaultActors[0].id).toBe(actor3.id);
    });

    it("should handle complex actor personalities", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const complexActors = [
        {
          name: "Frontend Specialist",
          description: "React/TypeScript expert with focus on UI/UX, accessibility, and modern CSS. Prefers functional components, hooks, and testing-library for tests."
        },
        {
          name: "Backend Architect",
          description: "Node.js/Python specialist focused on API design, database optimization, and scalable architecture. Emphasizes security, performance, and clean code principles."
        },
        {
          name: "DevOps Engineer",
          description: "Infrastructure and deployment expert. Specializes in Docker, Kubernetes, CI/CD pipelines, monitoring, and cloud platforms (AWS/GCP)."
        }
      ];
      
      // Create all complex actors
      const createdActors = await Promise.all(
        complexActors.map(actor =>
          testRealRPCWithAuth(
            actorsRouter.create,
            user,
            {
              projectId: project.id,
              name: actor.name,
              description: actor.description
            }
          )
        )
      );
      
      expect(createdActors).toHaveLength(3);
      
      // Verify each actor has the correct specialization
      for (let i = 0; i < createdActors.length; i++) {
        expect(createdActors[i].name).toBe(complexActors[i].name);
        expect(createdActors[i].description).toBe(complexActors[i].description);
      }
    });
  });
});