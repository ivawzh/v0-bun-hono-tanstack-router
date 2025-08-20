/**
 * Test environment setup and configuration
 * Handles test database initialization and cleanup
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../db/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

let testDbPool: Pool | null = null;
let testDb: NodePgDatabase<typeof schema> | null = null;

export async function setupTestDatabase(): Promise<NodePgDatabase<typeof schema>> {
  if (!testDb || !testDbPool) {
    // Use test database URL or default test database
    const databaseUrl = process.env.DATABASE_TEST_URL || 
      `postgresql://${process.env.USER}@localhost:5432/solo_unicorn_test`;
    
    testDbPool = new Pool({ connectionString: databaseUrl });
    testDb = drizzle(testDbPool, { schema });
  }
  
  return testDb;
}

export async function cleanupTestDatabase(): Promise<void> {
  if (!testDb) return;
  
  // Clean up all tables in reverse dependency order
  await testDb.delete(schema.taskDependencies);
  await testDb.delete(schema.taskAgents);
  await testDb.delete(schema.taskAdditionalRepositories);
  await testDb.delete(schema.tasks);
  await testDb.delete(schema.actors);
  await testDb.delete(schema.repositories);
  await testDb.delete(schema.agents);
  await testDb.delete(schema.projectUsers);
  await testDb.delete(schema.projects);
  await testDb.delete(schema.users);
  await testDb.delete(schema.helpers);
}

export async function closeTestDatabase(): Promise<void> {
  if (testDbPool) {
    await testDbPool.end();
    testDbPool = null;
    testDb = null;
  }
}

export function getTestDb(): NodePgDatabase<typeof schema> {
  if (!testDb) {
    throw new Error("Test database not initialized. Call setupTestDatabase() first.");
  }
  return testDb;
}