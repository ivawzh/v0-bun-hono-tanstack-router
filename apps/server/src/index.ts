import { config } from "dotenv";

// Load environment-specific .env file
if (process.env.NODE_ENV === 'production') {
  config({ path: '.env.production', override: true });
  config({ override: false }); // Load .env for any missing vars without overriding
} else {
  config();
}
import { RPCHandler } from "@orpc/server/fetch";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { registerMcpHttp, setOrchestrator } from "./mcp/mcp-server";
import { oauthCallbackRoutes } from "./routers/oauth-callback";
import { wsManager, handleWebSocketMessage } from "./websocket/websocket-server";
import { randomUUID } from "crypto";
import agentsRouter from "./routers/v2/agents";
import repositoriesRouter from "./routers/v2/repositories";
import tasksRouter from "./routers/v2/tasks";
import { startOrchestrator, shutdownOrchestrator } from "./agents/v2/orchestrator";

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

// Mount V2 API routes
app.route("/api/v2/agents", agentsRouter);
app.route("/api/v2", repositoriesRouter);
app.route("/api/v2", tasksRouter);

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

    // Import required modules
    const { db } = await import('./db/index');
    const { tasks, projects } = await import('./db/schema');
    const { eq, and } = await import('drizzle-orm');
    const { saveAttachment, validateTotalAttachmentSize } = await import('./utils/file-storage');
    const { broadcastFlush } = await import('./websocket/websocket-server');

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

    // Import required modules
    const { db } = await import('./db/index');
    const { tasks, projects } = await import('./db/schema');
    const { eq, and } = await import('drizzle-orm');
    const { getAttachmentFile } = await import('./utils/file-storage');

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
