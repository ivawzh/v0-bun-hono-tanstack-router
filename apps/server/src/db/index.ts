import { drizzle as drizzlePgLite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const isProduction = process.env.NODE_ENV === "production";

let db: NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

if (isProduction) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set in production");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzlePg(pool, { schema });
  console.log("DB: Using Postgres via DATABASE_URL (production)");
  // Do NOT auto-run migrations in production
} else {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzlePg(pool, { schema });
    console.log("DB: Using Postgres via DATABASE_URL (dev)");
    // Migrations are now handled by Vite hotUpdate hook or migration utility
  } else {
    try {
      const { PGlite } = await import("@electric-sql/pglite");
      const client = new PGlite("./pgdata");
      db = drizzlePgLite(client, { schema });
      console.log("DB: Using PGlite (dev) with persistence at ./pgdata");
    } catch {
      throw new Error("PGlite not available and DATABASE_URL not set. Set DATABASE_URL or add pglite.");
    }
    // Migrations are now handled by Vite hotUpdate hook or migration utility
  }
}

export { db };
