#!/usr/bin/env node
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
    console.error('DATABASE_URL is required in production');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL set, skipping migrations (development mode)');
    return;
  }

  console.log('Running database migrations...');
  console.log('Environment:', process.env.NODE_ENV || 'development');

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false }
        : false
    });

    const db = drizzle(pool);
    
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../src/db/migrations')
    });

    console.log('✅ Migrations completed successfully');
    await pool.end();
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}

export { runMigrations };