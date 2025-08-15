import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePgLite } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

let migrationRunning = false;

export async function runDatabaseMigrations() {
  // Prevent concurrent migrations
  if (migrationRunning) {
    console.log('⏳ Migration already in progress, skipping...');
    return;
  }

  migrationRunning = true;

  try {
    const isProduction = process.env.NODE_ENV === "production";
    const nodeEnv = process.env.NODE_ENV;

    // Skip migrations in production
    if (isProduction) {
      console.log('🚫 Skipping auto-migrations in production environment');
      return;
    }

    // Only run in development or test
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      console.log('🚫 Skipping auto-migrations, NODE_ENV is not development or test');
      return;
    }

    console.log(`🔄 Running database migrations (${nodeEnv})...`);

    if (process.env.DATABASE_URL) {
      // Use PostgreSQL
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const db = drizzlePg(pool, { schema });

      try {
        const { migrate } = await import("drizzle-orm/node-postgres/migrator");
        await migrate(db, { migrationsFolder: "./src/db/migrations" });
        console.log("✅ Migrations applied successfully (PostgreSQL)");
      } catch (err) {
        console.warn("⚠️ Failed to apply migrations (PostgreSQL):", err);
      } finally {
        await pool.end();
      }
    } else {
      // Use PGlite
      try {
        const { PGlite } = await import("@electric-sql/pglite");
        const client = new PGlite("./pgdata");
        const db = drizzlePgLite(client, { schema });

        const { migrate } = await import("drizzle-orm/pglite/migrator");
        await migrate(db, { migrationsFolder: "./src/db/migrations" });
        console.log("✅ Migrations applied successfully (PGlite)");
        
        await client.close();
      } catch (err) {
        console.warn("⚠️ Failed to apply migrations (PGlite):", err);
      }
    }
  } catch (error) {
    console.error('❌ Migration process failed:', error);
  } finally {
    migrationRunning = false;
  }
}