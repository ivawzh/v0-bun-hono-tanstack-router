-- Rename task status/stage to column/mode terminology
-- This migration updates the database schema to use more accurate terminology

-- Rename status column to column
ALTER TABLE tasks RENAME COLUMN status TO "column";

-- Rename stage column to mode  
ALTER TABLE tasks RENAME COLUMN stage TO mode;