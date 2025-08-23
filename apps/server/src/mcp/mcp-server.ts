import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { z } from "zod";
import { db } from "../db";
import { projects, tasks, taskDependencies, taskAdditionalRepositories, taskAgents } from "../db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { broadcastFlush } from "@/websocket/websocket-server";

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
  tool: (toolName: string, phase: string, context?: Record<string, any>) => {
    console.log(
      `[MCP-TOOL] ${new Date().toISOString()} tool:${toolName} phase:${phase}`,
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

// Helper function to calculate new task listOrder based on positioning strategy
async function calculateNewListOrder(
  positioning: "FIRST" | "LAST" | "FIRST_IN_MODE" | "LAST_IN_MODE",
  targetList: "todo" | "doing" | "done" | "loop",
  targetMode: string | null | undefined,
  projectId: string
): Promise<string> {
  const defaultOrder = "1000";
  
  try {
    switch (positioning) {
      case "FIRST": {
        // Get highest listOrder in target list (to place before all existing tasks)
        const highestTask = await db
          .select({ listOrder: tasks.listOrder })
          .from(tasks)
          .where(
            and(
              eq(tasks.projectId, projectId),
              eq(tasks.list, targetList)
            )
          )
          .orderBy(sql`CAST(${tasks.listOrder} AS DECIMAL) DESC`)
          .limit(1);

        if (highestTask.length === 0) {
          return defaultOrder;
        }
        
        const highest = parseFloat(highestTask[0].listOrder);
        return (highest + 1000).toString();
      }

      case "LAST": {
        // Get lowest listOrder in target list (to place after all existing tasks)
        const lowestTask = await db
          .select({ listOrder: tasks.listOrder })
          .from(tasks)
          .where(
            and(
              eq(tasks.projectId, projectId),
              eq(tasks.list, targetList)
            )
          )
          .orderBy(sql`CAST(${tasks.listOrder} AS DECIMAL) ASC`)
          .limit(1);

        if (lowestTask.length === 0) {
          return defaultOrder;
        }

        const lowest = parseFloat(lowestTask[0].listOrder);
        return (lowest - 1000).toString();
      }

      case "FIRST_IN_MODE": {
        // Get highest listOrder for tasks with same mode in target list
        const highestInMode = await db
          .select({ listOrder: tasks.listOrder })
          .from(tasks)
          .where(
            and(
              eq(tasks.projectId, projectId),
              eq(tasks.list, targetList),
              targetMode ? eq(tasks.mode, targetMode as any) : sql`${tasks.mode} IS NULL`
            )
          )
          .orderBy(sql`CAST(${tasks.listOrder} AS DECIMAL) DESC`)
          .limit(1);

        if (highestInMode.length === 0) {
          return defaultOrder;
        }

        const highest = parseFloat(highestInMode[0].listOrder);
        return (highest + 1000).toString();
      }

      case "LAST_IN_MODE": {
        // Get lowest listOrder for tasks with same mode in target list
        const lowestInMode = await db
          .select({ listOrder: tasks.listOrder })
          .from(tasks)
          .where(
            and(
              eq(tasks.projectId, projectId),
              eq(tasks.list, targetList),
              targetMode ? eq(tasks.mode, targetMode as any) : sql`${tasks.mode} IS NULL`
            )
          )
          .orderBy(sql`CAST(${tasks.listOrder} AS DECIMAL) ASC`)
          .limit(1);

        if (lowestInMode.length === 0) {
          return defaultOrder;
        }

        const lowest = parseFloat(lowestInMode[0].listOrder);
        return (lowest - 1000).toString();
      }

      default:
        return defaultOrder;
    }
  } catch (error) {
    logger.error("calculateNewListOrder failed", error, {
      positioning,
      targetList,
      targetMode,
      projectId,
    });
    return defaultOrder;
  }
}

// Function to register all MCP tools on a server instance
function registerMcpTools(server: McpServer) {
  // Register task_update tool
  server.registerTool("task_update",
    {
      title: "Update a task",
      description: "Update task fields during workflow modes. Use 'check' list for completed work pending human approval, 'done' list for approved completed work.",
      inputSchema: {
        taskId: z.string().uuid(),
        refinedTitle: z.string().optional(),
        refinedDescription: z.string().optional(),
        plan: z.unknown().optional(),
        list: z.enum(["todo", "doing", "done", "loop", "check"]).optional(),
        mode: z.enum(["clarify", "plan", "execute", "loop", "talk"]).optional().nullable(),
        agentSessionStatus: z.enum(["INACTIVE", "PUSHING", "ACTIVE"]).optional(),
      },
    },
    async (input, { requestInfo }) => {
      const { taskId, refinedTitle, refinedDescription, plan, list, mode, agentSessionStatus } = input;
      logger.tool("task_update", "init", { input });

      // Prepare initial updates
      const updates: any = { refinedTitle, refinedDescription, plan, list, mode };

      // Handle agentSessionStatus with timestamp tracking
      if (agentSessionStatus !== undefined) {
        updates.agentSessionStatus = agentSessionStatus;
        if (agentSessionStatus === "ACTIVE") {
          // Set timestamp when agent starts working
          updates.lastAgentSessionStartedAt = new Date();
        } else if (agentSessionStatus === "INACTIVE") {
          // Clear timestamp when agent stops working
          updates.lastAgentSessionStartedAt = null;
        }
      }

      // Filter out undefined values
      const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

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


        await db
          .update(tasks)
          .set({
            ...filteredUpdates,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, taskId));

        logger.tool("task_update", "successed", {
          taskId,
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
        logger.error("task_update failed", error, { taskId });
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
      description: "Create a new task for breaking down complex work. Only use dependsOnTaskIds if tasks must execute in specific order - otherwise leave empty. Use setListOrder to control task positioning within lists.",
      inputSchema: {
        createdByTaskId: z.string().uuid(),
        rawTitle: z.string().min(1).max(255).optional(),
        rawDescription: z.string().optional(),
        refinedTitle: z.string().min(1).max(255).optional(),
        refinedDescription: z.string().optional(),
        plan: z.unknown().optional(),
        priority: z.number().min(1).max(5).default(3),
        mode: z.enum(["plan", "execute", "talk"]).optional(),
        dependsOnTaskIds: z.array(z.string().uuid()).optional().default([]),
        setListOrder: z.enum(["FIRST", "LAST", "FIRST_IN_MODE", "LAST_IN_MODE"]).optional().default("FIRST"),
        list: z.enum(["todo", "doing", "done", "loop", "check"]).optional().default("todo"),
      },
    },
    async (input, { requestInfo }) => {
      const { createdByTaskId, rawTitle, rawDescription, refinedTitle, refinedDescription, plan, priority, mode, dependsOnTaskIds: dependsOn, setListOrder, list: targetList } = input;
      logger.tool("task_create", "init", { input });

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

        // Fetch the parent task to inherit its properties
        const parentTask = await db.query.tasks.findFirst({
          where: eq(tasks.id, createdByTaskId),
          with: {
            project: true,
            mainRepository: true,
            actor: true,
            additionalRepositories: {
              with: {
                repository: true
              }
            }
          }
        });

        if (!parentTask) {
          logger.error("task_create failed", {
            createdByTaskId,
            reason: "parent task not found",
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Parent task not found",
                }),
              },
            ],
          };
        }

        // Extract inherited properties
        const projectId = parentTask.projectId;
        const mainRepositoryId = parentTask.mainRepositoryId;
        const actorId = parentTask.actorId;
        const additionalRepositoryIds = parentTask.additionalRepositories.map(ar => ar.repositoryId);

        // Verify all dependency tasks exist and belong to the same project
        if (dependsOn && dependsOn.length > 0) {
          const dependencyTasks = await db
            .select()
            .from(tasks)
            .where(
              and(
                inArray(tasks.id, dependsOn),
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

        // Determine task list and mode
        const list = targetList || "todo";

        // Calculate listOrder based on positioning strategy
        const listOrder = await calculateNewListOrder(
          setListOrder || "FIRST", 
          list, 
          mode, 
          projectId
        );

        // Create the task
        const newTask = await db
          .insert(tasks)
          .values({
            projectId,
            mainRepositoryId,
            actorId,
            createdByTaskId,
            rawTitle: rawTitle || refinedTitle || "",
            rawDescription,
            refinedTitle,
            refinedDescription,
            plan,
            priority,
            list: list,
            listOrder: listOrder,
            mode: mode,
            author: "ai",
            ready: mode ? true : false, // AI tasks that skip clarify are automatically ready
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

        // Copy agent assignments from parent task
        const parentAgents = await db
          .select({ agentId: taskAgents.agentId })
          .from(taskAgents)
          .where(eq(taskAgents.taskId, createdByTaskId));

        if (parentAgents.length > 0) {
          const agentAssignments = parentAgents.map(pa => ({
            taskId,
            agentId: pa.agentId,
          }));
          await db.insert(taskAgents).values(agentAssignments);
          logger.debug("Agent assignments copied from parent task", {
            taskId,
            createdByTaskId,
            agentCount: parentAgents.length,
          });
        }

        logger.tool("task_create", "success", {
          taskId,
          rawTitle,
          refinedTitle,
          projectId,
          createdByTaskId,
          list: list,
          mode: mode,
          author: "ai",
          inheritedAgents: parentAgents.length,
        });

        broadcastFlush(projectId);

        return {
          content: [
            {
              type: "text",
              text: `Task created! Task ID: ${taskId}

📝 For ordered execution: Use this task ID in dependsOnTaskIds for the next task that must run after this one.`
            },
          ],
        };
      } catch (error) {
        logger.error("task_create failed", error, {
          createdByTaskId,
          mode,
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
