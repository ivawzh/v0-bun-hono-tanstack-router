/**
 * Agents Router Tests
 * Comprehensive tests for agents router endpoints including authentication, authorization,
 * CRUD operations, and data isolation
 */
import { describe, it, expect } from "bun:test";

import { setupDatabaseTests } from "./test-utils";
import { 
  createTestUser, 
  createTestProject,
  createTestAgent,
  createTestUsers,
  createComplexTestScenario,
  createCompleteTestSetup
} from "./fixtures";
import { 
  testRealRPCWithAuth,
  assertRealRPCUnauthorized,
  testProjectMembershipValidation
} from "./rpc-test-helpers";
import { agentsRouter } from "../routers/agents";

// Setup database for these tests
setupDatabaseTests();

describe("Agents Router", () => {
  describe("Authentication Requirements", () => {
    it("should require authentication for all endpoints", async () => {
      // Test that all agents router endpoints require authentication
      const sampleAgentId = "123e4567-e89b-12d3-a456-426614174000";
      const sampleProjectId = "123e4567-e89b-12d3-a456-426614174001";
      
      const endpointsToTest = [
        { name: "list", input: { projectId: sampleProjectId } },
        { name: "get", input: { id: sampleAgentId } },
        { name: "create", input: { projectId: sampleProjectId, name: "Test Agent", agentType: "CLAUDE_CODE" as const } },
        { name: "update", input: { id: sampleAgentId, name: "Updated Agent" } },
        { name: "delete", input: { id: sampleAgentId } },
        // Duplicate endpoints
        { name: "listAgents", input: { projectId: sampleProjectId } },
        { name: "getAgent", input: { id: sampleAgentId } },
        { name: "createAgent", input: { projectId: sampleProjectId, name: "Test Agent", agentType: "CLAUDE_CODE" as const } },
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

  describe("Project Membership Authorization", () => {
    it("should require project membership for all endpoints", async () => {
      const users = await createTestUsers(2);
      const user1 = users[0];
      const user2 = users[1];
      
      // User1 creates a project
      const project = await createTestProject(user1.id);
      
      // User1 creates an agent in their project
      const agent = await createTestAgent(project.id);
      
      const endpointsToTest = [
        {
          endpoint: agentsRouter.list,
          input: { projectId: project.id },
          description: "list agents"
        },
        {
          endpoint: agentsRouter.get,
          input: { id: agent.id },
          description: "get agent"
        },
        {
          endpoint: agentsRouter.create,
          input: { projectId: project.id, name: "Unauthorized Agent", agentType: "CLAUDE_CODE" as const },
          description: "create agent"
        },
        {
          endpoint: agentsRouter.update,
          input: { id: agent.id, name: "Updated Name" },
          description: "update agent"
        },
        {
          endpoint: agentsRouter.delete,
          input: { id: agent.id },
          description: "delete agent"
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
    
    it("should require project membership for duplicate endpoints", async () => {
      const users = await createTestUsers(2);
      const user1 = users[0];
      const user2 = users[1];
      
      // User1 creates a project
      const project = await createTestProject(user1.id);
      
      // User1 creates an agent in their project
      const agent = await createTestAgent(project.id);
      
      const endpointsToTest = [
        {
          endpoint: agentsRouter.listAgents,
          input: { projectId: project.id },
          description: "listAgents"
        },
        {
          endpoint: agentsRouter.getAgent,
          input: { id: agent.id },
          description: "getAgent"
        },
        {
          endpoint: agentsRouter.createAgent,
          input: { projectId: project.id, name: "Unauthorized Agent", agentType: "CLAUDE_CODE" as const },
          description: "createAgent"
        },
        {
          endpoint: agentsRouter.updateAgent,
          input: { id: agent.id, name: "Updated Name" },
          description: "updateAgent"
        },
        {
          endpoint: agentsRouter.deleteAgent,
          input: { id: agent.id },
          description: "deleteAgent"
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
    it("should only return agents from user's projects", async () => {
      const users = await createTestUsers(2);
      const user1 = users[0];
      const user2 = users[1];
      
      // Create projects for both users
      const project1 = await createTestProject(user1.id);
      const project2 = await createTestProject(user2.id);
      
      // Create agents in both projects
      const agent1 = await createTestAgent(project1.id);
      const agent2 = await createTestAgent(project2.id);
      
      // User1 should only see agents from their project
      const user1Agents = await testRealRPCWithAuth(
        agentsRouter.list,
        user1,
        { projectId: project1.id }
      );
      
      expect(user1Agents).toHaveLength(1);
      expect(user1Agents[0].id).toBe(agent1.id);
      
      // User2 should only see agents from their project
      const user2Agents = await testRealRPCWithAuth(
        agentsRouter.list,
        user2,
        { projectId: project2.id }
      );
      
      expect(user2Agents).toHaveLength(1);
      expect(user2Agents[0].id).toBe(agent2.id);
    });

    it("should prevent cross-project agent access", async () => {
      const users = await createTestUsers(2);
      const user1 = users[0];
      const user2 = users[1];
      
      // User1 creates a project and agent
      const project1 = await createTestProject(user1.id);
      const agent1 = await createTestAgent(project1.id);
      
      // User2 creates a project
      const project2 = await createTestProject(user2.id);
      
      // User2 should not be able to access User1's agent
      await expect(
        testRealRPCWithAuth(
          agentsRouter.get,
          user2,
          { id: agent1.id }
        )
      ).rejects.toThrow(/Agent not found or unauthorized/);
    });
  });

  describe("CRUD Operations", () => {
    it("should create agents with proper data", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const agentData = {
        projectId: project.id,
        name: "Test Claude Agent",
        agentType: "CLAUDE_CODE" as const,
        agentSettings: { configDir: "/custom/claude/config" },
        maxConcurrencyLimit: 2
      };
      
      const agent = await testRealRPCWithAuth(
        agentsRouter.create,
        user,
        agentData
      );
      
      expect(agent.name).toBe(agentData.name);
      expect(agent.agentType).toBe(agentData.agentType);
      expect(agent.agentSettings).toEqual(agentData.agentSettings);
      expect(agent.maxConcurrencyLimit).toBe(agentData.maxConcurrencyLimit);
      expect(agent.projectId).toBe(project.id);
    });

    it("should list agents with proper ordering", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create multiple agents
      const agent1 = await createTestAgent(project.id, { name: "Agent 1" });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      const agent2 = await createTestAgent(project.id, { name: "Agent 2" });
      
      const agents = await testRealRPCWithAuth(
        agentsRouter.list,
        user,
        { projectId: project.id }
      );
      
      expect(agents).toHaveLength(2);
      // Should be ordered by creation date (newest first)
      expect(agents[0].id).toBe(agent2.id);
      expect(agents[1].id).toBe(agent1.id);
    });

    it("should get individual agents", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const agent = await createTestAgent(project.id);
      
      const retrievedAgent = await testRealRPCWithAuth(
        agentsRouter.get,
        user,
        { id: agent.id }
      );
      
      expect(retrievedAgent.id).toBe(agent.id);
      expect(retrievedAgent.name).toBe(agent.name);
      expect(retrievedAgent.projectId).toBe(project.id);
    });

    it("should update agents", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const agent = await createTestAgent(project.id);
      
      const updates = {
        id: agent.id,
        name: "Updated Agent Name",
        agentSettings: { newSetting: "value" },
        maxConcurrencyLimit: 5
      };
      
      const updatedAgent = await testRealRPCWithAuth(
        agentsRouter.update,
        user,
        updates
      );
      
      expect(updatedAgent.name).toBe(updates.name);
      expect(updatedAgent.agentSettings).toEqual(updates.agentSettings);
      expect(updatedAgent.maxConcurrencyLimit).toBe(updates.maxConcurrencyLimit);
      expect(updatedAgent.updatedAt).not.toBe(agent.updatedAt);
    });

    it("should delete agents", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const agent = await createTestAgent(project.id);
      
      const result = await testRealRPCWithAuth(
        agentsRouter.delete,
        user,
        { id: agent.id }
      );
      
      expect(result.success).toBe(true);
      
      // Verify agent is deleted
      await expect(
        testRealRPCWithAuth(
          agentsRouter.get,
          user,
          { id: agent.id }
        )
      ).rejects.toThrow(/Agent not found or unauthorized/);
    });
  });

  describe("Duplicate Endpoints", () => {
    it("should have identical behavior between list and listAgents", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      await createTestAgent(project.id, { name: "Test Agent" });
      
      const listResult = await testRealRPCWithAuth(
        agentsRouter.list,
        user,
        { projectId: project.id }
      );
      
      const listAgentsResult = await testRealRPCWithAuth(
        agentsRouter.listAgents,
        user,
        { projectId: project.id }
      );
      
      expect(listResult).toEqual(listAgentsResult);
    });

    it("should have identical behavior between get and getAgent", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      const agent = await createTestAgent(project.id);
      
      const getResult = await testRealRPCWithAuth(
        agentsRouter.get,
        user,
        { id: agent.id }
      );
      
      const getAgentResult = await testRealRPCWithAuth(
        agentsRouter.getAgent,
        user,
        { id: agent.id }
      );
      
      expect(getResult).toEqual(getAgentResult);
    });

    it("should have identical behavior between create and createAgent", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      const agentData = {
        projectId: project.id,
        name: "Test Agent",
        agentType: "CLAUDE_CODE" as const
      };
      
      const createResult = await testRealRPCWithAuth(
        agentsRouter.create,
        user,
        agentData
      );
      
      const createAgentResult = await testRealRPCWithAuth(
        agentsRouter.createAgent,
        user,
        { ...agentData, name: "Test Agent 2" } // Different name to avoid conflicts
      );
      
      // Should have same structure
      expect(Object.keys(createResult)).toEqual(Object.keys(createAgentResult));
      expect(createResult.agentType).toBe(createAgentResult.agentType);
      expect(createResult.projectId).toBe(createAgentResult.projectId);
    });
  });

  describe("Error Handling", () => {
    it("should handle non-existent agent IDs", async () => {
      const user = await createTestUser();
      const nonExistentId = "123e4567-e89b-12d3-a456-426614174000";
      
      try {
        await testRealRPCWithAuth(agentsRouter.get, user, { id: nonExistentId });
        throw new Error("Should have thrown not found error");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });

    it("should handle invalid UUID validation", async () => {
      const user = await createTestUser();
      
      try {
        await testRealRPCWithAuth(agentsRouter.get, user, { id: "invalid-uuid" });
        throw new Error("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toContain("uuid");
      }
    });

    it("should validate required fields in create", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project } = setup;
      
      // Test missing name
      try {
        await testRealRPCWithAuth(
          agentsRouter.create,
          user,
          {
            projectId: project.id,
            name: "",
            agentType: "CLAUDE_CODE"
          }
        );
        throw new Error("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toContain("minLength");
      }
    });

    it("should validate agent type in create", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project } = setup;
      
      try {
        await testRealRPCWithAuth(
          agentsRouter.create,
          user,
          {
            projectId: project.id,
            name: "Test Agent",
            agentType: "INVALID" as any
          }
        );
        throw new Error("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toContain("picklist");
      }
    });

    it("should validate concurrency limit bounds", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project } = setup;
      
      // Test negative concurrency limit
      try {
        await testRealRPCWithAuth(
          agentsRouter.create,
          user,
          {
            projectId: project.id,
            name: "Test Agent",
            agentType: "CLAUDE_CODE",
            maxConcurrencyLimit: -1
          }
        );
        throw new Error("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toContain("minValue");
      }
      
      // Test too high concurrency limit
      try {
        await testRealRPCWithAuth(
          agentsRouter.create,
          user,
          {
            projectId: project.id,
            name: "Test Agent",
            agentType: "CLAUDE_CODE",
            maxConcurrencyLimit: 11
          }
        );
        throw new Error("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toContain("maxValue");
      }
    });

    it("should validate name length constraints", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project } = setup;
      
      // Test name too long
      try {
        await testRealRPCWithAuth(
          agentsRouter.create,
          user,
          {
            projectId: project.id,
            name: "a".repeat(101), // maxLength is 100
            agentType: "CLAUDE_CODE"
          }
        );
        throw new Error("Should have thrown validation error");
      } catch (error: any) {
        expect(error.message).toContain("maxLength");
      }
    });
  });

  describe("Complex Scenarios", () => {
    it("should handle multiple agents in multiple projects", async () => {
      const scenario = await createComplexTestScenario();
      
      // Test that users can access their project's agents
      const userAgents = await testRealRPCWithAuth(
        agentsRouter.list,
        scenario.users.owner,
        { projectId: scenario.project.id }
      );
      
      // Test member access to same project
      const memberAgents = await testRealRPCWithAuth(
        agentsRouter.list,
        scenario.users.member1,
        { projectId: scenario.project.id }
      );
      
      // Project should have agents
      expect(userAgents.length).toBeGreaterThan(0);
      expect(memberAgents.length).toBeGreaterThan(0);
      
      // Both should see the same agents (same project)
      expect(userAgents).toEqual(memberAgents);
      
      // Test outsider cannot access the project
      await expect(
        testRealRPCWithAuth(
          agentsRouter.list,
          scenario.users.outsider,
          { projectId: scenario.project.id }
        )
      ).rejects.toThrow();
    });

    it("should validate agent types", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Test valid agent types
      const validTypes = ['CLAUDE_CODE', 'CURSOR_CLI', 'OPENCODE'] as const;
      
      for (const agentType of validTypes) {
        const agent = await testRealRPCWithAuth(
          agentsRouter.create,
          user,
          {
            projectId: project.id,
            name: `${agentType} Agent`,
            agentType
          }
        );
        
        expect(agent.agentType).toBe(agentType);
      }
    });

    it("should handle concurrent operations safely", async () => {
      const user = await createTestUser();
      const project = await createTestProject(user.id);
      
      // Create multiple agents concurrently
      const promises = Array.from({ length: 3 }, (_, i) =>
        testRealRPCWithAuth(
          agentsRouter.create,
          user,
          {
            projectId: project.id,
            name: `Concurrent Agent ${i}`,
            agentType: "CLAUDE_CODE" as const
          }
        )
      );
      
      const agents = await Promise.all(promises);
      expect(agents).toHaveLength(3);
      
      // All should be different
      const ids = agents.map(a => a.id);
      expect(new Set(ids).size).toBe(3);
    });
  });

  describe("Comprehensive CRUD Coverage", () => {
    it("should support full agent lifecycle", async () => {
      const setup = await createCompleteTestSetup();
      const { user, project } = setup;
      
      // Create agent
      const createdAgent = await testRealRPCWithAuth(
        agentsRouter.create,
        user,
        {
          projectId: project.id,
          name: "Lifecycle Agent",
          agentType: "CLAUDE_CODE",
          agentSettings: { initial: "settings" },
          maxConcurrencyLimit: 2
        }
      );
      
      expect(createdAgent.name).toBe("Lifecycle Agent");
      
      // Read agent
      const readAgent = await testRealRPCWithAuth(
        agentsRouter.get,
        user,
        { id: createdAgent.id }
      );
      
      expect(readAgent.id).toBe(createdAgent.id);
      expect(readAgent.agentSettings).toEqual({ initial: "settings" });
      
      // Update agent
      const updatedAgent = await testRealRPCWithAuth(
        agentsRouter.update,
        user,
        {
          id: createdAgent.id,
          name: "Updated Lifecycle Agent",
          agentSettings: { updated: "settings" },
          maxConcurrencyLimit: 5
        }
      );
      
      expect(updatedAgent.name).toBe("Updated Lifecycle Agent");
      expect(updatedAgent.agentSettings).toEqual({ updated: "settings" });
      expect(updatedAgent.maxConcurrencyLimit).toBe(5);
      
      // List should include updated agent
      const listedAgents = await testRealRPCWithAuth(
        agentsRouter.list,
        user,
        { projectId: project.id }
      );
      
      const foundAgent = listedAgents.find(a => a.id === createdAgent.id);
      expect(foundAgent?.name).toBe("Updated Lifecycle Agent");
      
      // Delete agent
      const deleteResult = await testRealRPCWithAuth(
        agentsRouter.delete,
        user,
        { id: createdAgent.id }
      );
      
      expect(deleteResult.success).toBe(true);
      
      // Verify deletion
      try {
        await testRealRPCWithAuth(agentsRouter.get, user, { id: createdAgent.id });
        throw new Error("Agent should have been deleted");
      } catch (error: any) {
        expect(error.message).toContain("Agent not found or unauthorized");
      }
    });
  });
});