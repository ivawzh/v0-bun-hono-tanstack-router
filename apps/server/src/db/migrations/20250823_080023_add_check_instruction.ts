
  import { sql } from 'drizzle-orm'
  import type { MigrationArgs } from '@drepkovsky/drizzle-migrations'

  export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          ALTER TABLE "tasks" ADD COLUMN "check_instruction" text;
        `);
  
  };

  export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          ALTER TABLE "tasks" DROP COLUMN "check_instruction";
        `);
  
  };
  