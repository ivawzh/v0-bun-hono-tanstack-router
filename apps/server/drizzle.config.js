import "dotenv/config";
import { defineConfig } from "@drepkovsky/drizzle-migrations";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  /**
   * Drizzle-migrations configuration
   * @see https://github.com/drepkovsky/drizzle-migrations#configuration
   */
  migrations: {
    schema: "public",
    table: "drizzle_migrations",
  },
  getMigrator: async () => {
    const migrationClient = new Pool({ connectionString: databaseUrl, max: 1 });

    return drizzle(migrationClient);
  },
});
