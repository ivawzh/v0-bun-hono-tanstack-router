import { drizzle as drizzlePgLite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Prefer PGlite in local dev if available; otherwise use Postgres via DATABASE_URL
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbAny: any;

if (!process.env.DATABASE_URL) {
  try {
    // Lazy import pglite only when DATABASE_URL is not set
    const { PGlite } = await import("@electric-sql/pglite");
    // Persist to local filesystem in ./pgdata directory
    const client = new PGlite("./pgdata");
    dbAny = drizzlePgLite(client);
    console.log("DB: Using PGlite (local dev) with persistence at ./pgdata");
  } catch {
    throw new Error("PGlite not available and DATABASE_URL not set. Set DATABASE_URL or add pglite.");
  }
  // Attempt to auto-apply migrations for PGlite in dev, but don't crash if migrator is unavailable
  try {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(dbAny, { migrationsFolder: "./src/db/migrations" });
    console.log("DB: Migrations applied (PGlite)");
  } catch (err) {
    console.warn("DB: Skipped applying migrations for PGlite:", err);
  }
} else {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  dbAny = drizzlePg(pool);
  console.log("DB: Using Postgres via DATABASE_URL");
  // Optionally run migrations for Postgres too
  try {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(dbAny, { migrationsFolder: "./src/db/migrations" });
    console.log("DB: Migrations applied (Postgres)");
  } catch (err) {
    console.warn("DB: Skipped applying migrations for Postgres:", err);
  }
}

export const db = dbAny;
