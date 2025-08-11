import { defineConfig } from "drizzle-kit";

// Use PGlite filesystem path in dev if DATABASE_URL is missing
const usePGlite = !process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: usePGlite
    ? { url: "postgresql://localhost/pglite?sslmode=disable" }
    : { url: process.env.DATABASE_URL as string },
});
