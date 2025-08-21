import { pgTable, text, uuid, timestamp, jsonb, boolean, integer, pgEnum, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export type Task = typeof tasks.$inferSelect;
export type Actor = typeof actors.$inferSelect;
export type Repository = typeof repositories.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type User = typeof users.$inferSelect;
export type Helper = typeof helpers.$inferSelect;
export type ProjectInvitation = typeof projectInvitations.$inferSelect;

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

// Project table (simplified - no separate boards)
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  memory: jsonb("memory").default({}), // Project context for agents
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Helpers table (for system state management like locks)
export const helpers = pgTable("helpers", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  state: jsonb("state").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  codeUniqueIndex: unique().on(table.code)
}));

// Project Users table (many-to-many relationship)
export const projectUsers = pgTable("project_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // member, admin, owner
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Project Invitations table (email-based invitations)
export const projectInvitations = pgTable("project_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  invitedByUserId: uuid("invited_by_user_id").notNull().references(() => users.id),
  email: text("email").notNull(),
  role: text("role").notNull().default("member"), // member, admin, owner
  token: text("token").notNull().unique(), // UUID token for invitation link
  status: text("status").notNull().default("pending"), // pending, accepted, declined, expired
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Agents table (replaces agentClients, now project-owned)
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Auto-generated or user-defined
  agentType: agentClientTypeEnum("agent_type").notNull().default("CLAUDE_CODE"),
  agentSettings: jsonb("agent_settings").default({}).notNull(), // { CLAUDE_CONFIG_DIR, etc. }
  maxConcurrencyLimit: integer("max_concurrency_limit").default(0), // 0 = limitless, >0 = max concurrent tasks per agent
  lastTaskPushedAt: timestamp("last_task_pushed_at"), // Track when agent last got assigned a task
  rateLimitResetAt: timestamp("rate_limit_reset_at"), // Direct field for rate limit reset time
  state: jsonb("state").default({}).notNull(), // Current state tracking (non-rate limit data)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Repositories table (replaces repo agents)
export const repositories = pgTable("repositories", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  repoPath: text("repo_path").notNull(), // Local filesystem path
  isDefault: boolean("is_default").default(false), // One default per project
  maxConcurrencyLimit: integer("max_concurrency_limit").default(1), // 0 = limitless, >0 = max concurrent tasks per repository
  lastTaskPushedAt: timestamp("last_task_pushed_at"), // Track when repo last got assigned a task
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

// Tasks table (updated for V2)
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  mainRepositoryId: uuid("main_repository_id").notNull().references(() => repositories.id),
  actorId: uuid("actor_id").references(() => actors.id),

  // Raw information (human input)
  rawTitle: text("raw_title").notNull(),
  rawDescription: text("raw_description"),

  // Refined information (agent generated)
  refinedTitle: text("refined_title"),
  refinedDescription: text("refined_description"),

  // Plan results
  plan: jsonb("plan").default({}), // Final solution and spec from plan stage

  // Column and mode
  list: text("list", { enum: ["todo", "doing", "done", "loop"] }).notNull().default("todo"),
  mode: text("mode", { enum: ["clarify", "plan", "execute", "loop", "talk"] }),

  // Priority (1-5 where 5=highest, 1=lowest)
  priority: integer("priority").notNull().default(3), // 1=Lowest, 2=Low, 3=Medium, 4=High, 5=Highest

  // Manual order within column (for drag & drop)
  columnOrder: text("column_order").notNull().default("1000"), // Decimal string for ordering within column

  // Ready flag (replaces auto-start)
  ready: boolean("ready").default(false),

  // Agent session status for new session management
  agentSessionStatus: text("agent_session_status").notNull().default("INACTIVE"), // INACTIVE, PUSHING, ACTIVE

  // Active agent reference for direct agent lookup
  activeAgentId: uuid("active_agent_id").references(() => agents.id),

  // Last pushed timestamp for rate limiting
  lastPushedAt: timestamp("last_pushed_at"),

  // Last agent session started timestamp
  lastAgentSessionStartedAt: timestamp("last_agent_session_started_at"),

  // Task authorship (human or ai)
  author: text("author").notNull().default("human"), // human, ai

  // Attachments
  attachments: jsonb("attachments").default([]), // Array of attachment objects

  // Agent session tracking
  lastAgentSessionId: text("last_agent_session_id"), // Store agent session ID directly

  // Task creation context (for AI-generated tasks)
  createdByTaskId: uuid("created_by_task_id"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Task-Repository many-to-many for additional repos
export const taskAdditionalRepositories = pgTable("task_additional_repositories", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  repositoryId: uuid("repository_id").notNull().references(() => repositories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Task-Agent many-to-many assignment
export const taskAgents = pgTable("task_agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
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
  projects: many(projects),
  projectMemberships: many(projectUsers),
  sentInvitations: many(projectInvitations)
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id]
  }),
  projectUsers: many(projectUsers),
  invitations: many(projectInvitations),
  repositories: many(repositories),
  actors: many(actors),
  agents: many(agents),
  tasks: many(tasks)
}));

export const projectUsersRelations = relations(projectUsers, ({ one }) => ({
  user: one(users, {
    fields: [projectUsers.userId],
    references: [users.id]
  }),
  project: one(projects, {
    fields: [projectUsers.projectId],
    references: [projects.id]
  })
}));

export const projectInvitationsRelations = relations(projectInvitations, ({ one }) => ({
  project: one(projects, {
    fields: [projectInvitations.projectId],
    references: [projects.id]
  }),
  invitedByUser: one(users, {
    fields: [projectInvitations.invitedByUserId],
    references: [users.id]
  })
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  project: one(projects, {
    fields: [agents.projectId],
    references: [projects.id]
  }),
  taskAssignments: many(taskAgents)
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  project: one(projects, {
    fields: [repositories.projectId],
    references: [projects.id]
  }),
  mainTasks: many(tasks),
  additionalTasks: many(taskAdditionalRepositories)
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
  mainRepository: one(repositories, {
    fields: [tasks.mainRepositoryId],
    references: [repositories.id]
  }),
  actor: one(actors, {
    fields: [tasks.actorId],
    references: [actors.id]
  }),
  // Reference to parent task that created this one (e.g. for AI-generated tasks)
  createdByTask: one(tasks, {
    fields: [tasks.createdByTaskId],
    references: [tasks.id],
    relationName: "taskCreator"
  }),
  additionalRepositories: many(taskAdditionalRepositories),
  assignedAgents: many(taskAgents),
  dependencies: many(taskDependencies, {
    relationName: "taskDependencies"
  }),
  dependents: many(taskDependencies, {
    relationName: "dependentTasks"
  }),
  // Reference to parent task that created this one (e.g. for AI-generated tasks)
  createdTasks: many(tasks, {
    relationName: "taskCreator"
  })
}));

export const taskAdditionalRepositoriesRelations = relations(taskAdditionalRepositories, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAdditionalRepositories.taskId],
    references: [tasks.id]
  }),
  repository: one(repositories, {
    fields: [taskAdditionalRepositories.repositoryId],
    references: [repositories.id]
  })
}));

export const taskAgentsRelations = relations(taskAgents, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAgents.taskId],
    references: [tasks.id]
  }),
  agent: one(agents, {
    fields: [taskAgents.agentId],
    references: [agents.id]
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
