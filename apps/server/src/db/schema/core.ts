import { pgTable, text, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// User table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Project table
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: uuid("owner_id").notNull().references(() => users.id),
  agentPaused: jsonb("agent_paused").default(false), // Project-level "Pause All Agents" control
  // Claude Code integration
  localRepoPath: text("local_repo_path"), // Path to local git repository
  claudeProjectId: text("claude_project_id"), // Claude Code project ID for linking
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Repository table
export const repositories = pgTable("repositories", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  provider: text("provider").notNull(), // github|gitlab|local|cloud-code
  url: text("url"),
  defaultBranch: text("default_branch").default("main"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Board table
export const boards = pgTable("boards", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: text("name").notNull(),
  purpose: text("purpose"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Agent table
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  role: text("role").notNull(), // PM|Designer|Architect|Engineer|QA
  character: text("character"), // free text persona
  config: jsonb("config").default({}),
  runtime: text("runtime").notNull(), // windows-runner|cloud
  modelProvider: text("model_provider").default("openai"), // openai|openrouter|anthropic|etc
  modelName: text("model_name").default("gpt-4"), // specific model to use
  modelConfig: jsonb("model_config").default({}), // temperature, max_tokens, etc
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Task table
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  boardId: uuid("board_id").notNull().references(() => boards.id),
  title: text("title").notNull(),
  bodyMd: text("body_md"),
  status: text("status").notNull().default("todo"), // todo|in_progress|qa|done|paused (removed blocked as status)
  stage: text("stage").notNull().default("kickoff"), // kickoff|spec|design|dev|qa|done
  priority: integer("priority").default(0),
  metadata: jsonb("metadata").default({}),
  assignedActorType: text("assigned_actor_type"), // agent|human
  assignedAgentId: uuid("assigned_agent_id").references(() => agents.id),
  // New fields for UI/UX design requirements
  isBlocked: jsonb("is_blocked").default(false), // Blocked is now a boolean flag, not a status
  qaRequired: jsonb("qa_required").default(false), // Controls whether task flows through QA column
  agentReady: jsonb("agent_ready").default(false), // Card-level control for agent auto-start
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Task Event table
export const taskEvents = pgTable("task_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  type: text("type").notNull(), // created|updated|comment|status_change|stage_change|artifact_added|question|pause|resume
  payload: jsonb("payload").default({}),
  at: timestamp("at").defaultNow().notNull()
});

// Task Artifact table
export const taskArtifacts = pgTable("task_artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  kind: text("kind").notNull(), // diff|file|link|log
  uri: text("uri").notNull(),
  meta: jsonb("meta").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Task Checklist Item table
export const taskChecklistItems = pgTable("task_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  stage: text("stage").notNull(), // kickoff|spec|design|dev|qa
  title: text("title").notNull(),
  state: text("state").notNull().default("open"), // open|done
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Message table
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  author: text("author").notNull(), // human|agent|system
  contentMd: text("content_md").notNull(),
  at: timestamp("at").defaultNow().notNull()
});

// Question table
export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  askedBy: text("asked_by").notNull(), // agent|human
  text: text("text").notNull(),
  status: text("status").notNull().default("open"), // open|answered
  answeredBy: uuid("answered_by").references(() => users.id),
  answer: text("answer"),
  resolvedAt: timestamp("resolved_at")
});

// Notification table
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  type: text("type").notNull(), // question|blocked|stage_change
  channel: text("channel").notNull(), // email|webhook|push|inapp
  payload: jsonb("payload").default({}),
  webhookUrl: text("webhook_url"), // For webhook notifications
  deliveredAt: timestamp("delivered_at"),
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at")
});

// Task Hook table (automation for task lifecycle)
export const taskHooks = pgTable("task_hooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  boardId: uuid("board_id").notNull().references(() => boards.id),
  trigger: text("trigger").notNull(), // stage_change
  fromStage: text("from_stage").default("*"),
  toStage: text("to_stage").notNull(),
  action: text("action").notNull(), // notify|start_agent|stop_agent|create_checklist
  payload: jsonb("payload").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Agent Session table
export const agentSessions = pgTable("agent_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id),
  taskId: uuid("task_id").notNull().references(() => tasks.id),
  state: text("state").notNull().default("booting"), // booting|running|paused|stopped|error|done
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at")
});

// Agent Action table
export const agentActions = pgTable("agent_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => agentSessions.id),
  type: text("type").notNull(), // plan|tool_call|code_edit|commit|test|comment
  payload: jsonb("payload").default({}),
  at: timestamp("at").defaultNow().notNull()
});

