import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

// Plugin to handle database migrations on hot updates
function dbMigrationPlugin() {
  return {
    name: 'db-migration',
    configureServer(server: any) {
      // Run migrations on server start in dev/test environments
      const nodeEnv = process.env.NODE_ENV;
      if (nodeEnv === 'development' || nodeEnv === 'test') {
        console.log('🔄 Running initial DB migrations on server start...');
        runMigrations();
      }
    },
    handleHotUpdate(ctx: any) {
      const nodeEnv = process.env.NODE_ENV;
      
      // Only run in development or test environments
      if (nodeEnv !== 'development' && nodeEnv !== 'test') {
        return;
      }

      // Check if migration files were updated
      const migrationsPath = path.resolve(process.cwd(), 'src/db/migrations');
      const isMigrationFile = ctx.file.startsWith(migrationsPath);
      
      if (isMigrationFile) {
        console.log('🔄 Migration file changed, running DB migrations...');
        runMigrations();
      }
      
      // Let other hot updates proceed normally
      return;
    }
  };
}

async function runMigrations() {
  try {
    // Dynamic import to avoid loading at build time
    const { runDatabaseMigrations } = await import('./src/db/migrate');
    await runDatabaseMigrations();
  } catch (error) {
    console.error('❌ Failed to run migrations:', error);
  }
}

export default defineConfig({
  plugins: [dbMigrationPlugin()],
  build: {
    target: 'node20',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: [
        // External dependencies that shouldn't be bundled
        'pg',
        '@electric-sql/pglite',
        'drizzle-orm',
        'ws',
        /^node:/
      ]
    }
  },
  esbuild: {
    target: 'node20'
  }
});