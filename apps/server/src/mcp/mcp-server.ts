import { Hono } from "hono";
import { cors } from "hono/cors";
import * as v from "valibot";
import { db } from "../db";
import {
  projects, tasks, repoAgents, actors, sessions
} from "../db/schema/simplified";
import { eq, and, desc } from "drizzle-orm";

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

  const [projectRepoAgents, projectActors, projectTasks] = await Promise.all([
    db.select().from(repoAgents).where(eq(repoAgents.projectId, projectId)),
    db.select().from(actors).where(eq(actors.projectId, projectId)),
    db.select().from(tasks).where(eq(tasks.projectId, projectId)),
  ]);

  return c.json({
    project: project[0],
    repoAgents: projectRepoAgents,
    actors: projectActors,
    tasks: projectTasks,
  });
});

// Get task context with all details
contextRouter.get("/tasks/:taskId", async (c) => {
  const taskId = c.req.param("taskId");

  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: {
      project: true,
      repoAgent: true,
      actor: true
    }
  });

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({
    task,
    project: task.project,
    repoAgent: task.repoAgent,
    actor: task.actor
  });
});

// Cards namespace - Write operations
const cardsRouter = new Hono();

// Update task fields (for agent workflow)
cardsRouter.put("/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  const body = await c.req.json();

  const updateData: any = { updatedAt: new Date() };
  
  // Allow updating specific fields during agent workflow
  if (body.refinedTitle !== undefined) updateData.refinedTitle = body.refinedTitle;
  if (body.refinedDescription !== undefined) updateData.refinedDescription = body.refinedDescription;
  if (body.plan !== undefined) updateData.plan = body.plan;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.stage !== undefined) updateData.stage = body.stage;

  const updated = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, taskId))
    .returning();

  if (updated.length === 0) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ task: updated[0] });
});

// Memory namespace - Project memory management
const memoryRouter = new Hono();

// Get project memory
memoryRouter.get("/:projectId", async (c) => {
  const projectId = c.req.param("projectId");

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (project.length === 0) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({
    projectId,
    memory: project[0].memory || {}
  });
});

// Update project memory
memoryRouter.put("/:projectId", async (c) => {
  const projectId = c.req.param("projectId");
  const body = await c.req.json();

  const updated = await db
    .update(projects)
    .set({
      memory: body.memory,
      updatedAt: new Date()
    })
    .where(eq(projects.id, projectId))
    .returning();

  if (updated.length === 0) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({
    projectId,
    memory: updated[0].memory
  });
});

// Mount sub-routers
mcpServer.route("/context", contextRouter);
mcpServer.route("/cards", cardsRouter);
mcpServer.route("/memory", memoryRouter);

// Health check
mcpServer.get("/health", (c) => {
  return c.json({ status: "ok", service: "Solo Unicorn MCP Server" });
});

export { mcpServer };