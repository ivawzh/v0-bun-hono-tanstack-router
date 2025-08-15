-- Rename agents table to agent_clients and remove status field from repo_agents
-- This migration handles the schema refactoring to prevent duplicate task pushing

-- 1. Rename agents table to agent_clients
ALTER TABLE "agents" RENAME TO "agent_clients";

-- 2. Remove lastTaskPushedAt column from agent_clients (move to state JSONB)
ALTER TABLE "agent_clients" DROP COLUMN IF EXISTS "last_task_pushed_at";

-- 3. Remove status column from repo_agents table
ALTER TABLE "repo_agents" DROP COLUMN "status";

-- 4. Update foreign key constraint name to match new table name
ALTER TABLE "repo_agents" DROP CONSTRAINT "repo_agents_agent_client_id_agents_id_fk";
ALTER TABLE "repo_agents" ADD CONSTRAINT "repo_agents_agent_client_id_agent_clients_id_fk" FOREIGN KEY ("agent_client_id") REFERENCES "public"."agent_clients"("id") ON DELETE no action ON UPDATE no action;