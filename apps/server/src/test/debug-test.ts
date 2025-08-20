/**
 * Debug test to understand why projects are not being found
 */
import { describe, it, expect } from "bun:test";
import { setupDatabaseTests } from "./test-utils";
import { createTestUser, createTestProject } from "./fixtures";
import { testRealRPCWithAuth } from "./rpc-test-helpers";
import { projectsRouter } from "../routers/projects";

// Setup database for these tests
setupDatabaseTests();

describe("Debug Project Issues", () => {
  it("should debug project creation and listing", async () => {
    const user = await createTestUser({ displayName: "Debug User" });
    console.log("Created user:", user.id, user.email);
    
    const project = await createTestProject(user.id, { name: "Debug Project" });
    console.log("Created project:", project.id, project.name, "for owner:", project.ownerId);
    
    // Now try to list projects
    const projects = await testRealRPCWithAuth(projectsRouter.list, user, {});
    console.log("Listed projects:", projects.length, projects.map(p => ({ id: p.id, name: p.name })));
    
    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(project.id);
  });
});