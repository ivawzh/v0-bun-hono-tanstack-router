  import { sql } from 'drizzle-orm'
  import type { MigrationArgs } from '@drepkovsky/drizzle-migrations'

  export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          -- Rename feedback_reason to feedback
          ALTER TABLE "task_iterations" RENAME COLUMN "feedback_reason" TO "feedback";
          
          -- Drop rejected_at column as it's replaced by created_at
          ALTER TABLE "task_iterations" DROP COLUMN "rejected_at";
          
          -- Drop the rejected_at index
          DROP INDEX IF EXISTS "task_iterations_rejected_at_idx";
          
          -- Add new created_by column as UUID reference to users
          ALTER TABLE "task_iterations" ADD COLUMN "created_by" uuid;
          
          -- Copy existing rejected_by data (convert 'human' to NULL for now)
          UPDATE "task_iterations" SET "created_by" = NULL;
          
          -- Drop old rejected_by column  
          ALTER TABLE "task_iterations" DROP COLUMN "rejected_by";
          
          -- Add foreign key constraint to users table
          ALTER TABLE "task_iterations" ADD CONSTRAINT "task_iterations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
          
          -- Create index for created_by
          CREATE INDEX "task_iterations_created_by_idx" ON "task_iterations" ("created_by");
        `);
  
  };

  export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          -- Drop created_by index and foreign key
          DROP INDEX IF EXISTS "task_iterations_created_by_idx";
          ALTER TABLE "task_iterations" DROP CONSTRAINT IF EXISTS "task_iterations_created_by_users_id_fk";
          
          -- Add back rejected_by column
          ALTER TABLE "task_iterations" ADD COLUMN "rejected_by" text DEFAULT 'human' NOT NULL;
          
          -- Drop created_by column
          ALTER TABLE "task_iterations" DROP COLUMN "created_by";
          
          -- Add back rejected_at column
          ALTER TABLE "task_iterations" ADD COLUMN "rejected_at" timestamp DEFAULT now() NOT NULL;
          
          -- Create rejected_at index
          CREATE INDEX "task_iterations_rejected_at_idx" ON "task_iterations" ("rejected_at");
          
          -- Rename feedback back to feedback_reason
          ALTER TABLE "task_iterations" RENAME COLUMN "feedback" TO "feedback_reason";
        `);
  
  };
  