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
  testProjectMembershipValidation,
  testProtectedProcedure
} from "../rpc-test-helpers";
import { agentsRouter } from "../../routers/agents";

// Setup database for these tests
setupDatabaseTests();

describe("Agents Router", () => {
  describe("Authentication Requirements", () => {
    it("should require authentication for all endpoints", async () => {
      const sampleProjectId = "550e8400-e29b-41d4-a716-446655440000";
      const sampleAgentId = "550e8400-e29b-41d4-a716-446655440001";
      
      const endpointsToTest = [
        { name: "list", input: { projectId: sampleProjectId } },
        { name: "get", input: { id: sampleAgentId } },
        { name: "create", input: { projectId: sampleProjectId, name: "Test Agent", agentType: "CLAUDE_CODE" } },
        { name: "update", input: { id: sampleAgentId, name: "Updated Agent" } },
        { name: "delete", input: { id: sampleAgentId } },
        // Duplicate endpoints
        { name: "listAgents", input: { projectId: sampleProjectId } },
        { name: "getAgent", input: { id: sampleAgentId } },
        { name: "createAgent", input: { projectId: sampleProjectId, name: "Test Agent", agentType: "CLAUDE_CODE" } },
        { name: "updateAgent", input: { id: sampleAgentId, name: "Updated Agent" } },
        { name: "deleteAgent", input: { id: sampleAgentId } },
      ];

      for (const endpoint of endpointsToTest) {
        await assertRealRPCUnauthorized(
          agentsRouter[endpoint.name as keyof typeof agentsRouter],
          endpoint.input
        );
      }
    });
  });

  describe("Basic CRUD Operations", () => {
    it("should list agents for project member", async () => {
      const { user, project, agent } = await createCompleteTestSetup();
      
      const result = await testProtectedProcedure(
        agentsRouter.list,
        user,
        { projectId: project.id, includeTaskCounts: false }
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(agent.id);
      expect(result[0].name).toBe(agent.name);
      expect(result[0].agentType).toBe(agent.agentType);
    });

    it("should get specific agent for project member", async () => {
      const { user, agent } = await createCompleteTestSetup();
      
      const result = await testProtectedProcedure(
        agentsRouter.get,
        user,
        { id: agent.id }
      );
      
      expect(result.id).toBe(agent.id);
      expect(result.name).toBe(agent.name);
      expect(result.agentType).toBe(agent.agentType);
    });

    it("should create new agent for project member", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      const agentData = {
        projectId: project.id,
        name: "New Test Agent",
        agentType: "OPENCODE" as const,
        agentSettings: { key: "value" },
        maxConcurrencyLimit: 2
      };
      
      const result = await testProtectedProcedure(
        agentsRouter.create,
        user,
        agentData
      );
      
      expect(result.name).toBe(agentData.name);
      expect(result.agentType).toBe(agentData.agentType);
      expect(result.projectId).toBe(project.id);
      expect(result.agentSettings).toEqual(agentData.agentSettings);
      expect(result.maxConcurrencyLimit).toBe(agentData.maxConcurrencyLimit);
    });

    it("should update agent for project member", async () => {
      const { user, agent } = await createCompleteTestSetup();
      
      const updates = {
        id: agent.id,
        name: "Updated Agent Name",
        maxConcurrencyLimit: 5
      };
      
      const result = await testProtectedProcedure(
        agentsRouter.update,
        user,
        updates
      );
      
      expect(result.id).toBe(agent.id);
      expect(result.name).toBe(updates.name);
      expect(result.maxConcurrencyLimit).toBe(updates.maxConcurrencyLimit);
    });

    it("should delete agent for project member", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      // Create an additional agent to delete
      const agentToDelete = await createTestAgent(project.id, { name: "To Delete" });
      
      const result = await testProtectedProcedure(
        agentsRouter.delete,
        user,
        { id: agentToDelete.id }
      );
      
      expect(result.success).toBe(true);
    });
  });

  describe("Duplicate Endpoints", () => {
    it("should work with duplicate endpoint names", async () => {
      const { user, project, agent } = await createCompleteTestSetup();
      
      // Test listAgents (duplicate of list)
      const listResult = await testProtectedProcedure(
        agentsRouter.listAgents,
        user,
        { projectId: project.id, includeTaskCounts: false }
      );
      expect(listResult).toHaveLength(1);
      expect(listResult[0].id).toBe(agent.id);
      
      // Test getAgent (duplicate of get)
      const getResult = await testProtectedProcedure(
        agentsRouter.getAgent,
        user,
        { id: agent.id }
      );
      expect(getResult.id).toBe(agent.id);
      
      // Test createAgent (duplicate of create)
      const createResult = await testProtectedProcedure(
        agentsRouter.createAgent,
        user,
        {
          projectId: project.id,
          name: "Duplicate Endpoint Agent",
          agentType: "CLAUDE_CODE" as const
        }
      );
      expect(createResult.name).toBe("Duplicate Endpoint Agent");
      
      // Test updateAgent (duplicate of update)
      const updateResult = await testProtectedProcedure(
        agentsRouter.updateAgent,
        user,
        {
          id: agent.id,
          name: "Updated via Duplicate"
        }
      );
      expect(updateResult.name).toBe("Updated via Duplicate");
      
      // Test deleteAgent (duplicate of delete)  
      const deleteResult = await testProtectedProcedure(
        agentsRouter.deleteAgent,
        user,
        { id: createResult.id }
      );
      expect(deleteResult.success).toBe(true);
    });
  });

  describe("Authorization & Data Isolation", () => {
    it("should deny access to non-project members", async () => {
      const { project, agent } = await createCompleteTestSetup();
      const outsider = await createTestUser({ displayName: "Outsider" });
      
      // Test that outsider cannot access project agents
      try {
        await testProtectedProcedure(
          agentsRouter.list,
          outsider,
          { projectId: project.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Project not found or unauthorized");
      }
      
      try {
        await testProtectedProcedure(
          agentsRouter.get,
          outsider,
          { id: agent.id }
        );
        throw new Error("Expected access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });

    it("should isolate agents between different projects", async () => {
      const user1 = await createTestUser({ displayName: "User 1" });
      const user2 = await createTestUser({ displayName: "User 2" });
      const project1 = await createTestProject(user1.id, { name: "Project 1" });
      const project2 = await createTestProject(user2.id, { name: "Project 2" });
      
      const agent1 = await createTestAgent(project1.id, { name: "Agent 1" });
      const agent2 = await createTestAgent(project2.id, { name: "Agent 2" });
      
      // User1 should only see agent1
      const user1Agents = await testProtectedProcedure(
        agentsRouter.list,
        user1,
        { projectId: project1.id }
      );
      expect(user1Agents).toHaveLength(1);
      expect(user1Agents[0].id).toBe(agent1.id);
      
      // User2 should only see agent2
      const user2Agents = await testProtectedProcedure(
        agentsRouter.list,
        user2,
        { projectId: project2.id }
      );
      expect(user2Agents).toHaveLength(1);
      expect(user2Agents[0].id).toBe(agent2.id);
      
      // Cross-access should be denied
      try {
        await testProtectedProcedure(agentsRouter.get, user1, { id: agent2.id });
        throw new Error("Expected cross-project access to be denied");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });
  });

  describe("Input Validation", () => {
    it("should return empty list for project with no agents", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const result = await testProtectedProcedure(
        agentsRouter.list,
        user,
        { projectId: project.id, includeTaskCounts: false }
      );
      
      expect(result).toHaveLength(0);
    });

    it("should handle non-existent agent ID", async () => {
      const user = await createTestUser();
      const nonExistentId = "550e8400-e29b-41d4-a716-446655440000";
      
      try {
        await testProtectedProcedure(
          agentsRouter.get,
          user,
          { id: nonExistentId }
        );
        throw new Error("Expected agent not found error");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });

    it("should use default values for optional fields", async () => {
      const { user, project } = await createCompleteTestSetup();
      
      const result = await testProtectedProcedure(
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
  });
});