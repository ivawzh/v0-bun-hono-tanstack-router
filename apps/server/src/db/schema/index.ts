import { pgTable, text, uuid, timestamp, jsonb, boolean, integer, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enum for agent client types
export const agentClientTypeEnum = pgEnum("agent_client_type", ["CLAUDE_CODE", "CURSOR_CLI", "OPENCODE"]);

// User table (minimal for single user)
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Agent Clients table (for tracking agent client states)
export const agentClients = pgTable("agent_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: agentClientTypeEnum("type").notNull(),
  state: jsonb("state").default({}).notNull(), // { lastMessagedAt, lastSessionCompletedAt, lastSessionCreatedAt, lastTaskPushedAt }
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
  agentClientId: uuid("agent_client_id").notNull().references(() => agentClients.id),
  name: text("name").notNull(),
  repoPath: text("repo_path").notNull(), // Local file system path
  config: jsonb("config").default({}), // Client-specific settings
  isPaused: boolean("is_paused").default(false), // Pause new task assignment
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
  
  // Priority (1-5 where 5=highest, 1=lowest)
  priority: integer("priority").notNull().default(3), // 1=Lowest, 2=Low, 3=Medium, 4=High, 5=Highest
  
  // Manual order within status column (for drag & drop)
  columnOrder: text("column_order").notNull().default("1000"), // Decimal string for ordering within status
  
  // Ready flag (replaces auto-start)
  ready: boolean("ready").default(false),
  
  // AI working flag
  isAiWorking: boolean("is_ai_working").default(false),
  
  // Task authorship (human or ai)
  author: text("author").notNull().default("human"), // human, ai
  
  // Attachments
  attachments: jsonb("attachments").default([]), // Array of attachment objects
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Sessions table (for tracking agent work sessions)
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentSessionId: text("agent_session_id"), // ID from agent client (Claude Code UI, etc.)
  taskId: uuid("task_id").references(() => tasks.id), // Made nullable
  repoAgentId: uuid("repo_agent_id").notNull().references(() => repoAgents.id),
  status: text("status").notNull().default("starting"), // starting, active, completed, failed
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at")
});

// Task Dependencies table (many-to-many relationships)
export const taskDependencies = pgTable("task_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  dependsOnTaskId: uuid("depends_on_task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects)
}));

export const agentClientsRelations = relations(agentClients, ({ many }) => ({
  repoAgents: many(repoAgents)
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
  agentClient: one(agentClients, {
    fields: [repoAgents.agentClientId],
    references: [agentClients.id]
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
  sessions: many(sessions),
  dependencies: many(taskDependencies, {
    relationName: "taskDependencies"
  }),
  dependents: many(taskDependencies, {
    relationName: "dependentTasks"
  })
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

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
    relationName: "taskDependencies"
  }),
  dependsOnTask: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
    relationName: "dependentTasks"
  })
}));