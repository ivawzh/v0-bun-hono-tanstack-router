import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { db } from "../db";
import { agents, agentSessions, agentActions, tasks, boards, projects } from "../db/schema/core";
import { eq, and, desc, isNull } from "drizzle-orm";

const agentGateway = new Hono();

// CORS for agent connections
agentGateway.use("/*", cors({
  origin: "*", // Allow all origins for agents
  credentials: true,
}));

// Simple bearer token authentication for agents
agentGateway.use("/*", async (c, next) => {
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

// Agent registration/heartbeat
agentGateway.post("/register", async (c) => {
  const body = await c.req.json();
  const { agentId, runtime, capabilities } = z.object({
    agentId: z.string().uuid(),
    runtime: z.enum(["windows-runner", "cloud"]),
    capabilities: z.array(z.string()).optional(),
  }).parse(body);

  // Update agent's last seen timestamp
  await db
    .update(agents)
    .set({ 
      updatedAt: new Date(),
      config: {
        ...((await db.select().from(agents).where(eq(agents.id, agentId)).limit(1))[0]?.config || {}),
        lastSeen: new Date().toISOString(),
        capabilities,
      }
    })
    .where(eq(agents.id, agentId));

  return c.json({ success: true, message: "Agent registered" });
});

// Claim a task for the agent
agentGateway.post("/tasks/claim", async (c) => {
  const body = await c.req.json();
  const { agentId } = z.object({
    agentId: z.string().uuid(),
  }).parse(body);

  // Find an unassigned task or a task assigned to this agent
  const availableTask = await db
    .select({
      task: tasks,
      board: boards,
      project: projects,
    })
    .from(tasks)
    .innerJoin(boards, eq(tasks.boardId, boards.id))
    .innerJoin(projects, eq(boards.projectId, projects.id))
    .where(
      and(
        eq(tasks.status, "todo"),
        eq(tasks.assignedActorType, "agent")
      )
    )
    .limit(1);

  if (availableTask.length === 0) {
    return c.json({ task: null, message: "No tasks available" });
  }

  const task = availableTask[0].task;

  // Create a new session for this task
  const session = await db
    .insert(agentSessions)
    .values({
      agentId,
      taskId: task.id,
      state: "running",
    })
    .returning();

  // Update task assignment
  await db
    .update(tasks)
    .set({
      status: "in_progress",
      assignedAgentId: agentId,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, task.id));

  return c.json({
    task,
    session: session[0],
    project: availableTask[0].project,
    board: availableTask[0].board,
  });
});

// Report task progress
agentGateway.post("/sessions/:sessionId/progress", async (c) => {
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  
  const { type, payload, message } = z.object({
    type: z.enum(["plan", "tool_call", "code_edit", "commit", "test", "comment"]),
    payload: z.record(z.any()).optional(),
    message: z.string().optional(),
  }).parse(body);

  // Add action to the session
  await db
    .insert(agentActions)
    .values({
      sessionId,
      type,
      payload: payload || {},
    });

  // If there's a message, add it to the task
  if (message) {
    const session = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId))
      .limit(1);

    if (session.length > 0) {
      const { messages } = await import("../db/schema/core");
      await db
        .insert(messages)
        .values({
          taskId: session[0].taskId,
          author: "agent",
          contentMd: message,
        });
    }
  }

  return c.json({ success: true });
});

// Complete or fail a task
agentGateway.post("/sessions/:sessionId/complete", async (c) => {
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  
  const { status, result } = z.object({
    status: z.enum(["done", "error", "blocked"]),
    result: z.record(z.any()).optional(),
  }).parse(body);

  // Update session
  await db
    .update(agentSessions)
    .set({
      state: status === "done" ? "done" : status === "error" ? "error" : "stopped",
      endedAt: new Date(),
    })
    .where(eq(agentSessions.id, sessionId));

  // Get session details
  const session = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.id, sessionId))
    .limit(1);

  if (session.length > 0) {
    // Update task status
    await db
      .update(tasks)
      .set({
        status: status === "done" ? "done" : status === "blocked" ? "blocked" : "paused",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, session[0].taskId));

    // Add final action
    await db
      .insert(agentActions)
      .values({
        sessionId,
        type: "comment",
        payload: { status, result },
      });
  }

  return c.json({ success: true });
});

// Ask a question to the human
agentGateway.post("/sessions/:sessionId/question", async (c) => {
  const sessionId = c.req.param("sessionId");
  const body = await c.req.json();
  
  const { question } = z.object({
    question: z.string(),
  }).parse(body);

  // Get session details
  const session = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.id, sessionId))
    .limit(1);

  if (session.length === 0) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Add question to the task
  const { questions } = await import("../db/schema/core");
  const newQuestion = await db
    .insert(questions)
    .values({
      taskId: session[0].taskId,
      askedBy: "agent",
      text: question,
      status: "open",
    })
    .returning();

  // Mark task as blocked
  await db
    .update(tasks)
    .set({
      status: "blocked",
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, session[0].taskId));

  // Pause the session
  await db
    .update(agentSessions)
    .set({
      state: "paused",
    })
    .where(eq(agentSessions.id, sessionId));

  return c.json({ 
    success: true, 
    questionId: newQuestion[0].id,
    message: "Question posted. Task marked as blocked and session paused."
  });
});

// Check for question answers
agentGateway.get("/sessions/:sessionId/questions", async (c) => {
  const sessionId = c.req.param("sessionId");

  // Get session details
  const session = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.id, sessionId))
    .limit(1);

  if (session.length === 0) {
    return c.json({ error: "Session not found" }, 404);
  }

  // Get unanswered questions for this task
  const { questions } = await import("../db/schema/core");
  const taskQuestions = await db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.taskId, session[0].taskId),
        eq(questions.askedBy, "agent")
      )
    )
    .orderBy(desc(questions.id));

  return c.json({ questions: taskQuestions });
});

// Resume session after question is answered
agentGateway.post("/sessions/:sessionId/resume", async (c) => {
  const sessionId = c.req.param("sessionId");

  // Update session state
  await db
    .update(agentSessions)
    .set({
      state: "running",
    })
    .where(
      and(
        eq(agentSessions.id, sessionId),
        eq(agentSessions.state, "paused")
      )
    );

  // Get session details
  const session = await db
    .select()
    .from(agentSessions)
    .where(eq(agentSessions.id, sessionId))
    .limit(1);

  if (session.length > 0) {
    // Update task status
    await db
      .update(tasks)
      .set({
        status: "in_progress",
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, session[0].taskId));
  }

  return c.json({ success: true });
});

// Get active sessions for an agent
agentGateway.get("/agents/:agentId/sessions", async (c) => {
  const agentId = c.req.param("agentId");

  const sessions = await db
    .select({
      session: agentSessions,
      task: tasks,
    })
    .from(agentSessions)
    .innerJoin(tasks, eq(agentSessions.taskId, tasks.id))
    .where(
      and(
        eq(agentSessions.agentId, agentId),
        isNull(agentSessions.endedAt)
      )
    )
    .orderBy(desc(agentSessions.startedAt));

  return c.json({ sessions });
});

export { agentGateway };