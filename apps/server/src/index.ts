import { RPCHandler } from "@orpc/server/fetch";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { registerMcpHttp } from "./mcp/mcp-server";
import { oauthCallbackRoutes } from "./routers/oauth-callback";
import { wsManager, handleWebSocketMessage, broadcastFlush } from "./websocket/websocket-server";
import { randomUUID } from "crypto";
import { startOrchestrator, shutdownOrchestrator } from "./agents/v2/orchestrator";
import { requireClaudeCodeUIAuth } from './lib/guards';
import { db } from "./db";
import { agents, projects, taskAgents, tasks } from "./db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getAttachmentFile, saveAttachment, validateTotalAttachmentSize } from "./utils/file-storage";

const app = new Hono();

app.use(logger());
app.use("/*", cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:8302", "https://solounicorn.lol", "https://www.solounicorn.lol", "https://api.solounicorn.lol"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-forwarded-for", "x-forwarded-proto"],
  credentials: true,
}));

// Mount OAuth callback routes
app.route("/api/oauth", oauthCallbackRoutes);

// V2 API routes are now handled through oRPC endpoints

const handler = new RPCHandler(appRouter);
app.use("/rpc/*", async (c, next) => {
  console.log(`🚀 -> "/rpc/*":`, "/rpc/*");
  const context = await createContext({ context: c });
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: "/rpc",
    context: context,
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }
  await next();
});


