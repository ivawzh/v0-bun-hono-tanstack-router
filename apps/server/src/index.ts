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
import { ImprovedAgentOrchestrator } from "./agents/improved-agent-orchestrator";
import { wsManager, handleWebSocketMessage } from "./lib/websocket";
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

// Mount MCP Streamable HTTP endpoint at /mcp
registerMcpHttp(app, "/mcp");

const port = process.env.PORT || 8500;

// Initialize Improved Agent Orchestrator
let agentOrchestrator: ImprovedAgentOrchestrator | null = null;

async function initializeAgentOrchestrator() {
  try {
    const claudeCodeWebsocketUrl = process.env.CLAUDE_CODE_WS_URL || "ws://localhost:8501";
    const agentToken = process.env.AGENT_AUTH_TOKEN || "default-agent-token";

    console.log("🤖 Initializing Improved Agent Orchestrator...");

    agentOrchestrator = new ImprovedAgentOrchestrator({
      claudeCodeUrl: claudeCodeWebsocketUrl,
      agentToken,
      taskPushEnabled: true,
      heartbeatInterval: 30000, // 30 seconds
      availabilityTimeout: 10000 // 10 seconds
    });

    await agentOrchestrator.initialize();
    
    // Integrate with MCP server
    setOrchestrator(agentOrchestrator);
    
    console.log("🤖 Improved Agent Orchestrator initialized successfully");
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

export default {
  port,
  fetch: app.fetch,
  websocket: {
    message(ws, message) {
      const clientId = ws.data?.clientId || randomUUID();
      if (!ws.data?.clientId) {
        ws.data = { clientId };
        wsManager.addClient(ws, clientId);
      }
      handleWebSocketMessage(ws, clientId, message.toString());
    },
    open(ws) {
      const clientId = randomUUID();
      ws.data = { clientId };
      wsManager.addClient(ws, clientId);
    },
    close(ws) {
      if (ws.data?.clientId) {
        wsManager.removeClient(ws.data.clientId);
      }
    },
    error(ws, error) {
      console.error('WebSocket error:', error);
      if (ws.data?.clientId) {
        wsManager.removeClient(ws.data.clientId);
      }
    }
  }
};
