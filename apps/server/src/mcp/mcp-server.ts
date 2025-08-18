import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { z } from "zod";
import { db } from "../db";
import { projects, tasks, repositories, actors, taskDependencies, taskAdditionalRepositories } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { broadcastFlush } from "@/websocket/websocket-server";

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

// Small helper to enforce bearer auth from headers
function assertBearer(authHeader: string | string[] | undefined) {
  const expected = process.env.CLAUDE_CODE_UI_AUTH_TOKEN || "default-agent-token";

  // Handle both string and string[] cases
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

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
}

// Function to register all MCP tools on a server instance
function registerMcpTools(server: McpServer) {
  // Register task_update tool
  server.registerTool("task_update",
    {
      title: "Update a task",
      description: "Update task fields during workflow stages.",
      inputSchema: {
        taskId: z.string().uuid(),
        refinedTitle: z.string().optional(),
        refinedDescription: z.string().optional(),
        plan: z.unknown().optional(),
        status: z.enum(["todo", "doing", "done", "loop"]).optional(),
        stage: z.enum(["clarify", "plan", "execute", "loop"]).optional().nullable(),
        isAiWorking: z.boolean().optional(),
      },
    },
    async ({ taskId, refinedTitle, refinedDescription, plan, status, stage, isAiWorking }, { requestInfo }) => {
      logger.info(`RequestInfo: `, requestInfo);

      // Prepare initial updates
      const updates: any = { refinedTitle, refinedDescription, plan, status, stage };

      // Special handling for loop tasks that are marked as "done"
      // Loop tasks should never stay in "done" status, they should cycle back to "loop"
      let shouldHandleLoopCompletion = false;
      if (status === "done") {
        const task = await db.query.tasks.findFirst({
          where: eq(tasks.id, taskId),
        });

        if (task && task.stage === "loop") {
          // This is a loop task being completed, handle it specially
          shouldHandleLoopCompletion = true;
          updates.status = "loop"; // Override to loop instead of done
          updates.stage = "loop";
        }
      }

      // Handle isAiWorking with timestamp tracking
      if (isAiWorking !== undefined) {
        updates.isAiWorking = isAiWorking;
        if (isAiWorking === true) {
          // Set timestamp when AI starts working
          updates.aiWorkingSince = new Date();
        } else if (isAiWorking === false) {
          // Clear timestamp when AI stops working
          updates.aiWorkingSince = null;
        }
      }

      // Filter out undefined values
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      logger.tool("task_update", "start", {
        taskId,
        updates: filteredUpdates,
      });

      try {
        assertBearer(requestInfo?.headers?.authorization);

        const task = await db.query.tasks.findFirst({
          where: eq(tasks.id, taskId),
        });

        if (!task) {
          logger.error("task_update failed", {
            taskId,
            reason: "task not found",
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Task not found",
                }),
              },
            ],
          };
        }

        // Handle fair rotation for loop tasks completion
        if (shouldHandleLoopCompletion) {
          // Get the highest column order in the loop column to append at bottom
          const loopTasks = await db
            .select({ columnOrder: tasks.columnOrder })
            .from(tasks)
            .where(
              and(
                eq(tasks.projectId, task.projectId),
                eq(tasks.status, 'loop')
              )
            )
            .orderBy(sql`CAST(${tasks.columnOrder} AS DECIMAL) DESC`)
            .limit(1);

          let newColumnOrder = "1000"; // Default if no loop tasks exist
          if (loopTasks.length > 0) {
            const highestOrder = parseFloat(loopTasks[0].columnOrder);
            newColumnOrder = (highestOrder + 1000).toString(); // Add 1000 to be at bottom
          }

          filteredUpdates.columnOrder = newColumnOrder;
          logger.info("Loop task completion - appending to bottom of loop column", {
            taskId,
            newColumnOrder
          });
        }

        await db
          .update(tasks)
          .set({
            ...filteredUpdates,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskId));

        logger.tool("task_update", "success", {
          taskId,
          updatedFields: Object.keys(filteredUpdates),
        });

        broadcastFlush(task.projectId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, taskId, updates: filteredUpdates }),
            },
          ],
        };
      } catch (error) {
        logger.error("task_update failed", error, {
          taskId,
          updates: filteredUpdates,
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

  // Register agent_rateLimit tool
  server.registerTool("agent_rateLimit",
    {
      title: "Agent Rate Limit",
      description: "Mark the agent as rate limited with an optional resolve time.",
      inputSchema: {
        agentClientType: z.enum(["CLAUDE_CODE", "CURSOR_CLI", "OPENCODE"]),
        resolveAt: z.string().datetime(),
      },
    },
    async ({ agentClientType, resolveAt }, { requestInfo }) => {
      const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
      const agentId = Array.isArray(agentIdHeader)
        ? agentIdHeader[0]
        : agentIdHeader;

      logger.tool("agent_rateLimit", "start", { agentId, agentClientType, resolveAt });

      try {
        assertBearer(requestInfo?.headers?.authorization);

        if (!agentId) {
          logger.tool("agent_rateLimit", "failed", {
            reason: "missing_agent_id",
            agentClientType,
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

        // Note: Rate limit status is now tracked in agentClients.state, not repoAgents.status
        // The rate limit information will be updated via claude-code-client.ts
        logger.debug('Rate limit info received, will be handled by claude-code-client.ts');

        logger.tool("agent_rateLimit", "success", {
          agentId,
          agentClientType,
          resolveAt,
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ success: true }) }],
        };
      } catch (error) {
        logger.error("agent_rateLimit failed", error, { agentId, agentClientType });
        throw error;
      }
    }
  );

  // Register project_memory_update tool
  server.registerTool("project_memory_update",
    {
      title: "Update Project Memory",
      description: "Update project memory with learnings and context.",
      inputSchema: {
        projectId: z.string().uuid(),
        memory: z.string(),
      },
    },
    async ({ projectId, memory }, { requestInfo }) => {
      logger.tool("project_memory_update", "start", {
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

        logger.tool("project_memory_update", "success", {
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
        logger.error("project_memory_update failed", error, {
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

  // Register project_memory_get tool
  server.registerTool("project_memory_get",
    {
      title: "Get Project Memory",
      description: "Get project memory and context.",
      inputSchema: {
        projectId: z.string().uuid(),
      },
    },
    async ({ projectId }, { requestInfo }) => {
      logger.tool("project_memory_get", "start", { projectId });

      try {
        assertBearer(requestInfo?.headers?.authorization);

        const project = await db.query.projects.findFirst({
          where: eq(projects.id, projectId),
        });

        if (!project) {
          logger.tool("project_memory_get", "not_found", { projectId });
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

        logger.tool("project_memory_get", "success", {
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
        logger.error("project_memory_get failed", error, { projectId });
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

  // Register task_create tool
  server.registerTool("task_create",
    {
      title: "Create a new task",
      description: "Create a new task and return the created task information including its task ID.",
      inputSchema: {
        projectId: z.string().uuid(),
        mainRepositoryId: z.string().uuid(),
        additionalRepositoryIds: z.array(z.string().uuid()).optional().default([]),
        actorId: z.string().uuid().optional(),
        rawTitle: z.string().min(1).max(255).optional(),
        rawDescription: z.string().optional(),
        refinedTitle: z.string().min(1).max(255).optional(),
        refinedDescription: z.string().optional(),
        plan: z.unknown().optional(),
        priority: z.number().min(1).max(5).default(3),
        stage: z.enum(["plan", "execute"]).optional(),
        dependsOn: z.array(z.string().uuid()).optional().default([]),
      },
    },
    async ({ projectId, mainRepositoryId, additionalRepositoryIds, actorId, rawTitle, rawDescription, refinedTitle, refinedDescription, plan, priority, stage, dependsOn }, { requestInfo }) => {
      logger.tool("task_create", "start", {
        projectId,
        mainRepositoryId,
        additionalRepositoryIds,
        stage,
        hasRefinedTitle: !!refinedTitle,
        dependencyCount: dependsOn?.length || 0,
      });

      try {
        assertBearer(requestInfo?.headers?.authorization);

        // Validate that either raw or refined title is provided
        if (!rawTitle && !refinedTitle) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Either rawTitle or refinedTitle must be provided",
                }),
              },
            ],
          };
        }

        // Verify project exists (we can't verify ownership as we don't have user context in MCP)
        const project = await db.query.projects.findFirst({
          where: eq(projects.id, projectId),
        });

        if (!project) {
          logger.error("task_create failed", {
            projectId,
            reason: "project not found",
          });
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

        // Verify main repository belongs to project
        const mainRepository = await db.query.repositories.findFirst({
          where: and(
            eq(repositories.id, mainRepositoryId),
            eq(repositories.projectId, projectId)
          ),
        });

        if (!mainRepository) {
          logger.error("task_create failed", {
            mainRepositoryId,
            projectId,
            reason: "main repository not found or doesn't belong to project",
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Main repository not found or doesn't belong to project",
                }),
              },
            ],
          };
        }

        // Verify additional repositories belong to project (if provided)
        if (additionalRepositoryIds && additionalRepositoryIds.length > 0) {
          const additionalRepositories = await db
            .select()
            .from(repositories)
            .where(
              and(
                sql`${repositories.id} = ANY(${additionalRepositoryIds})`,
                eq(repositories.projectId, projectId)
              )
            );

          if (additionalRepositories.length !== additionalRepositoryIds.length) {
            logger.error("task_create failed", {
              additionalRepositoryIds,
              projectId,
              reason: "some additional repositories not found or don't belong to project",
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: "Some additional repositories not found or don't belong to project",
                  }),
                },
              ],
            };
          }
        }

        // Verify actor belongs to project (if provided)
        if (actorId) {
          const actor = await db.query.actors.findFirst({
            where: and(
              eq(actors.id, actorId),
              eq(actors.projectId, projectId)
            ),
          });

          if (!actor) {
            logger.error("task_create failed", {
              actorId,
              projectId,
              reason: "actor not found or doesn't belong to project",
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: "Actor not found or doesn't belong to project",
                  }),
                },
              ],
            };
          }
        }

        // Verify all dependency tasks exist and belong to the same project
        if (dependsOn && dependsOn.length > 0) {
          const dependencyTasks = await db
            .select()
            .from(tasks)
            .where(
              and(
                sql`${tasks.id} = ANY(${dependsOn})`,
                eq(tasks.projectId, projectId)
              )
            );

          if (dependencyTasks.length !== dependsOn.length) {
            logger.error("task_create failed", {
              dependsOn,
              foundCount: dependencyTasks.length,
              reason: "some dependency tasks not found or don't belong to project",
            });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: "Some dependency tasks not found or don't belong to project",
                  }),
                },
              ],
            };
          }
        }

        // Determine task status and stage
        let taskStatus = "todo";
        let taskStage = null;

        if (stage) {
          taskStatus = "doing";
          taskStage = stage;
        }

        // Create the task
        const newTask = await db
          .insert(tasks)
          .values({
            projectId,
            mainRepositoryId,
            actorId,
            rawTitle: rawTitle || refinedTitle || "",
            rawDescription,
            refinedTitle,
            refinedDescription,
            plan,
            priority,
            status: taskStatus,
            stage: taskStage,
            author: "ai",
            ready: stage ? true : false, // AI tasks that skip clarify are automatically ready
          })
          .returning();

        const taskId = newTask[0].id;

        // Create additional repository associations if provided
        if (additionalRepositoryIds && additionalRepositoryIds.length > 0) {
          const additionalRepoInserts = additionalRepositoryIds.map(repositoryId => ({
            taskId,
            repositoryId,
          }));

          await db.insert(taskAdditionalRepositories).values(additionalRepoInserts);

          logger.debug("Additional repository associations created", {
            taskId,
            additionalRepositoryIds,
            associationCount: additionalRepoInserts.length,
          });
        }

        // Create task dependencies if provided
        if (dependsOn && dependsOn.length > 0) {
          const dependencyInserts = dependsOn.map(dependsOnTaskId => ({
            taskId,
            dependsOnTaskId,
          }));

          await db.insert(taskDependencies).values(dependencyInserts);

          logger.debug("Task dependencies created", {
            taskId,
            dependsOn,
            dependencyCount: dependencyInserts.length,
          });
        }

        logger.tool("task_create", "success", {
          taskId,
          projectId,
          status: taskStatus,
          stage: taskStage,
          author: "ai",
        });

        broadcastFlush(projectId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                taskId,
                task: newTask[0],
              }),
            },
          ],
        };
      } catch (error) {
        logger.error("task_create failed", error, {
          projectId,
          mainRepositoryId,
          stage,
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
}

logger.info("MCP Server module initialized", {
  name: "solo-unicorn-mcp",
  version: "1.0.0",
});

// Function to create a fresh stateless MCP server for each request
function createStatelessMcpServer() {
  const server = new McpServer({
    name: "solo-unicorn-mcp",
    title: "Solo Unicorn MCP Server. Solo Unicorn is a AI agent task management system. Basically Trello for AI tasks. Auto queuing, processing, recursive creation of tasks.",
    version: "1.0.0",
  });

  logger.debug("Stateless MCP Server instance created", {
    name: "solo-unicorn-mcp",
    version: "1.0.0",
  });

  // Register all tools on the server instance
  registerMcpTools(server);

  return server;
}

// Function for Hono integration using the mcp-hono-stateless approach
export async function registerMcpHttp(app: any, basePath = "/mcp") {
  logger.info("MCP HTTP registered on Hono server (stateless)", { basePath });

  app.post(basePath, async (c: any) => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Parse request body first to log MCP details
    const requestBody = await c.req.json();

    // Enhanced logging to show MCP tool and payload
    logger.debug("MCP HTTP request received", {
      method: c.req.method,
      url: c.req.url,
      headers: c.req.header(),
    });

    // Log MCP-specific details
    if (requestBody.method === 'tools/call' && requestBody.params) {
      logger.info(`[MCP-CALL] ${timestamp} Tool: ${requestBody.params.name}`, {
        tool: requestBody.params.name,
        arguments: requestBody.params.arguments,
        requestId: requestBody.id,
      });
    } else {
      logger.info(`[MCP-REQUEST] ${timestamp} Method: ${requestBody.method}`, {
        method: requestBody.method,
        params: requestBody.params,
        requestId: requestBody.id,
      });
    }

    try {
      // Check authentication before processing request (if auth is enabled)
      const authRequired =
        process.env.CLAUDE_CODE_UI_AUTH_TOKEN &&
        process.env.CLAUDE_CODE_UI_AUTH_TOKEN !== "disabled";
      if (authRequired) {
        try {
          assertBearer(c.req.header("authorization"));
          logger.auth("MCP request authenticated successfully");
        } catch (authError) {
          logger.auth("MCP request authentication failed", {
            url: c.req.url,
            hasAuth: !!c.req.header("authorization"),
            authToken: process.env.CLAUDE_CODE_UI_AUTH_TOKEN?.substring(0, 8) + "...",
          });
          return c.json(
            {
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
            },
            401
          );
        }
      } else {
        logger.auth("MCP request - authentication disabled");
      }

      // Convert Hono request to Node.js request/response using fetch-to-node
      const { req, res } = toReqRes(c.req.raw);

      // Create a fresh MCP server instance for this request (stateless)
      const server = createStatelessMcpServer();

      try {
        // Create a fresh transport for this request
        const transport = new StreamableHTTPServerTransport({
          // This is a stateless MCP server, so we don't need to keep track of sessions
          sessionIdGenerator: undefined,
          // Enable JSON responses
          enableJsonResponse: true,
        });

        // Connect the server to the transport
        await server.connect(transport);

        // Handle the request
        await transport.handleRequest(req, res, requestBody);

        // Clean up on response close
        res.on('close', () => {
          transport.close();
          server.close();
        });

        const duration = Date.now() - startTime;
        logger.info(`[MCP-RESPONSE] ${new Date().toISOString()} Request completed`, {
          method: c.req.method,
          duration: `${duration}ms`,
          tool: requestBody.params?.name || requestBody.method,
          requestId: requestBody.id,
        });

        // Convert Node.js response back to Fetch API response
        return toFetchResponse(res);
      } catch (error) {
        logger.error("MCP server error", error);

        // Clean up on error
        try {
          server.close();
        } catch (closeError) {
          logger.debug("Error closing server:", closeError as Record<string, any>);
        }

        throw error;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[MCP-ERROR] ${new Date().toISOString()} Request failed`, error, {
        method: c.req.method,
        url: c.req.url,
        duration: `${duration}ms`,
        tool: requestBody?.params?.name || requestBody?.method,
        requestId: requestBody?.id,
      });

      return c.json({ error: "MCP server error" }, 500);
    }
  });

  // Add OPTIONS route for CORS
  app.options(basePath, async (c: any) => {
    return new Response(null, { status: 200 });
  });
}