app.get("/", (c) => {
  return c.text("OK");
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// File upload endpoint for attachments (multipart/form-data)
app.post("/api/tasks/upload-attachment", async (c) => {
  try {
    console.log('📎 Attachment upload request received');
    const formData = await c.req.formData();
    const taskId = formData.get('taskId') as string;
    const file = formData.get('file') as File;

    console.log('📎 Upload details:', {
      taskId,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    });

    if (!taskId || !file) {
      console.error('❌ Missing taskId or file:', { taskId: !!taskId, file: !!file });
      return c.json({ error: 'Missing taskId or file' }, 400);
    }

    // Convert File to buffer
    const buffer = await file.arrayBuffer();

    // Create context and verify authentication
    const context = await createContext({ context: c });
    if (!context.appUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Verify task ownership
    const task = await db
      .select({
        task: tasks,
        project: projects
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(tasks.id, taskId),
          eq(projects.ownerId, context.appUser.id)
        )
      )
      .limit(1);

    if (task.length === 0) {
      return c.json({ error: 'Task not found or unauthorized' }, 404);
    }

    const existingAttachments = (task[0].task.attachments as any[]) || [];

    // Validate total size
    await validateTotalAttachmentSize(taskId, file.size, existingAttachments);

    // Save attachment file
    console.log('💾 Saving attachment to filesystem...');
    const attachment = await saveAttachment(taskId, {
      buffer: new Uint8Array(buffer),
      originalName: file.name,
      type: file.type,
      size: file.size
    });
    console.log('💾 Attachment saved:', attachment);

    // Update task with new attachment
    const updatedAttachments = [...existingAttachments, attachment];

    console.log('🗄️ Updating database...');
    await db
      .update(tasks)
      .set({
        attachments: updatedAttachments,
        updatedAt: new Date()
      })
      .where(eq(tasks.id, taskId));

    // Broadcast flush to invalidate all queries for this project
    broadcastFlush(task[0].project.id);

    console.log('✅ Upload completed successfully');
    return c.json(attachment);
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Upload failed' }, 500);
  }
});

// File download endpoint for attachments
app.get("/api/tasks/:taskId/attachments/:attachmentId/download", async (c) => {
  try {
    const taskId = c.req.param('taskId')
    const attachmentId = c.req.param('attachmentId')

    // Create context and verify authentication
    const context = await createContext({ context: c });
    if (!context.appUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Verify task ownership and get attachments
    const task = await db
      .select({
        task: tasks,
        project: projects
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(tasks.id, taskId),
          eq(projects.ownerId, context.appUser.id)
        )
      )
      .limit(1);

    if (task.length === 0) {
      return c.json({ error: 'Task not found or unauthorized' }, 404);
    }

    const attachments = (task[0].task.attachments as any[]) || [];
    const attachment = attachments.find(a => a.id === attachmentId);

    if (!attachment) {
      return c.json({ error: 'Attachment not found' }, 404);
    }

    const buffer = await getAttachmentFile(taskId, attachmentId, attachments);

    // Set proper headers for file download
    c.header('Content-Type', attachment.type || 'application/octet-stream');
    c.header('Content-Disposition', `attachment; filename="${attachment.originalName}"`);
    c.header('Content-Length', buffer.length.toString());

    return c.body(buffer);
  } catch (error) {
    console.error('Download error:', error);
    return c.json({ error: 'File not found' }, 404);
  }
});

// Claude Code UI callback endpoints (server-to-server)
// Session started callback
app.post("/api/claude-code-ui/session-started", requireClaudeCodeUIAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, agentType, soloUnicornParams, resumed } = body;

    console.log('🟢 Claude Code UI session started callback:', {
      sessionId,
      agentType,
      resumed,
      taskId: soloUnicornParams?.taskId,
      projectId: soloUnicornParams?.projectId
    });

    if (!soloUnicornParams?.taskId || !soloUnicornParams?.projectId) {
      return c.json({ error: 'Missing taskId or projectId in soloUnicornParams' }, 400);
    }

    // Update task to mark AI as working
    await db
      .update(tasks)
      .set({
        isAiWorking: true,
        aiWorkingSince: new Date(),
        lastAgentSessionId: sessionId,
        updatedAt: new Date()
      })
      .where(eq(tasks.id, soloUnicornParams.taskId));

    console.log('✅ Updated task AI working status:', soloUnicornParams.taskId);

    // Broadcast flush to refresh real-time updates
    broadcastFlush(soloUnicornParams.projectId);

    return c.json({ success: true, message: 'Session started callback processed' });
  } catch (error) {
    console.error('❌ Session started callback error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Session ended callback
app.post("/api/claude-code-ui/session-ended", requireClaudeCodeUIAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, agentType, soloUnicornParams, exitCode, success } = body;

    console.log('🔴 Claude Code UI session ended callback:', {
      sessionId,
      agentType,
      exitCode,
      success,
      taskId: soloUnicornParams?.taskId,
      projectId: soloUnicornParams?.projectId
    });

    if (!soloUnicornParams?.taskId || !soloUnicornParams?.projectId) {
      return c.json({ error: 'Missing taskId or projectId in soloUnicornParams' }, 400);
    }

    // Update task to mark AI as no longer working
    await db
      .update(tasks)
      .set({
        isAiWorking: false,
        aiWorkingSince: null,
        lastAgentSessionId: sessionId,
        updatedAt: new Date()
      })
      .where(eq(tasks.id, soloUnicornParams.taskId));

    console.log('✅ Updated task AI stopped working status:', soloUnicornParams.taskId, { exitCode, success });

    // Broadcast flush to refresh real-time updates
    broadcastFlush(soloUnicornParams.projectId);

    return c.json({ success: true, message: 'Session ended callback processed' });
  } catch (error) {
    console.error('❌ Session ended callback error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Rate limited callback
app.post("/api/claude-code-ui/rate-limited", requireClaudeCodeUIAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, agentType, soloUnicornParams, rateLimitResetAt } = body;

    console.log('🚫 Claude Code UI rate limited callback:', {
      sessionId,
      agentType,
      rateLimitResetAt,
      taskId: soloUnicornParams?.taskId,
      projectId: soloUnicornParams?.projectId
    });

    if (!soloUnicornParams?.taskId || !soloUnicornParams?.projectId) {
      return c.json({ error: 'Missing taskId or projectId in soloUnicornParams' }, 400);
    }

    // Update task to mark AI as no longer working due to rate limit
    await db
      .update(tasks)
      .set({
        isAiWorking: false,
        aiWorkingSince: null,
        lastAgentSessionId: sessionId,
        updatedAt: new Date()
      })
      .where(eq(tasks.id, soloUnicornParams.taskId));

    // Find assigned agents for this task and update their rate limit state
    const assignedAgents = await db
      .select({ agentId: taskAgents.agentId })
      .from(taskAgents)
      .where(eq(taskAgents.taskId, soloUnicornParams.taskId));

    // Update each assigned agent's state with rate limit info
    for (const assignment of assignedAgents) {
      await db
        .update(agents)
        .set({
          state: sql`${JSON.stringify(rateLimitResetAt)}::jsonb')`,
          updatedAt: new Date()
        })
        .where(eq(agents.id, assignment.agentId));
    }

    console.log('✅ Updated task and agent rate limit status:', {
      taskId: soloUnicornParams.taskId,
      agentsUpdated: assignedAgents.length,
      rateLimitResetAt
    });

    // Broadcast flush to refresh real-time updates
    broadcastFlush(soloUnicornParams.projectId);

    return c.json({ success: true, message: 'Rate limited callback processed' });
  } catch (error) {
    console.error('❌ Rate limited callback error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Mount MCP Streamable HTTP endpoint at /mcp (stateless integration)
async function initializeMcp() {
  try {
    await registerMcpHttp(app, "/mcp");
    console.log("🔌 Stateless MCP server integrated on port", process.env.PORT || 8500);
  } catch (error) {
    console.error("❌ Failed to initialize MCP server:", error);
  }
}
initializeMcp();

const port = process.env.PORT || 8500;

console.log(`🚀 Solo Unicorn server starting on port ${port}`);
console.log(`🔌 WebSocket server enabled at ws://localhost:${port}`);

// Initialize V2 Orchestrator on startup
startOrchestrator();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  shutdownOrchestrator();
  wsManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  shutdownOrchestrator();
  wsManager.shutdown();
  process.exit(0);
});

type WebSocketData = {
  clientId: string;
};

Bun.serve<WebSocketData, {}>({
  port,
  fetch(req, server) {
    // Check if this is a WebSocket upgrade request
    const upgrade = req.headers.get("upgrade");
    if (upgrade === "websocket") {
      const clientId = randomUUID();
      const success = server.upgrade(req, {
        data: { clientId }
      });
      if (success) {
        return undefined; // Successfully upgraded
      }
    }

    // Handle regular HTTP requests through Hono
    return app.fetch(req, server);
  },
  websocket: {
    message(ws, message) {
      const clientId = ws.data?.clientId;
      if (clientId) {
        handleWebSocketMessage(ws, clientId, message.toString());
      }
    },
    open(ws) {
      const clientId = ws.data?.clientId;
      if (clientId) {
        wsManager.addClient(ws, clientId);
        console.log(`🔌 WebSocket connection opened for client: ${clientId}`);
      }
    },
    close(ws) {
      if (ws.data?.clientId) {
        wsManager.removeClient(ws.data.clientId);
      }
    },
    // @ts-ignore
    error(ws, error) {
      console.error('WebSocket error:', error);
      if (ws.data?.clientId) {
        wsManager.removeClient(ws.data.clientId);
      }
    }
  }
});
