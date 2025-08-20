/**
 * Simple RPC test to verify test infrastructure
 */
import bunTest from "bun:test";
const { describe, it, expect } = bunTest;

import { setupDatabaseTests } from "./test-utils";
import { createCompleteTestSetup } from "./fixtures";
import { createAuthenticatedContext } from "./auth-mocks";

// Setup database for these tests
setupDatabaseTests();

describe("Simple RPC Infrastructure Test", () => {
  it("should create test data and authenticate context", async () => {
    const setup = await createCompleteTestSetup();
    
    expect(setup.user.id).toBeDefined();
    expect(setup.project.id).toBeDefined();
    expect(setup.repository.id).toBeDefined();
    expect(setup.agent.id).toBeDefined();
    expect(setup.actor.id).toBeDefined();
    
    const context = createAuthenticatedContext(setup.user);
    expect(context.session).toBeDefined();
    expect(context.appUser).toEqual(setup.user);
  });

  it("should handle basic database operations", async () => {
    const setup = await createCompleteTestSetup();
    const { getTestDb } = await import("./setup");
    const db = getTestDb();
    const { users } = await import("../db/schema");
    const { eq } = await import("drizzle-orm");
    
    // Query the user we created
    const foundUser = await db
      .select()
      .from(users)
      .where(eq(users.id, setup.user.id))
      .limit(1);
    
    expect(foundUser).toHaveLength(1);
    expect(foundUser[0].email).toBe(setup.user.email);
  });
});