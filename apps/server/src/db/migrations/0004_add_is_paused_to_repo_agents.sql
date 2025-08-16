-- Add is_paused column to repo_agents table
-- This allows pausing individual agents from receiving new tasks

ALTER TABLE "repo_agents" ADD COLUMN "is_paused" boolean DEFAULT false NOT NULL;