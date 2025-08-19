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

// Project table (simplified - no separate boards)
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  memory: jsonb("memory").default({}), // Project context for agents
  repoConcurrencyLimit: integer("repo_concurrency_limit").default(1),
  settings: jsonb("settings").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Project Users table (many-to-many relationship)
export const projectUsers = pgTable("project_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // member, admin (for future)
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Agents table (replaces agentClients, now project-owned)
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Auto-generated or user-defined
  agentType: agentClientTypeEnum("agent_type").notNull().default("CLAUDE_CODE"),
  agentSettings: jsonb("agent_settings").default({}).notNull(), // { CLAUDE_CONFIG_DIR, etc. }
  maxConcurrencyLimit: integer("max_concurrency_limit").default(1), // User configurable concurrency limit per agent
  lastTaskPushedAt: timestamp("last_task_pushed_at"), // Track when agent last got assigned a task
  state: jsonb("state").default({}).notNull(), // Current state tracking (rate limits, etc.)
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
  maxConcurrencyLimit: integer("max_concurrency_limit").default(1), // User configurable concurrency limit per repository
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

  // Status and stage
  status: text("status").notNull().default("todo"), // todo, doing, done, loop
  stage: text("stage"), // clarify, plan, execute, loop

  // Priority (1-5 where 5=highest, 1=lowest)
  priority: integer("priority").notNull().default(3), // 1=Lowest, 2=Low, 3=Medium, 4=High, 5=Highest

  // Manual order within status column (for drag & drop)
  columnOrder: text("column_order").notNull().default("1000"), // Decimal string for ordering within status

  // Ready flag (replaces auto-start)
  ready: boolean("ready").default(false),

  // AI working flag
  isAiWorking: boolean("is_ai_working").default(false),

  // AI working timestamp (when isAiWorking was set to true)
  aiWorkingSince: timestamp("ai_working_since"),

  // Task authorship (human or ai)
  author: text("author").notNull().default("human"), // human, ai

  // Attachments
  attachments: jsonb("attachments").default([]), // Array of attachment objects

  // Agent session tracking
  lastAgentSessionId: text("last_agent_session_id"), // Store agent session ID directly

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
  projectMemberships: many(projectUsers)
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id]
  }),
  projectUsers: many(projectUsers),
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
  additionalRepositories: many(taskAdditionalRepositories),
  assignedAgents: many(taskAgents),
  dependencies: many(taskDependencies, {
    relationName: "taskDependencies"
  }),
  dependents: many(taskDependencies, {
    relationName: "dependentTasks"
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
