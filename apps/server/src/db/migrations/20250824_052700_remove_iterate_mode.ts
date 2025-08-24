import { sql } from 'drizzle-orm'
import type { MigrationArgs } from '@drepkovsky/drizzle-migrations'

export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
    -- Update any existing tasks with 'iterate' mode to 'execute' mode
    UPDATE tasks SET mode = 'execute' WHERE mode = 'iterate';
    
    -- Remove 'iterate' value from the task_mode enum
    -- First create a new enum without 'iterate'
    CREATE TYPE task_mode_new AS ENUM ('clarify', 'plan', 'execute', 'loop', 'talk', 'check');
    
    -- Update the column to use the new enum
    ALTER TABLE tasks ALTER COLUMN mode TYPE task_mode_new USING mode::text::task_mode_new;
    
    -- Drop the old enum and rename the new one
    DROP TYPE task_mode;
    ALTER TYPE task_mode_new RENAME TO task_mode;
  `);
}

export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
    -- Recreate the old enum with 'iterate'
    CREATE TYPE task_mode_new AS ENUM ('clarify', 'plan', 'execute', 'iterate', 'loop', 'talk', 'check');
    
    -- Update the column to use the old enum
    ALTER TABLE tasks ALTER COLUMN mode TYPE task_mode_new USING mode::text::task_mode_new;
    
    -- Drop the current enum and rename the new one
    DROP TYPE task_mode;
    ALTER TYPE task_mode_new RENAME TO task_mode;
  `);
}