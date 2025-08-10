import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { db } from "../db";
import { 
  projects, boards, tasks, repositories, 
  taskEvents, taskArtifacts, taskChecklistItems, 
  messages, questions, agents, agentSessions 
} from "../db/schema/core";
import { eq, and, desc, or, inArray } from "drizzle-orm";

const mcpServer = new Hono();

// CORS for MCP clients
mcpServer.use("/*", cors({
  origin: "*",
  credentials: true,
}));

// Simple bearer token authentication for MCP access
mcpServer.use("/*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const expectedToken = process.env.AGENT_AUTH_TOKEN || "default-agent-token";
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized - Missing bearer token" }, 401);
  }
  
  const token = authHeader.substring(7);
  if (token !== expectedToken) {
    return c.json({ error: "Unauthorized - Invalid token" }, 401);
  }
  
  await next();
});

// Context namespace - Read operations
const contextRouter = new Hono();

// Get project context
contextRouter.get("/projects/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (project.length === 0) {
    return c.json({ error: "Project not found" }, 404);
  }

  const [projectBoards, projectRepos] = await Promise.all([
    db.select().from(boards).where(eq(boards.projectId, projectId)),
    db.select().from(repositories).where(eq(repositories.projectId, projectId)),
  ]);

  return c.json({
    project: project[0],
    boards: projectBoards,
    repositories: projectRepos,
  });
});

// Get board context with tasks
contextRouter.get("/boards/:boardId", async (c) => {
  const boardId = c.req.param("boardId");
  
  const board = await db
    .select()
    .from(boards)
    .where(eq(boards.id, boardId))
    .limit(1);

  if (board.length === 0) {
    return c.json({ error: "Board not found" }, 404);
  }

  const boardTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.boardId, boardId))
    .orderBy(desc(tasks.priority), desc(tasks.createdAt));

  return c.json({
    board: board[0],
    tasks: boardTasks,
  });
});

// Get task context with all details
contextRouter.get("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  
  const task = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (task.length === 0) {
    return c.json({ error: "Task not found" }, 404);
  }

  const [events, artifacts, checklist, taskMessages, taskQuestions] = await Promise.all([
    db.select().from(taskEvents).where(eq(taskEvents.taskId, taskId)).orderBy(desc(taskEvents.at)),
    db.select().from(taskArtifacts).where(eq(taskArtifacts.taskId, taskId)),
    db.select().from(taskChecklistItems).where(eq(taskChecklistItems.taskId, taskId)),
    db.select().from(messages).where(eq(messages.taskId, taskId)).orderBy(desc(messages.at)),
    db.select().from(questions).where(eq(questions.taskId, taskId)),
  ]);

  return c.json({
    task: task[0],
    events,
    artifacts,
    checklistItems: checklist,
    messages: taskMessages,
    questions: taskQuestions,
  });
});

// Cards namespace - Manipulation operations
const cardsRouter = new Hono();

// List tasks with filters
cardsRouter.get("/list", async (c) => {
  const query = c.req.query();
  const filters = z.object({
    boardId: z.string().uuid().optional(),
    status: z.string().optional(),
    stage: z.string().optional(),
    assignedAgentId: z.string().uuid().optional(),
  }).parse(query);

  let conditions = [];
  if (filters.boardId) conditions.push(eq(tasks.boardId, filters.boardId));
  if (filters.status) conditions.push(eq(tasks.status, filters.status));
  if (filters.stage) conditions.push(eq(tasks.stage, filters.stage));
  if (filters.assignedAgentId) conditions.push(eq(tasks.assignedAgentId, filters.assignedAgentId));

  const taskList = await db
    .select()
    .from(tasks)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(tasks.priority), desc(tasks.createdAt));

  return c.json({ tasks: taskList });
});

// Get a specific task
cardsRouter.get("/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  
  const task = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (task.length === 0) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ task: task[0] });
});

// Create a new task
cardsRouter.post("/create", async (c) => {
  const body = await c.req.json();
  const input = z.object({
    boardId: z.string().uuid(),
    title: z.string(),
    bodyMd: z.string().optional(),
    status: z.string().default("todo"),
    stage: z.string().default("kickoff"),
    priority: z.number().default(0),
  }).parse(body);

  const newTask = await db
    .insert(tasks)
    .values(input)
    .returning();

  // Create initial event
  await db.insert(taskEvents).values({
    taskId: newTask[0].id,
    type: "created",
    payload: { source: "mcp" },
  });

  return c.json({ task: newTask[0] });
});

