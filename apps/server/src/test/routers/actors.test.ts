/**
 * Actors Router Tests
 * Tests for all CRUD endpoints with authentication and authorization verification
 */
import { describe, it, expect } from "bun:test";

import { setupDatabaseTests } from "../test-utils";
import { createTestUser, createTestProject, createTestActor, createCompleteTestSetup } from "../fixtures";
import { 
  testProtectedProcedure,
  assertRealRPCUnauthorized
} from "../rpc-test-helpers";
import { actorsRouter } from "../../routers/actors";

// Setup database for these tests
setupDatabaseTests();

describe("Actors Router", () => {
  describe("Authentication Requirements", () => {
    it("should require authentication for all endpoints", async () => {
      const sampleProjectId = "550e8400-e29b-41d4-a716-446655440000";
      const sampleActorId = "550e8400-e29b-41d4-a716-446655440001";
      
      const endpointsToTest = [
        { name: "list", input: { projectId: sampleProjectId } },
        { name: "get", input: { id: sampleActorId } },
        { name: "create", input: { projectId: sampleProjectId, name: "Test Actor", description: "A test actor" } },
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

  describe("Basic CRUD Operations", () => {
    it("should list actors for project member", async () => {
      const { user, project, actor } = await createCompleteTestSetup();
      
      const result = await testProtectedProcedure(
        actorsRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(actor.id);
      expect(result[0].name).toBe(actor.name);
      expect(result[0].description).toBe(actor.description);
      expect(result[0].isDefault).toBe(actor.isDefault);
    });

    it("should get specific actor for project member", async () => {
      const { user, actor } = await createCompleteTestSetup();
      
      const result = await testProtectedProcedure(
        actorsRouter.get,
        user,
        { id: actor.id }
      );
      
      expect(result.id).toBe(actor.id);
      expect(result.name).toBe(actor.name);
      expect(result.description).toBe(actor.description);
      expect(result.isDefault).toBe(actor.isDefault);
    });

    it("should create new actor for project member", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      const actorData = {
        projectId: project.id,
        name: "New Test Actor",
        description: "A comprehensive test actor for advanced development workflows",
        isDefault: false
      };
      
      const result = await testProtectedProcedure(
        actorsRouter.create,
        user,
        actorData
      );
      
      expect(result.name).toBe(actorData.name);
      expect(result.description).toBe(actorData.description);
      expect(result.projectId).toBe(project.id);
      expect(result.isDefault).toBe(actorData.isDefault);
    });

    it("should update actor for project member", async () => {
      const { user, actor } = await createCompleteTestSetup();
      
      const updates = {
        id: actor.id,
        name: "Updated Actor Name",
        description: "An updated actor description with more details"
      };
      
      const result = await testProtectedProcedure(
        actorsRouter.update,
        user,
        updates
      );
      
      expect(result.id).toBe(actor.id);
      expect(result.name).toBe(updates.name);
      expect(result.description).toBe(updates.description);
    });

    it("should delete non-default actor for project member", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      // Create a non-default actor to delete
      const actorToDelete = await createTestActor(project.id, {
        name: "Actor to Delete",
        description: "This actor will be deleted",
        isDefault: false
      });
      
      const result = await testProtectedProcedure(
        actorsRouter.delete,
        user,
        { id: actorToDelete.id }
      );
      
      expect(result.success).toBe(true);
    });
  });

  describe("Default Actor Management", () => {
    it("should handle setting new default actor", async () => {
      const { user, project, actor: existingActor } = await createCompleteTestSetup();
      
      // Verify existing actor is default
      expect(existingActor.isDefault).toBe(true);
      
      const newDefaultActor = await testProtectedProcedure(
        actorsRouter.create,
        user,
        {
          projectId: project.id,
          name: "New Default Actor",
          description: "The new default actor",
          isDefault: true
        }
      );
      
      expect(newDefaultActor.isDefault).toBe(true);
      
      // Verify old default is no longer default
      const updatedExistingActor = await testProtectedProcedure(
        actorsRouter.get,
        user,
        { id: existingActor.id }
      );
      expect(updatedExistingActor.isDefault).toBe(false);
    });

    it("should update default status correctly", async () => {
      const { user, project, actor: existingActor } = await createCompleteTestSetup();
      
      // Create a second actor
      const secondActor = await createTestActor(project.id, {
        name: "Second Actor",
        description: "Second actor description",
        isDefault: false
      });
      
      // Make second actor the default
      const result = await testProtectedProcedure(
        actorsRouter.update,
        user,
        {
          id: secondActor.id,
          isDefault: true
        }
      );
      
      expect(result.isDefault).toBe(true);
      
      // Verify first actor is no longer default
      const updatedFirstActor = await testProtectedProcedure(
        actorsRouter.get,
        user,
        { id: existingActor.id }
      );
      expect(updatedFirstActor.isDefault).toBe(false);
    });

    it("should prevent deletion of the only actor in project", async () => {
      const { user, actor } = await createCompleteTestSetup();
      
      // Try to delete the only actor (which is also default)
      try {
        await testProtectedProcedure(
          actorsRouter.delete,
          user,
          { id: actor.id }
        );
        throw new Error("Expected deletion to be prevented");
      } catch (error: any) {
        expect(error.message).toContain("Cannot delete the only actor in the project");
      }
    });

    it("should reassign default when deleting default actor with others present", async () => {
      const { user, project, actor: defaultActor } = await createCompleteTestSetup();
      
      // Create a second actor
      const secondActor = await createTestActor(project.id, {
        name: "Second Actor",
        description: "Second actor description",
        isDefault: false
      });
      
      // Delete the default actor
      const result = await testProtectedProcedure(
        actorsRouter.delete,
        user,
        { id: defaultActor.id }
      );
      
      expect(result.success).toBe(true);
      
      // Verify second actor is now default
      const updatedSecondActor = await testProtectedProcedure(
        actorsRouter.get,
        user,
        { id: secondActor.id }
      );
      expect(updatedSecondActor.isDefault).toBe(true);
    });
  });

  describe("Authorization & Data Isolation", () => {
    it("should deny access to non-project members", async () => {
      const { project, actor } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      // Test that outsider cannot access project actors
      try {
        await testProtectedProcedure(
          actorsRouter.list,
          outsider,
          { projectId: project.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Project not found or unauthorized");
      }
      
      try {
        await testProtectedProcedure(
          actorsRouter.get,
          outsider,
          { id: actor.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Actor not found or unauthorized");
      }
    });

    it("should isolate actors between different projects", async () => {
      const user1 = await createTestUser({ displayName: "User 1" });
      const user2 = await createTestUser({ displayName: "User 2" });
      const project1 = await createTestProject(user1.id, { name: "Project 1" });
      const project2 = await createTestProject(user2.id, { name: "Project 2" });
      
      const actor1 = await createTestActor(project1.id, { name: "Actor 1", description: "First actor" });
      const actor2 = await createTestActor(project2.id, { name: "Actor 2", description: "Second actor" });
      
      // User1 should only see actor1
      const user1Actors = await testProtectedProcedure(
        actorsRouter.list,
        user1,
        { projectId: project1.id }
      );
      expect(user1Actors).toHaveLength(1);
      expect(user1Actors[0].id).toBe(actor1.id);
      
      // User2 should only see actor2
      const user2Actors = await testProtectedProcedure(
        actorsRouter.list,
        user2,
        { projectId: project2.id }
      );
      expect(user2Actors).toHaveLength(1);
      expect(user2Actors[0].id).toBe(actor2.id);
      
      // Cross-access should be denied
      try {
        await testProtectedProcedure(actorsRouter.get, user1, { id: actor2.id });
        throw new Error("Expected cross-project access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Actor not found or unauthorized");
      }
    });
  });

  describe("Input Validation", () => {
    it("should return empty list for project with no actors", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const result = await testProtectedProcedure(
        actorsRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(result).toHaveLength(0);
    });

    it("should handle non-existent actor ID", async () => {
      const user = await createTestUser();
      const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";
      
      try {
        await testProtectedProcedure(
          actorsRouter.get,
          user,
          { id: nonExistentId }
        );
        throw new Error("Expected actor not found error");
      } catch (error: any) {
        expect(error.message).toContain("Actor not found or unauthorized");
      }
    });

    it("should use default values for optional fields", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      const result = await testProtectedProcedure(
        actorsRouter.create,
        user,
        {
          projectId: project.id,
          name: "Simple Actor",
          description: "A simple test actor"
        }
      );
      
      expect(result.isDefault).toBe(false);
    });

    it("should handle partial updates", async () => {
      const { user, actor } = await createCompleteTestSetup();
      const originalName = actor.name;
      const originalDescription = actor.description;
      
      const result = await testProtectedProcedure(
        actorsRouter.update,
        user,
        {
          id: actor.id,
          isDefault: false
        }
      );
      
      expect(result.name).toBe(originalName); // Should remain unchanged
      expect(result.description).toBe(originalDescription); // Should remain unchanged
      expect(result.isDefault).toBe(false);
    });
  });
});