-- Convert priority field from string P1-P5 to numeric 1-5
-- This migration follows the mapping: P5→5, P4→4, P3→3, P2→2, P1→1

-- 1. Add new numeric priority column
ALTER TABLE "tasks" ADD COLUMN "priority_numeric" integer NOT NULL DEFAULT 3;

-- 2. Migrate existing data with proper mapping
UPDATE "tasks" SET "priority_numeric" = 
  CASE 
    WHEN "priority" = 'P5' THEN 5  -- Highest
    WHEN "priority" = 'P4' THEN 4  -- High
    WHEN "priority" = 'P3' THEN 3  -- Medium  
    WHEN "priority" = 'P2' THEN 2  -- Low
    WHEN "priority" = 'P1' THEN 1  -- Lowest
    ELSE 3  -- Default to Medium for any unknown values
  END;

-- 3. Drop the old string priority column
ALTER TABLE "tasks" DROP COLUMN "priority";

-- 4. Rename the new column to priority
ALTER TABLE "tasks" RENAME COLUMN "priority_numeric" TO "priority";

-- 5. Add constraint to ensure priority values are between 1 and 5
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_range" CHECK ("priority" >= 1 AND "priority" <= 5);