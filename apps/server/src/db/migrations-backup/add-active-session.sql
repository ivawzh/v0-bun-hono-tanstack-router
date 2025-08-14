-- Add activeSessionId to tasks table to track current agent session
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS active_session_id UUID REFERENCES agent_sessions(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_active_session_id ON tasks(active_session_id);