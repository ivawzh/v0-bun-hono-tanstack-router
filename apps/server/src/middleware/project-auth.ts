import { db as mainDb } from "../db";
import { projectUsers } from "../db/schema";
import { eq, and } from "drizzle-orm";

// Use test database when running tests, otherwise use main database
function getDb() {
  if (process.env.NODE_ENV === "test" || process.env.BUN_TEST) {
    try {
      const { getTestDb } = require("../test/setup");
      return getTestDb();
    } catch {
      // Fallback to main db if test setup not available
      return mainDb;
    }
  }
  return mainDb;
}

export async function checkProjectOwnership(userId: string, projectId: string): Promise<boolean> {
  const db = getDb();
  const membership = await db
    .select()
    .from(projectUsers)
    .where(
      and(
        eq(projectUsers.projectId, projectId),
        eq(projectUsers.userId, userId),
        eq(projectUsers.role, "owner")
      )
    )
    .limit(1);
  
  return membership.length > 0;
}

export async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const db = getDb();
  const membership = await db
    .select()
    .from(projectUsers)
    .where(
      and(
        eq(projectUsers.projectId, projectId),
        eq(projectUsers.userId, userId)
      )
    )
    .limit(1);
  
  return membership.length > 0;
}

export async function getUserProjectRole(userId: string, projectId: string): Promise<string | null> {
  const db = getDb();
  const membership = await db
    .select({ role: projectUsers.role })
    .from(projectUsers)
    .where(
      and(
        eq(projectUsers.projectId, projectId),
        eq(projectUsers.userId, userId)
      )
    )
    .limit(1);
  
  return membership.length > 0 ? membership[0].role : null;
}