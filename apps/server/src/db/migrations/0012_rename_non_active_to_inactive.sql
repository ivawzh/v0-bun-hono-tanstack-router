-- Solo Unicorn Migration: Rename NON_ACTIVE to INACTIVE
-- Date: 2025-08-21
-- Description: Global rename of agentSessionStatus enum value from NON_ACTIVE to INACTIVE

-- Update existing NON_ACTIVE values to INACTIVE
UPDATE tasks 
SET agent_session_status = 'INACTIVE' 
WHERE agent_session_status = 'NON_ACTIVE';

-- Update the default value for the column
ALTER TABLE tasks 
ALTER COLUMN agent_session_status SET DEFAULT 'INACTIVE';