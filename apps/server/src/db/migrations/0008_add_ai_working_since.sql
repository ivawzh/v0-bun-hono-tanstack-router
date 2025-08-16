-- Migration: Add ai_working_since timestamp to tasks table
-- Tracks when isAiWorking was set to true for timeout detection

ALTER TABLE "tasks" ADD COLUMN "ai_working_since" timestamp;