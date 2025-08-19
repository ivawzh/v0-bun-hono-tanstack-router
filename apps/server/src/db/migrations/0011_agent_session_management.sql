-- Agent Session Management Migration
-- Replace old session tracking fields with new session management system

BEGIN;

-- Add new fields to tasks table
ALTER TABLE tasks ADD COLUMN agent_session_status TEXT NOT NULL DEFAULT 'NON_ACTIVE';
ALTER TABLE tasks ADD COLUMN active_agent_id UUID REFERENCES agents(id);
ALTER TABLE tasks ADD COLUMN last_pushed_at TIMESTAMP;
ALTER TABLE tasks ADD COLUMN last_agent_session_started_at TIMESTAMP;

-- Add rate limit field to agents table
ALTER TABLE agents ADD COLUMN rate_limit_reset_at TIMESTAMP;

-- Drop old fields from tasks table
ALTER TABLE tasks DROP COLUMN is_ai_working;
ALTER TABLE tasks DROP COLUMN ai_working_since;

COMMIT;