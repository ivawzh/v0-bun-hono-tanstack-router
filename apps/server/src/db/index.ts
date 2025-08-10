import { drizzle } from "drizzle-orm";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Prefer PGlite in local dev if available; otherwise use Postgres via DATABASE_URL
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbAny: any;

if (!process.env.DATABASE_URL) {
  try {
    // Lazy import pglite only when DATABASE_URL is not set
    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite();
    dbAny = drizzle(client);
    console.log("DB: Using PGlite (local dev)");
  } catch {
    throw new Error("PGlite not available and DATABASE_URL not set. Set DATABASE_URL or add pglite.");
  }
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  dbAny = drizzlePg(pool);
  console.log("DB: Using Postgres via DATABASE_URL");
}

export const db = dbAny;

