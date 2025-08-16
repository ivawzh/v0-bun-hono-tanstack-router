-- Add author column to tasks table
-- This tracks whether a task was created by a human or AI agent

ALTER TABLE "tasks" ADD COLUMN "author" text NOT NULL DEFAULT 'human' CHECK (author IN ('human', 'ai'));