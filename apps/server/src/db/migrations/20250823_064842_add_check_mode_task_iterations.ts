
  import { sql } from 'drizzle-orm'
  import type { MigrationArgs } from '@drepkovsky/drizzle-migrations'

  export async function up({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          -- Create task_iterations table
          CREATE TABLE "task_iterations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"iteration_number" integer NOT NULL,
	"feedback_reason" text NOT NULL,
	"rejected_at" timestamp DEFAULT now() NOT NULL,
	"rejected_by" text DEFAULT 'human' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "task_iterations" ADD CONSTRAINT "task_iterations_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;

-- Create indexes for efficient taskIterations queries
CREATE INDEX "task_iterations_task_id_idx" ON "task_iterations" ("task_id");
CREATE INDEX "task_iterations_rejected_at_idx" ON "task_iterations" ("rejected_at");
        `);
  
  };

  export async function down({ db }: MigrationArgs<'postgresql'>): Promise<void> {
  await db.execute(sql`
          -- Drop indexes
          DROP INDEX IF EXISTS "task_iterations_task_id_idx";
          DROP INDEX IF EXISTS "task_iterations_rejected_at_idx";
          
          -- Drop task_iterations table
          DROP TABLE "task_iterations" CASCADE;
        `);
  
  };
  