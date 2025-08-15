import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { db } from "../db";
import { projects, tasks, repoAgents } from "../db/schema";
import { eq } from "drizzle-orm";

// Import the improved orchestrator for integration
let orchestrator: any = null;

// Function to set orchestrator instance (called from main app)
export function setOrchestrator(orch: any) {
  orchestrator = orch;
  logger.info("MCP server integrated with improved orchestrator");
}

// Function to get orchestrator instance
export function getOrchestrator() {
  return orchestrator;
}

// Logging utilities for debug and history tracing
const logger = {
  info: (message: string, context?: Record<string, any>) => {
    console.log(
      `[MCP-INFO] ${new Date().toISOString()} ${message}`,
      context ? JSON.stringify(context) : ""
    );
  },
  error: (message: string, error?: any, context?: Record<string, any>) => {
    console.error(
      `[MCP-ERROR] ${new Date().toISOString()} ${message}`,
      error?.message || error,
      context ? JSON.stringify(context) : ""
    );
  },
  debug: (message: string, context?: Record<string, any>) => {
    if (
      process.env.NODE_ENV === "development" ||
      process.env.DEBUG_MCP === "true"
    ) {
      console.log(
        `[MCP-DEBUG] ${new Date().toISOString()} ${message}`,
        context ? JSON.stringify(context) : ""
      );
    }
  },
  auth: (message: string, context?: Record<string, any>) => {
    console.log(
      `[MCP-AUTH] ${new Date().toISOString()} ${message}`,
      context ? JSON.stringify(context) : ""
    );
  },
  tool: (toolName: string, action: string, context?: Record<string, any>) => {
    console.log(
      `[MCP-TOOL] ${new Date().toISOString()} ${toolName}.${action}`,
      context ? JSON.stringify(context) : ""
    );
  },
};

// Initialize simplified MCP server with only essential tools
const server = new McpServer({
  name: "solo-unicorn-mcp",
  version: "1.0.0",
});

logger.info("Simplified MCP Server initialized", {
  name: "solo-unicorn-mcp",
  version: "1.0.0",
});

// Small helper to enforce bearer auth from headers
function assertBearer(authHeader: string | string[] | undefined) {
  const expected = process.env.AGENT_AUTH_TOKEN || "default-agent-token";

  // Handle both string and string[] cases
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  logger.debug("Authentication attempt", {
    hasAuthHeader: !!headerValue,
    startsWithBearer: headerValue?.startsWith("Bearer "),
  });

  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    logger.auth("Authentication failed: missing or invalid token format", {
      headerValue: headerValue?.substring(0, 20) + "...",
    });
    throw new Error("unauthorized: missing token");
  }
  const token = headerValue.slice(7);
  if (token !== expected) {
    logger.auth("Authentication failed: invalid token", {
      tokenLength: token.length,
    });
    throw new Error("unauthorized: invalid token");
  }

  logger.auth("Authentication successful");
}

server.registerTool("task.update",
  {
    title: "Update a task",
    description: "Update task fields during workflow stages.",
    inputSchema: {
      taskId: z.string().uuid(),
      updates: z.object({
        refinedTitle: z.string().optional(),
        refinedDescription: z.string().optional(),
        plan: z.unknown().optional(),
        status: z.enum(["todo", "doing", "done"]).optional(),
        stage: z.enum(["refine", "kickoff", "execute"]).optional(),
      }),
    },
  },
  async ({ taskId, updates }, { requestInfo }) => {
    logger.tool("task.update", "start", {
      taskId,
      updates: updates as Record<string, any>,
    });

    try {
      assertBearer(requestInfo?.headers?.authorization);

      await db
        .update(tasks)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(tasks.id, taskId));

      logger.tool("task.update", "success", {
        taskId,
        updatedFields: Object.keys(updates),
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, taskId, updates }),
          },
        ],
      };
    } catch (error) {
      logger.error("task.update failed", error, {
        taskId,
        updates: updates as Record<string, any>,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
      };
    }
  }
);


