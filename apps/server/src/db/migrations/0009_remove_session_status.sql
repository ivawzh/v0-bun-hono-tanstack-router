-- Remove session status field
-- Drop the status check constraint first
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_status_check";

-- Drop the status column
ALTER TABLE "sessions" DROP COLUMN IF EXISTS "status";