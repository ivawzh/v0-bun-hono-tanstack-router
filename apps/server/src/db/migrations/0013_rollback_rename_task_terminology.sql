-- Rollback: Rename task column/mode back to status/stage terminology
-- This migration reverts the terminology changes

-- Rename column back to status
ALTER TABLE tasks RENAME COLUMN "column" TO status;

-- Rename mode back to stage
ALTER TABLE tasks RENAME COLUMN mode TO stage;