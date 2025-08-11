-- Add new fields to tasks table for UI/UX design requirements
ALTER TABLE "tasks" ADD COLUMN "is_blocked" jsonb DEFAULT 'false';
ALTER TABLE "tasks" ADD COLUMN "qa_required" jsonb DEFAULT 'false';
ALTER TABLE "tasks" ADD COLUMN "agent_ready" jsonb DEFAULT 'false';

-- Add project-level agent pause control
ALTER TABLE "projects" ADD COLUMN "agent_paused" jsonb DEFAULT 'false';

-- Update task status comment to reflect new values (documentation only)
COMMENT ON COLUMN "tasks"."status" IS 'todo|in_progress|qa|done|paused';

-- Create chat channels table for project/board/task chat
CREATE TABLE IF NOT EXISTS "chat_channels" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "scope_type" text NOT NULL,
    "scope_id" uuid NOT NULL,
    "name" text,
    "topic" text,
    "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "channel_id" uuid NOT NULL REFERENCES "chat_channels"("id"),
    "parent_message_id" uuid,
    "author" text NOT NULL,
    "content_md" text NOT NULL,
    "mentions" jsonb DEFAULT '[]',
    "at" timestamp DEFAULT now() NOT NULL
);

-- Add self-referential foreign key for message threading
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_parent_fk" 
    FOREIGN KEY ("parent_message_id") REFERENCES "chat_messages"("id");

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "chat_channels_scope_idx" ON "chat_channels" ("scope_type", "scope_id");
CREATE INDEX IF NOT EXISTS "chat_messages_channel_idx" ON "chat_messages" ("channel_id");
CREATE INDEX IF NOT EXISTS "chat_messages_parent_idx" ON "chat_messages" ("parent_message_id");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" ("status");
CREATE INDEX IF NOT EXISTS "tasks_blocked_idx" ON "tasks" ("is_blocked");