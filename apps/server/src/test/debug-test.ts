/**
 * Debug test to understand why projects are not being found
 */
import { describe, it, expect } from "bun:test";
import { setupDatabaseTests, getTestDb } from "./test-utils";
import { createTestUser, createTestProject } from "./fixtures";
import { testRealRPCWithAuth } from "./rpc-test-helpers";
import { projectsRouter } from "../routers/projects";
import { projects, projectUsers, users } from "../db/schema";
import { eq } from "drizzle-orm";

// Setup database for these tests
setupDatabaseTests();

describe("Debug Project Issues", () => {
  it("should debug project creation and listing", async () => {
    const db = getTestDb();
    
    console.log("=== BEFORE TEST ===");
    const usersBefore = await db.select().from(users);
    const projectsBefore = await db.select().from(projects);
    const membershipsBefore = await db.select().from(projectUsers);
    console.log("Users before:", usersBefore.length);
    console.log("Projects before:", projectsBefore.length);
    console.log("Memberships before:", membershipsBefore.length);
    
    const user = await createTestUser({ displayName: "Debug User" });
    console.log("Created user:", user.id, user.email);
    
    const project = await createTestProject(user.id, { name: "Debug Project" });
    console.log("Created project:", project.id, project.name, "for owner:", project.ownerId);
    
    console.log("=== AFTER CREATION ===");
    const usersAfter = await db.select().from(users);
    const projectsAfter = await db.select().from(projects);
    const membershipsAfter = await db.select().from(projectUsers);
    console.log("Users after creation:", usersAfter.length);
    console.log("Projects after creation:", projectsAfter.length);
    console.log("Memberships after creation:", membershipsAfter.length);
    
    if (membershipsAfter.length > 0) {
      console.log("Sample membership:", membershipsAfter[membershipsAfter.length - 1]);
      const membership = membershipsAfter[membershipsAfter.length - 1];
      console.log("User ID from test user:", user.id);
      console.log("User ID from membership:", membership.userId);
      console.log("IDs match:", user.id === membership.userId);
    }
    
    // Test the exact same query manually to debug
    console.log("=== MANUAL QUERY DEBUG ===");
    const manualQuery = await db
      .select({ project: projects })
      .from(projects)
      .innerJoin(projectUsers, eq(projectUsers.projectId, projects.id))
      .where(eq(projectUsers.userId, user.id));
    
    console.log("Manual query result:", manualQuery.length);
    if (manualQuery.length > 0) {
      console.log("Manual query first result:", manualQuery[0]);
    }
    
    // Also test all data separately
    const allProjects = await db.select().from(projects);
    const allMemberships = await db.select().from(projectUsers);
    console.log("All projects in DB:", allProjects.map(p => ({ id: p.id, name: p.name, ownerId: p.ownerId })));
    console.log("All memberships in DB:", allMemberships.map(m => ({ userId: m.userId, projectId: m.projectId, role: m.role })));
    
    // Now try to list projects via RPC
    const projects_listed = await testRealRPCWithAuth(projectsRouter.list, user, {});
    console.log("Listed projects:", projects_listed.length, projects_listed.map(p => ({ id: p.id, name: p.name })));
    
    expect(projects_listed).toHaveLength(1);
    expect(projects_listed[0].id).toBe(project.id);
  });
});