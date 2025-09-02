import "dotenv/config";
import { defineConfig } from "@drepkovsky/drizzle-migrations";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "env";

const databaseUrl = getEnv().databaseUrl;
const config: unknown = defineConfig({
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
    const migrationClient = postgres(databaseUrl, {
      max: 1,
    });

    return drizzle(migrationClient);
  },
});

export default config;
