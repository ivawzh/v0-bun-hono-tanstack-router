import { pgTable, text, uuid, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// User table (minimal for single user)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Project table (simplified - no separate boards)
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  memory: jsonb("memory").default({}), // Project context for agents
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Repo Agents table (combination of repository + coding client)
export const repoAgents = pgTable("repo_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  repoPath: text("repo_path").notNull(), // Local file system path
  clientType: text("client_type").notNull(), // claude_code, opencode, etc.
  config: jsonb("config").default({}), // Client-specific settings
  status: text("status").notNull().default("idle"), // idle, active, rate_limited, error
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Actors table (agent personalities/methodologies)
export const actors = pgTable("actors", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  description: text("description").notNull(), // Agent personality/methodology
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Tasks table (simplified)
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  repoAgentId: uuid("repo_agent_id").notNull().references(() => repoAgents.id),
  actorId: uuid("actor_id").references(() => actors.id),
  
  // Raw information (human input)
  rawTitle: text("raw_title").notNull(),
  rawDescription: text("raw_description"),
  
  // Refined information (agent generated)
  refinedTitle: text("refined_title"),
  refinedDescription: text("refined_description"),
  
  // Kickoff results
  plan: jsonb("plan").default({}), // Final solution and spec from kickoff
  
  // Status and stage
  status: text("status").notNull().default("todo"), // todo, doing, done
  stage: text("stage"), // refine, kickoff, execute (only for doing status)
  
  // Priority (unified P1-P5)
  priority: text("priority").notNull().default("P3"), // P1, P2, P3, P4, P5
  
  // Ready flag (replaces auto-start)
  ready: boolean("ready").default(false),
  
  // Attachments
  attachments: jsonb("attachments").default([]), // Array of attachment objects
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Sessions table (for tracking agent work sessions)
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  repoAgentId: uuid("repo_agent_id").notNull().references(() => repoAgents.id),
  status: text("status").notNull().default("starting"), // starting, active, completed, failed
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at")
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects)
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id]
  }),
  repoAgents: many(repoAgents),
  actors: many(actors),
  tasks: many(tasks)
}));

export const repoAgentsRelations = relations(repoAgents, ({ one, many }) => ({
  project: one(projects, {
    fields: [repoAgents.projectId],
    references: [projects.id]
  }),
  tasks: many(tasks),
  sessions: many(sessions)
}));

export const actorsRelations = relations(actors, ({ one, many }) => ({
  project: one(projects, {
    fields: [actors.projectId],
    references: [projects.id]
  }),
  tasks: many(tasks)
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id]
  }),
  repoAgent: one(repoAgents, {
    fields: [tasks.repoAgentId],
    references: [repoAgents.id]
  }),
  actor: one(actors, {
    fields: [tasks.actorId],
    references: [actors.id]
  }),
  sessions: many(sessions)
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  task: one(tasks, {
    fields: [sessions.taskId],
    references: [tasks.id]
  }),
  repoAgent: one(repoAgents, {
    fields: [sessions.repoAgentId],
    references: [repoAgents.id]
  })
}));