server.registerTool("agent.rateLimit",
  {
    title: "Agent Rate Limit",
    description: "Mark the agent as rate limited with an optional resolve time.",
    inputSchema: {
      sessionId: z.string().uuid(),
      resolveAt: z.string().datetime(),
    },
  },
  async ({ sessionId, resolveAt }, { requestInfo }) => {
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader)
      ? agentIdHeader[0]
      : agentIdHeader;

    logger.tool("agent.rateLimit", "start", { agentId, sessionId, resolveAt });

    try {
      assertBearer(requestInfo?.headers?.authorization);

      if (!agentId) {
        logger.tool("agent.rateLimit", "failed", {
          reason: "missing_agent_id",
          sessionId,
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                message: "Agent ID header required",
              }),
            },
          ],
        };
      }

      await db
        .update(repoAgents)
        .set({ status: "rate_limited", updatedAt: new Date() })
        .where(eq(repoAgents.id, agentId));

      logger.tool("agent.rateLimit", "success", {
        agentId,
        sessionId,
        resolveAt,
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true }) }],
      };
    } catch (error) {
      logger.error("agent.rateLimit failed", error, { agentId, sessionId });
      throw error;
    }
  }
);

server.registerTool("project.memory.update",
  {
    title: "Update Project Memory",
    description: "Update project memory with learnings and context.",
    inputSchema: {
      projectId: z.string().uuid(),
      memory: z.string(),
    },
  },
  async ({ projectId, memory }, { requestInfo }) => {
    logger.tool("project.memory.update", "start", {
      projectId,
      memoryLength: memory.length,
    });

    try {
      assertBearer(requestInfo?.headers?.authorization);

      await db
        .update(projects)
        .set({
          memory,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));

      logger.tool("project.memory.update", "success", {
        projectId,
        memoryLength: memory.length,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ success: true, projectId }),
          },
        ],
      };
    } catch (error) {
      logger.error("project.memory.update failed", error, {
        projectId,
        memoryLength: memory.length,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
      };
    }
  }
);

server.registerTool("project.memory.get",
  {
    title: "Get Project Memory",
    description: "Get project memory and context.",
    inputSchema: {
      projectId: z.string().uuid(),
    },
  },
  async ({ projectId }, { requestInfo }) => {
    logger.tool("project.memory.get", "start", { projectId });

    try {
      assertBearer(requestInfo?.headers?.authorization);

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
      });

      if (!project) {
        logger.tool("project.memory.get", "not_found", { projectId });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: "Project not found",
              }),
            },
          ],
        };
      }

      logger.tool("project.memory.get", "success", {
        projectId,
        hasMemory: !!project.memory,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              projectId,
              memory: project.memory || "",
              project: {
                id: project.id,
                name: project.name,
                description: project.description,
              },
            }),
          },
        ],
      };
    } catch (error) {
      logger.error("project.memory.get failed", error, { projectId });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          },
        ],
      };
    }
  }
);

// Import Node.js HTTP module for native server
import { createServer } from "http";

// Global MCP HTTP server instance
let mcpHttpServer: any = null;
let currentTransport: any = null;

// Function to create a fresh transport and connect server
async function createFreshTransport() {
  // Disconnect previous transport if it exists
  if (currentTransport) {
    try {
      await currentTransport.close();
      logger.debug("Previous transport closed successfully");
    } catch (e) {
      logger.debug(
        "Error closing previous transport:",
        e as Record<string, any>
      );
    }
  }

  // Create new transport
  currentTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => Math.random().toString(36).substring(2, 15),
  });

  // The key fix: we need to create a new server instance for each session
  // because MCP servers maintain internal state that prevents re-initialization
  try {
    // Check if server is already connected, and if so, close it first
    if (server) {
      try {
        await server.close();
        logger.debug("Previous server connection closed");
      } catch (e) {
        logger.debug(
          "Server was not connected or error closing:",
          e as Record<string, any>
        );
      }
    }

    // Connect the server to the new transport
    await server.connect(currentTransport);
    logger.debug("Fresh MCP transport created and server connected");
  } catch (error) {
    logger.error("Error connecting server to fresh transport:", error);
    throw error;
  }

  return currentTransport;
}

