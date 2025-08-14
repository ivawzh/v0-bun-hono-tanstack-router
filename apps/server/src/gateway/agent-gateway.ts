import { Hono } from "hono";
import { cors } from "hono/cors";
import * as v from "valibot";
import { db } from "../db";
import { repoAgents, tasks, projects, sessions } from "../db/schema/simplified";
import { eq, and, desc, isNull } from "drizzle-orm";

// This file is deprecated in the simplified Solo Unicorn architecture.
// Task management is now handled through WebSocket communication on port 8500.
// See websocket-server.ts for the new simplified agent communication protocol.

const agentGateway = new Hono();

// Simple health check for backward compatibility
agentGateway.get("/health", async (c) => {
  return c.json({ 
    status: "deprecated",
    message: "Agent Gateway has been replaced by WebSocket Server on port 8500",
    redirect: "ws://localhost:8500/ws/agent"
  });
});

export { agentGateway };
