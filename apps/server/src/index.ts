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
import { startTaskMonitoring, stopTaskMonitoring } from "./agents/task-monitor";
import { onError } from "@orpc/server";

const app = new Hono();

app.use(logger((str, ...rest) => {
  console.log(`${new Date().toISOString()} ${str}`, ...rest);
}));
app.use("/*", cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:8302", "https://solounicorn.lol", "https://www.solounicorn.lol", "https://api.solounicorn.lol"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-forwarded-for", "x-forwarded-proto"],
  credentials: true,
}));

// Mount OAuth callback routes
app.route("/api/oauth", oauthCallbackRoutes);

// V2 API routes are now handled through oRPC endpoints

const handler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error, options, ...rest) => {
      console.error(`🚨 [rpc] Error - URL: ${options.request.url.href} | Error:`, error, { appUser: options.context.appUser })
    })
  ]
});
app.use("/rpc/*", async (c, next) => {
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

// Initialize task monitoring system on startup
startTaskMonitoring();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  stopTaskMonitoring();
  wsManager.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  stopTaskMonitoring();
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
