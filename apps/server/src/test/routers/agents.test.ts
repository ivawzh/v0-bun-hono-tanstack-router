/**
 * Agents Router Tests
 * Tests for all CRUD endpoints with authentication and authorization verification
 */
import { describe, it, expect } from "bun:test";

import { setupDatabaseTests } from "../test-utils";
import { createTestUser, createTestProject, createTestAgent, createCompleteTestSetup } from "../fixtures";
import { 
  testRealRPCWithAuth,
  testRealRPCWithoutAuth,
  assertRealRPCUnauthorized,
  testRealProjectScopedEndpoint,
  testProjectMembershipValidation
} from "../rpc-test-helpers";
import { agentsRouter } from "../../routers/agents";

// Setup database for these tests
setupDatabaseTests();

describe("Agents Router", () => {
  describe("list endpoint", () => {
    it("should require authentication", async () => {
      const sampleInput = { projectId: "550e8400-e29b-41d4-a716-446655440000" };
      await assertRealRPCUnauthorized(agentsRouter.list, sampleInput);
    });

    it("should list agents for project member", async () => {
      const { user, project, agent } = await createCompleteTestSetup();
      
      const result = await testRealRPCWithAuth(
        agentsRouter.list,
        user,
        { projectId: project.id, includeTaskCounts: false }
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(agent.id);
      expect(result[0].name).toBe(agent.name);
      expect(result[0].agentType).toBe(agent.agentType);
    });

    it("should deny access to non-project members", async () => {
      const { project } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.list,
          outsider,
          { projectId: project.id, includeTaskCounts: false }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Project not found or unauthorized");
      }
    });

    it("should return empty array for project with no agents", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const result = await testRealRPCWithAuth(
        agentsRouter.list,
        user,
        { projectId: project.id, includeTaskCounts: false }
      );
      
      expect(result).toHaveLength(0);
    });

    it("should validate project ID format", async () => {
      const user = await createTestUser();
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.list,
          user,
          { projectId: "invalid-uuid", includeTaskCounts: false }
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
      await assertRealRPCUnauthorized(agentsRouter.get, sampleInput);
    });

    it("should return agent for project member", async () => {
      const { user, agent } = await createCompleteTestSetup();
      
      const result = await testRealRPCWithAuth(
        agentsRouter.get,
        user,
        { id: agent.id }
      );
      
      expect(result.id).toBe(agent.id);
      expect(result.name).toBe(agent.name);
      expect(result.agentType).toBe(agent.agentType);
      expect(result.maxConcurrencyLimit).toBe(agent.maxConcurrencyLimit);
    });

    it("should deny access to non-project members", async () => {
      const { agent } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.get,
          outsider,
          { id: agent.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });

    it("should handle non-existent agent ID", async () => {
      const user = await createTestUser();
      const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.get,
          user,
          { id: nonExistentId }
        );
        throw new Error("Expected agent not found error");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });

    it("should validate agent ID format", async () => {
      const user = await createTestUser();
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.get,
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
        name: "Test Agent",
        agentType: "CLAUDE_CODE" as const
      };
      await assertRealRPCUnauthorized(agentsRouter.create, sampleInput);
    });

    it("should create agent for project member", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      const agentData = {
        projectId: project.id,
        name: "New Test Agent",
        agentType: "OPENCODE" as const,
        agentSettings: { key: "value" },
        maxConcurrencyLimit: 2
      };
      
      const result = await testRealRPCWithAuth(
        agentsRouter.create,
        user,
        agentData
      );
      
      expect(result.name).toBe(agentData.name);
      expect(result.agentType).toBe(agentData.agentType);
      expect(result.projectId).toBe(project.id);
      expect(result.agentSettings).toEqual(agentData.agentSettings);
      expect(result.maxConcurrencyLimit).toBe(agentData.maxConcurrencyLimit);
      expect(result.id).toBeDefined();
    });

    it("should deny access to non-project members", async () => {
      const { project } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.create,
          outsider,
          {
            projectId: project.id,
            name: "Unauthorized Agent",
            agentType: "CLAUDE_CODE" as const
          }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Project not found or unauthorized");
      }
    });

    it("should validate required fields", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      // Test missing name
      try {
        await testRealRPCWithAuth(
          agentsRouter.create,
          user,
          {
            projectId: project.id,
            name: "",
            agentType: "CLAUDE_CODE" as const
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
        agentsRouter.create,
        user,
        {
          projectId: project.id,
          name: "Simple Agent",
          agentType: "CLAUDE_CODE" as const
        }
      );
      
      expect(result.agentSettings).toEqual({});
      expect(result.maxConcurrencyLimit).toBe(0);
    });

    it("should validate agent type", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.create,
          user,
          {
            projectId: project.id,
            name: "Invalid Agent",
            agentType: "INVALID_TYPE" as any
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
        name: "Updated Agent"
      };
      await assertRealRPCUnauthorized(agentsRouter.update, sampleInput);
    });

    it("should update agent for project member", async () => {
      const { user, agent } = await createCompleteTestSetup();
      
      const updates = {
        id: agent.id,
        name: "Updated Agent Name",
        agentSettings: { newKey: "newValue" },
        maxConcurrencyLimit: 5
      };
      
      const result = await testRealRPCWithAuth(
        agentsRouter.update,
        user,
        updates
      );
      
      expect(result.id).toBe(agent.id);
      expect(result.name).toBe(updates.name);
      expect(result.agentSettings).toEqual(updates.agentSettings);
      expect(result.maxConcurrencyLimit).toBe(updates.maxConcurrencyLimit);
      expect(result.updatedAt).toBeDefined();
    });

    it("should deny access to non-project members", async () => {
      const { agent } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.update,
          outsider,
          {
            id: agent.id,
            name: "Unauthorized Update"
          }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });

    it("should handle partial updates", async () => {
      const { user, agent } = await createCompleteTestSetup();
      const originalName = agent.name;
      
      const result = await testRealRPCWithAuth(
        agentsRouter.update,
        user,
        {
          id: agent.id,
          maxConcurrencyLimit: 3
        }
      );
      
      expect(result.name).toBe(originalName); // Should remain unchanged
      expect(result.maxConcurrencyLimit).toBe(3);
    });

    it("should handle non-existent agent ID", async () => {
      const user = await createTestUser();
      const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.update,
          user,
          {
            id: nonExistentId,
            name: "Update Non-existent"
          }
        );
        throw new Error("Expected agent not found error");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });

    it("should validate update values", async () => {
      const { user, agent } = await createCompleteTestSetup();
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.update,
          user,
          {
            id: agent.id,
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
      await assertRealRPCUnauthorized(agentsRouter.delete, sampleInput);
    });

    it("should delete agent for project member", async () => {
      const { user, agent } = await createCompleteTestSetup();
      
      const result = await testRealRPCWithAuth(
        agentsRouter.delete,
        user,
        { id: agent.id }
      );
      
      expect(result.success).toBe(true);
      
      // Verify agent is actually deleted
      try {
        await testRealRPCWithAuth(
          agentsRouter.get,
          user,
          { id: agent.id }
        );
        throw new Error("Expected agent to be deleted");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });

    it("should deny access to non-project members", async () => {
      const { agent } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.delete,
          outsider,
          { id: agent.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });

    it("should handle non-existent agent ID", async () => {
      const user = await createTestUser();
      const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.delete,
          user,
          { id: nonExistentId }
        );
        throw new Error("Expected agent not found error");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });
  });

  describe("Duplicate endpoints (listAgents, getAgent, createAgent, updateAgent, deleteAgent)", () => {
    // These are duplicate endpoints that should behave identically to the main ones
    
    it("listAgents should work identical to list", async () => {
      const { user, project, agent } = await createCompleteTestSetup();
      
      const result = await testRealRPCWithAuth(
        agentsRouter.listAgents,
        user,
        { projectId: project.id, includeTaskCounts: false }
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(agent.id);
    });

    it("getAgent should work identical to get", async () => {
      const { user, agent } = await createCompleteTestSetup();
      
      const result = await testRealRPCWithAuth(
        agentsRouter.getAgent,
        user,
        { id: agent.id }
      );
      
      expect(result.id).toBe(agent.id);
      expect(result.name).toBe(agent.name);
    });

    it("createAgent should work identical to create", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      const agentData = {
        projectId: project.id,
        name: "Duplicate Endpoint Agent",
        agentType: "CLAUDE_CODE" as const
      };
      
      const result = await testRealRPCWithAuth(
        agentsRouter.createAgent,
        user,
        agentData
      );
      
      expect(result.name).toBe(agentData.name);
      expect(result.agentType).toBe(agentData.agentType);
    });

    it("updateAgent should work identical to update", async () => {
      const { user, agent } = await createCompleteTestSetup();
      
      const result = await testRealRPCWithAuth(
        agentsRouter.updateAgent,
        user,
        {
          id: agent.id,
          name: "Updated via Duplicate Endpoint"
        }
      );
      
      expect(result.name).toBe("Updated via Duplicate Endpoint");
    });

    it("deleteAgent should work identical to delete", async () => {
      const { user, project } = await createCompleteTestSetup();
      const additionalAgent = await createTestAgent(project.id, { name: "To Delete" });
      
      const result = await testRealRPCWithAuth(
        agentsRouter.deleteAgent,
        user,
        { id: additionalAgent.id }
      );
      
      expect(result.success).toBe(true);
    });

    it("duplicate endpoints should require authentication", async () => {
      const sampleInputs = [
        { endpoint: agentsRouter.listAgents, input: { projectId: "550e8400-e29b-41d4-a716-446655440000" } },
        { endpoint: agentsRouter.getAgent, input: { id: "550e8400-e29b-41d4-a716-446655440000" } },
        { endpoint: agentsRouter.createAgent, input: { projectId: "550e8400-e29b-41d4-a716-446655440000", name: "Test", agentType: "CLAUDE_CODE" as const } },
        { endpoint: agentsRouter.updateAgent, input: { id: "550e8400-e29b-41d4-a716-446655440000", name: "Test" } },
        { endpoint: agentsRouter.deleteAgent, input: { id: "550e8400-e29b-41d4-a716-446655440000" } },
      ];

      for (const { endpoint, input } of sampleInputs) {
        await assertRealRPCUnauthorized(endpoint, input);
      }
    });
  });

  describe("Data isolation and project membership", () => {
    it("should isolate agents between different projects", async () => {
      const user1 = await createTestUser({ displayName: "User 1" });
      const user2 = await createTestUser({ displayName: "User 2" });
      const project1 = await createTestProject(user1.id, { name: "Project 1" });
      const project2 = await createTestProject(user2.id, { name: "Project 2" });
      
      const agent1 = await createTestAgent(project1.id, { name: "Agent 1" });
      const agent2 = await createTestAgent(project2.id, { name: "Agent 2" });
      
      // User1 should only see agent1
      const user1Agents = await testRealRPCWithAuth(
        agentsRouter.list,
        user1,
        { projectId: project1.id }
      );
      expect(user1Agents).toHaveLength(1);
      expect(user1Agents[0].id).toBe(agent1.id);
      
      // User2 should only see agent2
      const user2Agents = await testRealRPCWithAuth(
        agentsRouter.list,
        user2,
        { projectId: project2.id }
      );
      expect(user2Agents).toHaveLength(1);
      expect(user2Agents[0].id).toBe(agent2.id);
      
      // Cross-access should be denied
      try {
        await testRealRPCWithAuth(agentsRouter.get, user1, { id: agent2.id });
        throw new Error("Expected cross-project access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });

    it("should verify project membership for all operations", async () => {
      const { user, project, agent } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      // Test all endpoints deny access to non-members
      const deniedOperations = [
        () => testRealRPCWithAuth(agentsRouter.list, outsider, { projectId: project.id }),
        () => testRealRPCWithAuth(agentsRouter.get, outsider, { id: agent.id }),
        () => testRealRPCWithAuth(agentsRouter.create, outsider, { projectId: project.id, name: "Test", agentType: "CLAUDE_CODE" as const }),
        () => testRealRPCWithAuth(agentsRouter.update, outsider, { id: agent.id, name: "Test" }),
        () => testRealRPCWithAuth(agentsRouter.delete, outsider, { id: agent.id }),
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
  });
});