import "dotenv/config";
import { RPCHandler } from "@orpc/server/fetch";
import { createContext } from "./lib/context";
import { appRouter } from "./routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { stream } from "hono/streaming";
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

app.post("/ai", async (c) => {
  const body = await c.req.json();
  const messages = body.messages || [];
  const result = streamText({
    model: google("gemini-1.5-flash"),
    messages,
  });

  c.header("X-Vercel-AI-Data-Stream", "v1");
  c.header("Content-Type", "text/plain; charset=utf-8");
  return stream(c, (stream) => stream.pipe(result.toDataStream()));
});

app.get("/", (c) => {
  return c.text("OK");
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

async function initializeAgentOrchestrator() {
  try {
    const claudeCodeWebsocketUrl = process.env.CLAUDE_CODE_WS_URL || "ws://localhost:8501";
    const agentToken = process.env.AGENT_AUTH_TOKEN || "default-agent-token";

    console.log("🤖 Initializing Agent Orchestrator...");

    agentOrchestrator = new AgentOrchestrator({
      claudeCodeUrl: claudeCodeWebsocketUrl,
      agentToken,
      taskPushEnabled: true,
      heartbeatInterval: 30000, // 30 seconds
      availabilityTimeout: 10000 // 10 seconds
    });

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
  if (agentOrchestrator) {
    agentOrchestrator.shutdown();
  }
  wsManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  if (agentOrchestrator) {
    agentOrchestrator.shutdown();
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
