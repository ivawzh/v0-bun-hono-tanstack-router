-- Rename client_type column to agent_client_id and change its type from text to uuid
-- This migration renames the column and updates it to reference the agents table

-- Add the new agent_client_id column as uuid
ALTER TABLE "repo_agents" ADD COLUMN "agent_client_id" uuid;--> statement-breakpoint

-- Update agent_client_id values by joining with agents table on client_type
UPDATE "repo_agents" SET "agent_client_id" = (
  SELECT "agents"."id" 
  FROM "agents" 
  WHERE "agents"."type" = "repo_agents"."client_type"::agent_client_type
);--> statement-breakpoint

-- Make the new column NOT NULL
ALTER TABLE "repo_agents" ALTER COLUMN "agent_client_id" SET NOT NULL;--> statement-breakpoint

-- Add foreign key constraint to reference agents table
ALTER TABLE "repo_agents" ADD CONSTRAINT "repo_agents_agent_client_id_agents_id_fk" FOREIGN KEY ("agent_client_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Drop the old client_type column
ALTER TABLE "repo_agents" DROP COLUMN "client_type";