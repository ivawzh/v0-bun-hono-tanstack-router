import { defineConfig } from "drizzle-kit";

// Use PGlite filesystem path in dev if DATABASE_URL is missing
const usePGlite = !process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: usePGlite ? "sqlite" : "postgresql",
  dbCredentials: usePGlite
    ? { url: "file:./pgdata/dev.sqlite" }
    : { url: process.env.DATABASE_URL as string },
});