// Expose a function to start a native HTTP server for MCP
export async function startMcpHttpServer(port = 8502) {
  logger.info("Starting simplified native MCP HTTP server", { port });

  // Create initial transport
  await createFreshTransport();
  logger.info("Simplified MCP server connected to HTTP transport");

  // Create native HTTP server following the example pattern
  mcpHttpServer = createServer(async (request, response) => {
    const startTime = Date.now();

    logger.debug("MCP HTTP request received", {
      method: request.method,
      url: request.url,
      headers: request.headers,
    });

    // Only handle requests to /mcp path (MCP Inspector expects this)
    if (!request.url?.startsWith("/mcp")) {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Not found - use /mcp endpoint" }));
      return;
    }

    // Handle DELETE requests as session cleanup/reset
    if (request.method === "DELETE") {
      logger.debug("MCP session cleanup requested - creating fresh transport");
      try {
        // Create fresh transport for new session
        const freshTransport = await createFreshTransport();
        logger.debug("Fresh transport created successfully for new session");
      } catch (error) {
        logger.error("Failed to create fresh transport:", error);
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          success: true,
          message: "Session cleaned up and fresh transport created",
        })
      );
      return;
    }

    // Only handle POST requests for MCP protocol
    if (request.method !== "POST") {
      response.writeHead(405, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    try {
      // Check authentication before processing request (if auth is enabled)
      const authRequired =
        process.env.AGENT_AUTH_TOKEN &&
        process.env.AGENT_AUTH_TOKEN !== "disabled";
      if (authRequired) {
        try {
          assertBearer(request.headers.authorization);
          logger.auth("HTTP MCP request authenticated successfully");
        } catch (authError) {
          logger.auth("HTTP MCP request authentication failed", {
            url: request.url,
            hasAuth: !!request.headers.authorization,
            authToken: process.env.AGENT_AUTH_TOKEN?.substring(0, 8) + "...",
          });
          response.writeHead(401, { "Content-Type": "application/json" });
          response.end(
            JSON.stringify({
              jsonrpc: "2.0",
              error: {
                code: -32600,
                message:
                  "Unauthorized: " +
                  (authError instanceof Error
                    ? authError.message
                    : String(authError)),
              },
              id: null,
            })
          );
          return;
        }
      } else {
        logger.auth("HTTP MCP request - authentication disabled");
      }

      // Collect request body chunks
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }

      // Parse JSON body
      const bodyBuffer = Buffer.concat(chunks);
      const body = JSON.parse(bodyBuffer.toString());

      logger.debug("MCP request body", {
        method: body?.method,
        id: body?.id,
        hasParams: !!body?.params,
      });

      // Handle the request using MCP transport
      if (!currentTransport) {
        logger.debug("No current transport, creating fresh one");
        await createFreshTransport();
      }

      await currentTransport.handleRequest(request, response, body);

      const duration = Date.now() - startTime;
      logger.debug("MCP HTTP request completed", {
        method: request.method,
        duration,
        mcpMethod: body?.method,
        responseHeaders: response.getHeaders(),
        responseStatusCode: response.statusCode,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error("MCP HTTP request failed", error, {
        method: request.method,
        url: request.url,
        duration,
      });

      if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "MCP server error" }));
      }
    }
  });

  // Start listening
  mcpHttpServer.listen(port, () => {
    logger.info(
      `Simplified MCP HTTP server listening on http://localhost:${port}`
    );
  });

  return mcpHttpServer;
}

// Function to stop the MCP server
export function stopMcpHttpServer() {
  if (mcpHttpServer) {
    mcpHttpServer.close();
    mcpHttpServer = null;
    logger.info("Simplified MCP HTTP server stopped");
  }
}

// Legacy function for Hono integration (now redirects to native server)
export async function registerMcpHttp(app: any, basePath = "/mcp") {
  logger.info("Simplified MCP HTTP registered via redirect", { basePath });

  // Add a route that redirects to the native MCP server
  app.all(basePath, async (c: any) => {
    return c.json(
      {
        error: "MCP endpoint moved",
        message: `Please use the native MCP server at http://localhost:${process.env.MCP_PORT || 8502}/mcp`,
        redirect: `http://localhost:${process.env.MCP_PORT || 8502}/mcp`,
      },
      301
    );
  });
}
