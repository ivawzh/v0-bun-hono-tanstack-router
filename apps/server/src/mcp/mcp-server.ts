import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { db } from "../db";
import { projects, tasks, repoAgents, actors, sessions } from "../db/schema/simplified";
import { and, desc, eq, sql } from "drizzle-orm";

// Remove unused types - now using Zod schemas directly

// Initialize MCP server with only the tools we need
const server = new McpServer({
  name: "solo-unicorn-mcp",
  version: "1.0.0"
});

// Small helper to enforce bearer auth from headers
function assertBearer(authHeader: string | string[] | undefined) {
  const expected = process.env.AGENT_AUTH_TOKEN || "default-agent-token";

  // Handle both string and string[] cases
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    throw new Error("unauthorized: missing token");
  }
  const token = headerValue.slice(7);
  if (token !== expected) {
    throw new Error("unauthorized: invalid token");
  }
}

// Tools for code agents
server.tool(
  "agent.auth",
  "Validate a code agent by client type and repo path, then mark it active.",
  {
    clientType: z.enum(["claude_code", "opencode"]),
    repoPath: z.string().min(1)
  },
  async ({ clientType, repoPath }, { requestInfo }) => {
    assertBearer(requestInfo?.headers?.authorization);

    const repoAgent = await db.query.repoAgents.findFirst({
      where: and(
        eq(repoAgents.clientType, clientType),
        eq(repoAgents.repoPath, repoPath)
      )
    });

    if (!repoAgent) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: false, message: `No repo agent found for ${clientType} at ${repoPath}` })
          }
        ]
      };
    }

    await db
      .update(repoAgents)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(repoAgents.id, repoAgent.id));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            agent: { id: repoAgent.id, clientType: repoAgent.clientType, repoPath: repoAgent.repoPath }
          })
        }
      ]
    };
  }
);

server.tool(
  "agent.requestTask",
  "Assign the highest-priority ready task for this agent. Requires x-agent-id header.",
  async ({ requestInfo }) => {
    assertBearer(requestInfo?.headers?.authorization);
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    if (!agentId) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent ID header required" }) }]
      };
    }

    const repoAgent = await db.query.repoAgents.findFirst({
      where: eq(repoAgents.id, agentId),
      with: { project: true }
    });
    if (!repoAgent) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, message: "Repo agent not found" }) }]
      };
    }

    const activeSession = await db.query.sessions.findFirst({
      where: and(eq(sessions.repoAgentId, agentId), eq(sessions.status, "active"))
    });
    if (activeSession) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent already has an active session" }) }]
      };
    }

    const availableTask = await db.query.tasks.findFirst({
      where: and(eq(tasks.ready, true), eq(tasks.status, "todo"), eq(tasks.repoAgentId, repoAgent.id)),
      orderBy: [
        sql`CASE ${tasks.priority}
            WHEN 'P1' THEN 1
            WHEN 'P2' THEN 2
            WHEN 'P3' THEN 3
            WHEN 'P4' THEN 4
            WHEN 'P5' THEN 5
            ELSE 6
          END`,
        tasks.createdAt
      ],
      with: { project: true, repoAgent: true, actor: true }
    });

    if (!availableTask) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, message: "No tasks available" }) }]
      };
    }

    const [session] = await db
      .insert(sessions)
      .values({ taskId: availableTask.id, repoAgentId: repoAgent.id, status: "active" })
      .returning();

    await db
      .update(tasks)
      .set({ status: "doing", stage: "refine", updatedAt: new Date() })
      .where(eq(tasks.id, availableTask.id));

    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, task: availableTask, sessionId: session.id }) }]
    };
  }
);

