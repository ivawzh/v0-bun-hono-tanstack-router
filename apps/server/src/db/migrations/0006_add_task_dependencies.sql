-- Create task_dependencies table for many-to-many task dependencies
-- This enables AI agents to create tasks with dependency relationships

CREATE TABLE "task_dependencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "depends_on_task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE("task_id", "depends_on_task_id")
);

-- Add index for efficient querying
CREATE INDEX "idx_task_dependencies_task_id" ON "task_dependencies"("task_id");
CREATE INDEX "idx_task_dependencies_depends_on_task_id" ON "task_dependencies"("depends_on_task_id");