// Source Reference table
export const sourceRefs = pgTable("source_refs", {
  id: uuid("id").primaryKey().defaultRandom(),
  repositoryId: uuid("repository_id").notNull().references(() => repositories.id),
  refType: text("ref_type").notNull(), // branch|commit|tag
  refValue: text("ref_value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Requirements Document table (for database-based requirements storage)
export const requirements = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  content: text("content").notNull(), // Markdown content
  category: text("category"), // functional|technical|ux|business|etc
  version: integer("version").default(1),
  parentId: uuid("parent_id"), // For hierarchical docs - self-reference added in relations
  metadata: jsonb("metadata").default({}),
  // Vector search preparation fields
  embedding: jsonb("embedding"), // Will store vector embeddings when we add vector search
  searchText: text("search_text"), // Preprocessed text for full-text search
  tags: jsonb("tags").default([]), // Array of tags for filtering
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id)
});

// Requirements Change History table
export const requirementsHistory = pgTable("requirements_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  requirementId: uuid("requirement_id").notNull().references(() => requirements.id),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  changeDescription: text("change_description"),
  changedBy: uuid("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at").defaultNow().notNull()
});

// Chat Channel table (for project/board/task chat)
export const chatChannels = pgTable("chat_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  scopeType: text("scope_type").notNull(), // project|board|task
  scopeId: uuid("scope_id").notNull(), // FK to project/board/task depending on scopeType
  name: text("name"),
  topic: text("topic"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Chat Message table
export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").notNull().references(() => chatChannels.id),
  parentMessageId: uuid("parent_message_id"), // For threading
  author: text("author").notNull(), // human|agent|system
  contentMd: text("content_md").notNull(),
  mentions: jsonb("mentions").default([]), // [{type:"agent|user|role", id, label}]
  at: timestamp("at").defaultNow().notNull()
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  answeredQuestions: many(questions)
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id]
  }),
  repositories: many(repositories),
  boards: many(boards)
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  project: one(projects, {
    fields: [repositories.projectId],
    references: [projects.id]
  }),
  sourceRefs: many(sourceRefs)
}));

export const boardsRelations = relations(boards, ({ one, many }) => ({
  project: one(projects, {
    fields: [boards.projectId],
    references: [projects.id]
  }),
  tasks: many(tasks),
  taskHooks: many(taskHooks)
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  board: one(boards, {
    fields: [tasks.boardId],
    references: [boards.id]
  }),
  assignedAgent: one(agents, {
    fields: [tasks.assignedAgentId],
    references: [agents.id]
  }),
  events: many(taskEvents),
  artifacts: many(taskArtifacts),
  checklistItems: many(taskChecklistItems),
  messages: many(messages),
  questions: many(questions),
  notifications: many(notifications),
  agentSessions: many(agentSessions)
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  assignedTasks: many(tasks),
  sessions: many(agentSessions)
}));

export const agentSessionsRelations = relations(agentSessions, ({ one, many }) => ({
  agent: one(agents, {
    fields: [agentSessions.agentId],
    references: [agents.id]
  }),
  task: one(tasks, {
    fields: [agentSessions.taskId],
    references: [tasks.id]
  }),
  actions: many(agentActions)
}));

export const agentActionsRelations = relations(agentActions, ({ one }) => ({
  session: one(agentSessions, {
    fields: [agentActions.sessionId],
    references: [agentSessions.id]
  })
}));

export const taskEventsRelations = relations(taskEvents, ({ one }) => ({
  task: one(tasks, {
    fields: [taskEvents.taskId],
    references: [tasks.id]
  })
}));

export const taskArtifactsRelations = relations(taskArtifacts, ({ one }) => ({
  task: one(tasks, {
    fields: [taskArtifacts.taskId],
    references: [tasks.id]
  })
}));

export const taskChecklistItemsRelations = relations(taskChecklistItems, ({ one }) => ({
  task: one(tasks, {
    fields: [taskChecklistItems.taskId],
    references: [tasks.id]
  })
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  task: one(tasks, {
    fields: [messages.taskId],
    references: [tasks.id]
  })
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  task: one(tasks, {
    fields: [questions.taskId],
    references: [tasks.id]
  }),
  answerer: one(users, {
    fields: [questions.answeredBy],
    references: [users.id]
  })
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  task: one(tasks, {
    fields: [notifications.taskId],
    references: [tasks.id]
  })
}));

export const taskHooksRelations = relations(taskHooks, ({ one }) => ({
  board: one(boards, {
    fields: [taskHooks.boardId],
    references: [boards.id]
  })
}));

export const sourceRefsRelations = relations(sourceRefs, ({ one }) => ({
  repository: one(repositories, {
    fields: [sourceRefs.repositoryId],
    references: [repositories.id]
  })
}));

export const chatChannelsRelations = relations(chatChannels, ({ many }) => ({
  messages: many(chatMessages)
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  channel: one(chatChannels, {
    fields: [chatMessages.channelId],
    references: [chatChannels.id]
  }),
  parentMessage: one(chatMessages, {
    fields: [chatMessages.parentMessageId],
    references: [chatMessages.id]
  })
}));