server.tool(
  "agent.health",
  "Report runtime status for the agent. Requires x-agent-id header.",
  {
    status: z.enum(["available", "busy", "rate_limited", "error"])
  },
  async ({ status }, { requestInfo }) => {
    assertBearer(requestInfo?.headers?.authorization);
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    if (!agentId) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent ID header required" }) }]
      };
    }

    let nextStatus: "idle" | "active" | "rate_limited" | "error" = "idle";
    switch (status) {
      case "available":
        nextStatus = "idle"; break;
      case "busy":
        nextStatus = "active"; break;
      case "rate_limited":
        nextStatus = "rate_limited"; break;
      case "error":
        nextStatus = "error"; break;
    }

    await db.update(repoAgents).set({ status: nextStatus, updatedAt: new Date() }).where(eq(repoAgents.id, agentId));
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, status }) }]
    };
  }
);

server.tool(
  "agent.rateLimit",
  "Mark the agent as rate limited with an optional resolve time.",
  {
    sessionId: z.string().uuid(),
    resolveAt: z.string().datetime()
  },
  async ({ sessionId, resolveAt }, { requestInfo }) => {
    assertBearer(requestInfo?.headers?.authorization);
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    if (!agentId) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent ID header required" }) }]
      };
    }

    await db.update(repoAgents).set({ status: "rate_limited", updatedAt: new Date() }).where(eq(repoAgents.id, agentId));
    // Future: persist rate limit metadata
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true }) }]
    };
  }
);

server.tool(
  "agent.sessionComplete",
  "Mark a session completed or failed and update the task state accordingly.",
  {
    sessionId: z.string().uuid(),
    success: z.boolean(),
    error: z.string().optional()
  },
  async ({ sessionId, success, error }, { requestInfo }) => {
    assertBearer(requestInfo?.headers?.authorization);
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    if (!agentId) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent ID header required" }) }]
      };
    }

    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.repoAgentId, agentId)),
      with: { task: true }
    });
    if (!session) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, message: "Session not found" }) }]
      };
    }

    await db
      .update(sessions)
      .set({ status: success ? "completed" : "failed", completedAt: new Date() })
      .where(eq(sessions.id, sessionId));

    if (success) {
      await db.update(tasks).set({ status: "done", stage: null, updatedAt: new Date() }).where(eq(tasks.id, session.task.id));
    } else {
      await db
        .update(tasks)
        .set({ status: "todo", stage: null, ready: false, updatedAt: new Date() })
        .where(eq(tasks.id, session.task.id));
    }

    await db.update(repoAgents).set({ status: "idle", updatedAt: new Date() }).where(eq(repoAgents.id, agentId));
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true }) }]
    };
  }
);

// Health tool for MCP server itself
server.tool(
  "server.health",
  "Return MCP server status.",
  async () => ({
    content: [{ type: "text", text: JSON.stringify({ status: "ok", service: "Solo Unicorn MCP Server" }) }]
  })
);

// Expose a function to register the HTTP transport handlers on a Hono app
export async function registerMcpHttp(app: any, basePath = "/mcp") {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => Math.random().toString(36).substring(2, 15)
  });

  // Connect the server to the transport
  await server.connect(transport);

  // Streamable HTTP uses a single endpoint that handles all MCP messages
  app.all(basePath, async (c: any) => {
    try {
      // Extract body for POST requests
      let body;
      if (c.req.method === 'POST') {
        body = await c.req.json();
      }

      // Convert Hono's context to Node.js IncomingMessage/ServerResponse style
      // This is a simplified approach - for production you might need a proper adapter
      const nodeReq = c.req.raw as any;

      // Create a mock response object that collects the response
      let statusCode = 200;
      let responseHeaders: Record<string, string> = {};
      let responseBody = '';

      const mockRes = {
        statusCode,
        setHeader: (name: string, value: string) => { responseHeaders[name] = value; },
        writeHead: (code: number, headers?: Record<string, string>) => {
          statusCode = code;
          if (headers) Object.assign(responseHeaders, headers);
        },
        write: (chunk: any) => { responseBody += chunk; },
        end: (chunk?: any) => {
          if (chunk) responseBody += chunk;
        },
      } as any;

      await transport.handleRequest(nodeReq, mockRes, body);

      return c.text(responseBody, statusCode, responseHeaders);
    } catch (err) {
      return c.json({ error: "MCP server error" }, 500);
    }
  });
}
