-- Solo Unicorn Simplified Schema Migration
-- Implements the least powerful principle: one user, one machine, one coding session

-- Users table (minimal for single user)
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL UNIQUE,
	"display_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Projects table (no separate boards - 1 project = 1 board)
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"owner_id" uuid NOT NULL REFERENCES "users"("id"),
	"memory" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Repo Agents table (repository path + coding client combination)
CREATE TABLE "repo_agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "projects"("id"),
	"name" text NOT NULL,
	"repo_path" text NOT NULL,
	"client_type" text NOT NULL,
	"config" jsonb DEFAULT '{}',
	"status" text NOT NULL DEFAULT 'idle',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Actors table (agent personalities/methodologies)
CREATE TABLE "actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "projects"("id"),
	"name" text NOT NULL,
	"description" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Tasks table (simplified workflow: Todo → Doing → Done)
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL REFERENCES "projects"("id"),
	"repo_agent_id" uuid NOT NULL REFERENCES "repo_agents"("id"),
	"actor_id" uuid REFERENCES "actors"("id"),
	"raw_title" text NOT NULL,
	"raw_description" text,
	"refined_title" text,
	"refined_description" text,
	"plan" jsonb DEFAULT '{}',
	"status" text NOT NULL DEFAULT 'todo',
	"stage" text,
	"priority" text NOT NULL DEFAULT 'P3',
	"ready" boolean DEFAULT false,
	"attachments" jsonb DEFAULT '[]',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Sessions table (track agent work sessions)
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL REFERENCES "tasks"("id"),
	"repo_agent_id" uuid NOT NULL REFERENCES "repo_agents"("id"),
	"status" text NOT NULL DEFAULT 'starting',
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);

-- Add constraints
ALTER TABLE "repo_agents" ADD CONSTRAINT "repo_agents_status_check"
CHECK ("status" IN ('idle', 'active', 'rate_limited', 'error'));

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_check"
CHECK ("status" IN ('todo', 'doing', 'done'));

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_stage_check"
CHECK ("stage" IS NULL OR "stage" IN ('clarify', 'kickoff', 'execute'));

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_check"
CHECK ("priority" IN ('P1', 'P2', 'P3', 'P4', 'P5'));

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_status_check"
CHECK ("status" IN ('starting', 'active', 'completed', 'failed'));

-- Create indexes for performance
CREATE INDEX "projects_owner_id_idx" ON "projects"("owner_id");
CREATE INDEX "repo_agents_project_id_idx" ON "repo_agents"("project_id");
CREATE INDEX "actors_project_id_idx" ON "actors"("project_id");
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");
CREATE INDEX "tasks_repo_agent_id_idx" ON "tasks"("repo_agent_id");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_ready_idx" ON "tasks"("ready") WHERE "ready" = true;
CREATE INDEX "sessions_task_id_idx" ON "sessions"("task_id");
CREATE INDEX "sessions_repo_agent_id_idx" ON "sessions"("repo_agent_id");
