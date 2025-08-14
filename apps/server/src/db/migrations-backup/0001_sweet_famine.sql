CREATE TABLE "agent_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text,
	"provider_hint" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"inferred_reset_at" timestamp,
	"next_retry_at" timestamp,
	"resolved_at" timestamp,
	"resolution" text,
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "chat_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"name" text,
	"topic" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"parent_message_id" uuid,
	"author" text NOT NULL,
	"content_md" text NOT NULL,
	"mentions" jsonb DEFAULT '[]'::jsonb,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "account" CASCADE;--> statement-breakpoint
DROP TABLE "session" CASCADE;--> statement-breakpoint
DROP TABLE "user" CASCADE;--> statement-breakpoint
DROP TABLE "verification" CASCADE;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "state" text DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "next_retry_at" timestamp;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "last_incident_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "agent_paused" jsonb DEFAULT 'false'::jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "local_repo_path" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "claude_project_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "is_blocked" jsonb DEFAULT 'false'::jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "qa_required" jsonb DEFAULT 'false'::jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "agent_ready" jsonb DEFAULT 'false'::jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "active_session_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_incidents" ADD CONSTRAINT "agent_incidents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channel_id_chat_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channels"("id") ON DELETE no action ON UPDATE no action;