/**
 * General test utilities and helpers
 */
import bunTest from "bun:test";
const { beforeEach, afterEach, afterAll } = bunTest;
import { setupTestDatabase, cleanupTestDatabase, closeTestDatabase, getTestDb } from "./setup";

// Re-export getTestDb for convenience
export { getTestDb };

/**
 * Global test hooks for database setup and cleanup
 * Use this in test files that need database access
 */
export function setupDatabaseTests() {
  beforeEach(async () => {
    await setupTestDatabase();
    await cleanupTestDatabase(); // Start with clean state
  });
  
  afterEach(async () => {
    await cleanupTestDatabase();
  });
  
  afterAll(async () => {
    await closeTestDatabase();
  });
}

/**
 * Wait for a specified amount of time (for async testing)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a random test identifier
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Assert that an array contains specific items
 */
export function assertArrayContains<T>(array: T[], items: T[], message?: string) {
  for (const item of items) {
    if (!array.includes(item)) {
      throw new Error(message || `Expected array to contain ${item}`);
    }
  }
}

/**
 * Assert that an array has a specific length
 */
export function assertArrayLength<T>(array: T[], expectedLength: number, message?: string) {
  if (array.length !== expectedLength) {
    throw new Error(message || `Expected array length ${expectedLength}, got ${array.length}`);
  }
}

/**
 * Assert that a value is not null or undefined
 */
export function assertExists<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value == null) {
    throw new Error(message || "Expected value to exist");
  }
}

/**
 * Assert that an error is thrown
 */
export async function assertThrows(fn: () => Promise<any> | any, message?: string): Promise<Error> {
  try {
    await fn();
    throw new Error(message || "Expected function to throw");
  } catch (error) {
    return error as Error;
  }
}