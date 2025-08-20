import { describe, it, expect } from "bun:test";
import { setupDatabaseTests } from "./test-utils";
import { createTestUser, createTestProject } from "./fixtures";
import { db } from "../db";
import { projectUsers } from "../db/schema";

// Setup database for these tests
setupDatabaseTests();

describe("Simple Debug", () => {
  it("should create user and project properly", async () => {
    console.log("Environment variables:");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("BUN_TEST:", process.env.BUN_TEST);
    
    const user = await createTestUser();
    console.log("Created user:", user.id, user.email);
    
    const project = await createTestProject(user.id);
    console.log("Created project:", project.id, project.name, "ownerId:", project.ownerId);
    
    // Check membership directly using main db vs test db
    console.log("Checking main db...");
    const mainMemberships = await db.select().from(projectUsers);
    console.log("Main DB memberships:", mainMemberships);
    
    console.log("Checking test db...");
    const { getTestDb } = require("./setup");
    const testDb = await getTestDb();
    const testMemberships = await testDb.select().from(projectUsers);
    console.log("Test DB memberships:", testMemberships);
    
    // Test if database transactions are working
    expect(user.id).toBeDefined();
    expect(project.id).toBeDefined();
    expect(project.ownerId).toBe(user.id);
  });
});