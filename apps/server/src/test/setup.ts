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
    // Always use test database for tests
    const databaseUrl = `postgresql://iw@localhost:5432/solo_unicorn_test`;
    
    testDbPool = new Pool({ connectionString: databaseUrl });
    testDb = drizzle(testDbPool, { schema });
    
    // Set global flag to indicate test database is active
    (global as any).__TEST_DB_ACTIVE = true;
  }
  
  return testDb;
}

export async function cleanupTestDatabase(): Promise<void> {
  if (!testDb) return;
  
  try {
    // Clean up all tables in correct dependency order
    // First delete dependent tables that reference other tables
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
  } catch (error) {
    // If cleanup fails, try with CASCADE to force cleanup
    console.warn("Regular cleanup failed, attempting forced cleanup:", error);
    
    try {
      // Use raw SQL with CASCADE to force cleanup
      const pool = testDbPool;
      if (pool) {
        await pool.query('TRUNCATE TABLE "taskDependencies" CASCADE');
        await pool.query('TRUNCATE TABLE "taskAgents" CASCADE');
        await pool.query('TRUNCATE TABLE "taskAdditionalRepositories" CASCADE');
        await pool.query('TRUNCATE TABLE "tasks" CASCADE');
        await pool.query('TRUNCATE TABLE "actors" CASCADE');
        await pool.query('TRUNCATE TABLE "repositories" CASCADE');
        await pool.query('TRUNCATE TABLE "agents" CASCADE');
        await pool.query('TRUNCATE TABLE "projectUsers" CASCADE');
        await pool.query('TRUNCATE TABLE "projects" CASCADE');
        await pool.query('TRUNCATE TABLE "users" CASCADE');
        await pool.query('TRUNCATE TABLE "helpers" CASCADE');
      }
    } catch (cascadeError) {
      console.error("Forced cleanup also failed:", cascadeError);
      // Don't throw - allow tests to continue
    }
  }
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