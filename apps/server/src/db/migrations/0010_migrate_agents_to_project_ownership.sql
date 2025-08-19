-- Migration: Change agents table from user ownership to project ownership
-- This migration changes agents.user_id to agents.project_id

-- Step 1: Add project_id column
ALTER TABLE agents ADD COLUMN project_id uuid;

-- Step 2: Migrate data - assign agents to users' first project (or create a default project if none exists)
-- For simplicity, we'll assign all agents to the first project of their owner
UPDATE agents 
SET project_id = (
    SELECT p.id 
    FROM projects p 
    WHERE p.owner_id = agents.user_id 
    LIMIT 1
)
WHERE project_id IS NULL;

-- If any agents still don't have a project_id, create a default project for those users
INSERT INTO projects (name, description, owner_id, memory, repo_concurrency_limit, settings)
SELECT 
    'Default Project',
    'Default project for migrated agents',
    u.id,
    '{}',
    1,
    '{}'
FROM users u
WHERE u.id IN (
    SELECT DISTINCT user_id 
    FROM agents 
    WHERE project_id IS NULL
);

-- Update remaining agents to use the newly created default project
UPDATE agents 
SET project_id = (
    SELECT p.id 
    FROM projects p 
    WHERE p.owner_id = agents.user_id 
    AND p.name = 'Default Project'
    LIMIT 1
)
WHERE project_id IS NULL;

-- Step 3: Make project_id NOT NULL and add foreign key constraint
ALTER TABLE agents ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE agents ADD CONSTRAINT agents_project_id_projects_id_fk 
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- Step 4: Drop the old user_id column and its constraint
ALTER TABLE agents DROP CONSTRAINT agents_user_id_users_id_fk;
ALTER TABLE agents DROP COLUMN user_id;