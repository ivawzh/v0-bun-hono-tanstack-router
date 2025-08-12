-- Add Claude Code integration fields to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS local_repo_path TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS claude_project_id TEXT;

-- Create index for faster lookups by Claude project ID
CREATE INDEX IF NOT EXISTS idx_projects_claude_project_id ON projects(claude_project_id);