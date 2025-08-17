import "dotenv/config";
import { RPCHandler } from "@orpc/server/fetch";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { registerMcpHttp, setOrchestrator } from "./mcp/mcp-server";
import { oauthCallbackRoutes } from "./routers/oauth-callback";
import { AgentOrchestrator } from "./agents/agent-orchestrator";
import { wsManager, handleWebSocketMessage } from "./websocket/websocket-server";
import { randomUUID } from "crypto";

const app = new Hono();

app.use(logger());
app.use("/*", cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:8302",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// Mount OAuth callback routes
app.route("/api/oauth", oauthCallbackRoutes);

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

// File download endpoint for attachments
app.get("/api/tasks/:taskId/attachments/:attachmentId/download", async (c) => {
  try {
    const taskId = c.req.param('taskId')
    const attachmentId = c.req.param('attachmentId')
    
    // Get the attachment using the router directly
    const context = await createContext({ context: c });
    const result = await appRouter.tasks.getAttachment({
      taskId,
      attachmentId
    }, { context });
    
    if (!result.buffer || !result.metadata) {
      return c.notFound();
    }
    
    // Convert buffer to proper format
    const buffer = Buffer.from(result.buffer);
    
    // Set proper headers for file download
    c.header('Content-Type', result.metadata.type || 'application/octet-stream');
    c.header('Content-Disposition', `attachment; filename="${result.metadata.originalName}"`);
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

// Initialize Agent Orchestrator
let agentOrchestrator: AgentOrchestrator | null = null;

// Global tracking to prevent multiple instances during hot reload
declare global {
  var __agentOrchestrator: AgentOrchestrator | undefined;
}

async function initializeAgentOrchestrator() {
  try {
    // Clean up any existing orchestrator instance (hot reload cleanup)
    if (global.__agentOrchestrator) {
      console.log("🔄 Hot reload detected, cleaning up previous Agent Orchestrator...");
      await global.__agentOrchestrator.shutdown();
      global.__agentOrchestrator = undefined;
    }

    const claudeCodeWebsocketUrl = process.env.CLAUDE_CODE_WS_URL || "ws://localhost:8501";
    const agentToken = process.env.AGENT_AUTH_TOKEN || "default-agent-token";

    console.log("🤖 Initializing Agent Orchestrator...");

    agentOrchestrator = new AgentOrchestrator({
      claudeCodeUrl: claudeCodeWebsocketUrl,
      agentToken,
      taskPushEnabled: true
    });

    // Store globally for hot reload cleanup
    global.__agentOrchestrator = agentOrchestrator;

    await agentOrchestrator.initialize();

    // Integrate with MCP server
    setOrchestrator(agentOrchestrator);

    console.log("🤖 Agent Orchestrator initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize Agent Orchestrator:", error instanceof Error ? error.message : String(error));
    console.log("ℹ️  Agent Orchestrator will continue trying to connect in the background");
    console.log("ℹ️  Make sure Claude Code UI is running on", process.env.CLAUDE_CODE_WS_URL || "ws://localhost:8501");

    // Don't throw error - let the app continue running
    // The agent orchestrator will retry connections automatically
  }
}

// Initialize on startup
initializeAgentOrchestrator();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  if (global.__agentOrchestrator) {
    global.__agentOrchestrator.shutdown();
  }
  wsManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  if (global.__agentOrchestrator) {
    global.__agentOrchestrator.shutdown();
  }
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
