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
import { agentGateway } from "./gateway/agent-gateway";
import { mcpServer } from "./mcp/mcp-server";
import { oauthCallbackRoutes } from "./routers/oauth-callback";
import { simplifiedWebsocketHandler } from "./gateway/simplified-websocket-handler";

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

// Mount agent gateway at /agent
app.route("/agent", agentGateway);

// Mount MCP server at /mcp
app.route("/mcp", mcpServer);

const port = process.env.PORT || 8500;

export default {
  port,
  fetch: async (request: Request, server: any) => {
    // Check if this is a WebSocket upgrade request
    if (request.headers.get("upgrade") === "websocket") {
      const url = new URL(request.url);
      if (url.pathname === "/ws/agent") {
        // Upgrade to WebSocket
        const success = server.upgrade(request, {
          data: { path: "/ws/agent" }
        });
        return success ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
      }
    }
    // Otherwise handle as normal HTTP request
    return app.fetch(request, server);
  },
  websocket: simplifiedWebsocketHandler,
};
