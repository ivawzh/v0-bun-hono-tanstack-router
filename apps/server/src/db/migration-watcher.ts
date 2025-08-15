import { watch } from 'fs';
import path from 'path';
import { runDatabaseMigrations } from './migrate';

let isWatching = false;
let migrationTimeout: NodeJS.Timeout | null = null;

export function startMigrationWatcher() {
  const nodeEnv = process.env.NODE_ENV;
  
  // Only watch in development or test environments
  if (nodeEnv !== 'development' && nodeEnv !== 'test') {
    return;
  }

  if (isWatching) {
    return;
  }

  const migrationsPath = path.resolve(process.cwd(), 'src/db/migrations');
  
  console.log('👀 Starting migration file watcher...');
  
  try {
    // Watch the migrations directory
    const watcher = watch(migrationsPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      
      console.log(`📁 Migration file ${eventType}: ${filename}`);
      
      // Debounce multiple file changes
      if (migrationTimeout) {
        clearTimeout(migrationTimeout);
      }
      
      migrationTimeout = setTimeout(() => {
        console.log('🔄 Running migrations due to file changes...');
        runDatabaseMigrations();
      }, 500); // Wait 500ms for multiple changes
    });

    isWatching = true;
    
    // Run initial migrations on startup
    setTimeout(() => {
      console.log('🚀 Running initial migrations on startup...');
      runDatabaseMigrations();
    }, 1000);

    // Cleanup on process exit
    process.on('SIGINT', () => {
      console.log('🛑 Stopping migration watcher...');
      watcher.close();
      if (migrationTimeout) {
        clearTimeout(migrationTimeout);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start migration watcher:', error);
  }
}

export function stopMigrationWatcher() {
  if (migrationTimeout) {
    clearTimeout(migrationTimeout);
    migrationTimeout = null;
  }
  isWatching = false;
}