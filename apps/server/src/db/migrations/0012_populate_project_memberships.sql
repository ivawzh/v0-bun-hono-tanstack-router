-- Create project memberships for existing project owners
-- This ensures backward compatibility with the new project membership system

INSERT INTO project_users (user_id, project_id, role, created_at)
SELECT 
    projects.owner_id,
    projects.id,
    'admin',
    projects.created_at
FROM projects
WHERE NOT EXISTS (
    SELECT 1 FROM project_users 
    WHERE project_users.user_id = projects.owner_id 
    AND project_users.project_id = projects.id
);