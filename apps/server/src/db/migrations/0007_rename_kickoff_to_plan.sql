-- Migration: Rename stage 'kickoff' to 'plan'
-- Updates the tasks table stage constraint and any existing data

-- Drop the existing stage constraint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_stage_check";

-- Update any existing 'kickoff' stage values to 'plan'
UPDATE "tasks" SET "stage" = 'plan' WHERE "stage" = 'kickoff';

-- Add the new stage constraint with 'plan' instead of 'kickoff'
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stage_check" 
CHECK ("stage" IS NULL OR "stage" IN ('refine', 'plan', 'execute'));