// Update task status
cardsRouter.put("/:taskId/status", async (c) => {
  const taskId = c.req.param("taskId");
  const body = await c.req.json();
  const { status } = z.object({
    status: z.enum(["todo", "in_progress", "blocked", "done", "paused"]),
  }).parse(body);

  const oldTask = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (oldTask.length === 0) {
    return c.json({ error: "Task not found" }, 404);
  }

  await db
    .update(tasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  // Log status change event
  await db.insert(taskEvents).values({
    taskId,
    type: "status_change",
    payload: { from: oldTask[0].status, to: status, source: "mcp" },
  });

  return c.json({ success: true });
});

// Update task stage
cardsRouter.put("/:taskId/stage", async (c) => {
  const taskId = c.req.param("taskId");
  const body = await c.req.json();
  const { stage } = z.object({
    stage: z.enum(["kickoff", "spec", "design", "dev", "qa", "done"]),
  }).parse(body);

  const oldTask = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (oldTask.length === 0) {
    return c.json({ error: "Task not found" }, 404);
  }

  await db
    .update(tasks)
    .set({ stage, updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  // Log stage change event
  await db.insert(taskEvents).values({
    taskId,
    type: "stage_change",
    payload: { from: oldTask[0].stage, to: stage, source: "mcp" },
  });

  return c.json({ success: true });
});

// Pause a task
cardsRouter.post("/:taskId/pause", async (c) => {
  const taskId = c.req.param("taskId");

  await db
    .update(tasks)
    .set({ status: "paused", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  await db.insert(taskEvents).values({
    taskId,
    type: "pause",
    payload: { source: "mcp" },
  });

  return c.json({ success: true });
});

// Resume a task
cardsRouter.post("/:taskId/resume", async (c) => {
  const taskId = c.req.param("taskId");

  await db
    .update(tasks)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  await db.insert(taskEvents).values({
    taskId,
    type: "resume",
    payload: { source: "mcp" },
  });

  return c.json({ success: true });
});

// Post a message to a task
cardsRouter.post("/:taskId/message", async (c) => {
  const taskId = c.req.param("taskId");
  const body = await c.req.json();
  const { content, author = "agent" } = z.object({
    content: z.string(),
    author: z.enum(["human", "agent", "system"]).default("agent"),
  }).parse(body);

  const newMessage = await db
    .insert(messages)
    .values({
      taskId,
      author,
      contentMd: content,
    })
    .returning();

  await db.insert(taskEvents).values({
    taskId,
    type: "comment",
    payload: { messageId: newMessage[0].id, source: "mcp" },
  });

  return c.json({ message: newMessage[0] });
});

// Add an artifact to a task
cardsRouter.post("/:taskId/artifact", async (c) => {
  const taskId = c.req.param("taskId");
  const body = await c.req.json();
  const { kind, uri, meta } = z.object({
    kind: z.enum(["diff", "file", "link", "log"]),
    uri: z.string(),
    meta: z.record(z.any()).optional(),
  }).parse(body);

  const newArtifact = await db
    .insert(taskArtifacts)
    .values({
      taskId,
      kind,
      uri,
      meta: meta || {},
    })
    .returning();

  await db.insert(taskEvents).values({
    taskId,
    type: "artifact_added",
    payload: { artifactId: newArtifact[0].id, kind, source: "mcp" },
  });

  return c.json({ artifact: newArtifact[0] });
});

// Raise a question
cardsRouter.post("/:taskId/question", async (c) => {
  const taskId = c.req.param("taskId");
  const body = await c.req.json();
  const { text } = z.object({
    text: z.string(),
  }).parse(body);

  const newQuestion = await db
    .insert(questions)
    .values({
      taskId,
      askedBy: "agent",
      text,
      status: "open",
    })
    .returning();

  // Mark task as blocked
  await db
    .update(tasks)
    .set({ status: "blocked", updatedAt: new Date() })
    .where(eq(tasks.id, taskId));

  await db.insert(taskEvents).values({
    taskId,
    type: "question",
    payload: { questionId: newQuestion[0].id, source: "mcp" },
  });

  return c.json({ question: newQuestion[0] });
});

// Events namespace - Subscribe/poll for events
const eventsRouter = new Hono();

// Poll for task events
eventsRouter.get("/poll", async (c) => {
  const query = c.req.query();
  const { taskId, since } = z.object({
    taskId: z.string().uuid().optional(),
    since: z.string().datetime().optional(),
  }).parse(query);

  let conditions = [];
  if (taskId) conditions.push(eq(taskEvents.taskId, taskId));
  if (since) conditions.push(taskEvents.at > new Date(since));

  const events = await db
    .select()
    .from(taskEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(taskEvents.at))
    .limit(100);

  return c.json({ events });
});

// Mount sub-routers
mcpServer.route("/context", contextRouter);
mcpServer.route("/cards", cardsRouter);
mcpServer.route("/events", eventsRouter);

export { mcpServer };