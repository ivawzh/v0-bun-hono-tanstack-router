import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { db } from "../db";
import { projects, tasks, repoAgents, actors, sessions } from "../db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

// Import the improved orchestrator for integration
let orchestrator: any = null;

// Function to set orchestrator instance (called from main app)
export function setOrchestrator(orch: any) {
  orchestrator = orch;
  logger.info("MCP server integrated with improved orchestrator");
}

// Logging utilities for debug and history tracing
const logger = {
  info: (message: string, context?: Record<string, any>) => {
    console.log(`[MCP-INFO] ${new Date().toISOString()} ${message}`, context ? JSON.stringify(context) : '');
  },
  error: (message: string, error?: any, context?: Record<string, any>) => {
    console.error(`[MCP-ERROR] ${new Date().toISOString()} ${message}`, error?.message || error, context ? JSON.stringify(context) : '');
  },
  debug: (message: string, context?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MCP === 'true') {
      console.log(`[MCP-DEBUG] ${new Date().toISOString()} ${message}`, context ? JSON.stringify(context) : '');
    }
  },
  auth: (message: string, context?: Record<string, any>) => {
    console.log(`[MCP-AUTH] ${new Date().toISOString()} ${message}`, context ? JSON.stringify(context) : '');
  },
  tool: (toolName: string, action: string, context?: Record<string, any>) => {
    console.log(`[MCP-TOOL] ${new Date().toISOString()} ${toolName}.${action}`, context ? JSON.stringify(context) : '');
  }
};

// Remove unused types - now using Zod schemas directly

// Initialize MCP server with only the tools we need
const server = new McpServer({
  name: "solo-unicorn-mcp",
  version: "1.0.0"
});

logger.info("MCP Server initialized", { name: "solo-unicorn-mcp", version: "1.0.0" });

// Small helper to enforce bearer auth from headers
function assertBearer(authHeader: string | string[] | undefined) {
  const expected = process.env.AGENT_AUTH_TOKEN || "default-agent-token";

  // Handle both string and string[] cases
  const headerValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  logger.debug("Authentication attempt", { hasAuthHeader: !!headerValue, startsWithBearer: headerValue?.startsWith("Bearer ") });

  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    logger.auth("Authentication failed: missing or invalid token format", { headerValue: headerValue?.substring(0, 20) + "..." });
    throw new Error("unauthorized: missing token");
  }
  const token = headerValue.slice(7);
  if (token !== expected) {
    logger.auth("Authentication failed: invalid token", { tokenLength: token.length });
    throw new Error("unauthorized: invalid token");
  }
  
  logger.auth("Authentication successful");
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
    logger.tool("agent.auth", "start", { clientType, repoPath });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);

      const repoAgent = await db.query.repoAgents.findFirst({
        where: and(
          eq(repoAgents.clientType, clientType),
          eq(repoAgents.repoPath, repoPath)
        )
      });

      if (!repoAgent) {
        logger.tool("agent.auth", "failed", { reason: "repo_agent_not_found", clientType, repoPath });
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

      logger.tool("agent.auth", "success", { 
        agentId: repoAgent.id, 
        clientType: repoAgent.clientType, 
        repoPath: repoAgent.repoPath,
        previousStatus: repoAgent.status
      });

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
    } catch (error) {
      logger.error("agent.auth failed", error, { clientType, repoPath });
      throw error;
    }
  }
);

server.tool(
  "task.start",
  "Start working on a specific task and set its stage. Updates task status and creates session.",
  {
    taskId: z.string().uuid(),
    stage: z.enum(["refine", "kickoff", "execute"])
  },
  async ({ taskId, stage }, { requestInfo }) => {
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    
    logger.tool("task.start", "start", { agentId, taskId, stage });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);
      
      if (!agentId) {
        logger.tool("task.start", "failed", { reason: "missing_agent_id", taskId, stage });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent ID header required" }) }]
        };
      }

      // Check if task exists and is available
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
        with: { project: true, repoAgent: true, actor: true }
      });

      if (!task) {
        logger.tool("task.start", "failed", { reason: "task_not_found", agentId, taskId });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "Task not found" }) }]
        };
      }

      if (task.repoAgentId !== agentId) {
        logger.tool("task.start", "failed", { reason: "wrong_agent", agentId, taskId, expectedAgent: task.repoAgentId });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "Task not assigned to this agent" }) }]
        };
      }

      // Check for existing active session
      const activeSession = await db.query.sessions.findFirst({
        where: and(eq(sessions.repoAgentId, agentId), eq(sessions.status, "active"))
      });

      if (activeSession && activeSession.taskId !== taskId) {
        logger.tool("task.start", "failed", { reason: "agent_busy", agentId, activeTaskId: activeSession.taskId, requestedTaskId: taskId });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent is busy with another task" }) }]
        };
      }

      // Create or update session
      let session;
      if (activeSession) {
        session = activeSession;
      } else {
        [session] = await db
          .insert(sessions)
          .values({ taskId, repoAgentId: agentId, status: "active" })
          .returning();
      }

      // Update task status and stage
      await db
        .update(tasks)
        .set({ status: "doing", stage, updatedAt: new Date() })
        .where(eq(tasks.id, taskId));

      // Update agent status
      await db
        .update(repoAgents)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(repoAgents.id, agentId));

      logger.tool("task.start", "success", { agentId, taskId, stage, sessionId: session.id });

      // Notify orchestrator
      if (orchestrator) {
        orchestrator.onTaskStarted(agentId, taskId, session.id);
      }

      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            success: true, 
            task, 
            sessionId: session.id,
            stage,
            message: `Started ${stage} stage for task: ${task.refinedTitle || task.rawTitle}`
          }) 
        }]
      };
    } catch (error) {
      logger.error("task.start failed", error, { agentId, taskId, stage });
      throw error;
    }
  }
);

server.tool(
  "task.complete",
  "Complete current stage and optionally advance to next stage or mark task as done.",
  {
    taskId: z.string().uuid(),
    stageComplete: z.boolean(),
    nextStage: z.enum(["refine", "kickoff", "execute"]).optional(),
    markDone: z.boolean().optional()
  },
  async ({ taskId, stageComplete, nextStage, markDone }, { requestInfo }) => {
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    
    logger.tool("task.complete", "start", { agentId, taskId, stageComplete, nextStage, markDone });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);
      
      if (!agentId) {
        logger.tool("task.complete", "failed", { reason: "missing_agent_id", taskId });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent ID header required" }) }]
        };
      }

      // Verify session exists and agent owns the task
      const session = await db.query.sessions.findFirst({
        where: and(eq(sessions.taskId, taskId), eq(sessions.repoAgentId, agentId), eq(sessions.status, "active")),
        with: { task: true }
      });

      if (!session) {
        logger.tool("task.complete", "failed", { reason: "no_active_session", agentId, taskId });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "No active session found for this task" }) }]
        };
      }

      if (markDone) {
        // Mark task as done
        await db
          .update(tasks)
          .set({ status: "done", stage: null, updatedAt: new Date() })
          .where(eq(tasks.id, taskId));

        // Complete the session
        await db
          .update(sessions)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(sessions.id, session.id));

        // Set agent to idle
        await db
          .update(repoAgents)
          .set({ status: "idle", updatedAt: new Date() })
          .where(eq(repoAgents.id, agentId));

        logger.tool("task.complete", "task_done", { agentId, taskId, sessionId: session.id });

        // Notify orchestrator
        if (orchestrator) {
          orchestrator.onTaskCompleted(agentId, taskId, true);
        }

        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              success: true, 
              taskComplete: true,
              message: `Task ${taskId} marked as done`
            }) 
          }]
        };
      } else if (nextStage) {
        // Advance to next stage
        await db
          .update(tasks)
          .set({ stage: nextStage, updatedAt: new Date() })
          .where(eq(tasks.id, taskId));

        logger.tool("task.complete", "stage_advanced", { agentId, taskId, nextStage, sessionId: session.id });

        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              success: true, 
              stageAdvanced: true,
              nextStage,
              message: `Task ${taskId} advanced to ${nextStage} stage`
            }) 
          }]
        };
      } else {
        // Just complete current stage without advancing
        logger.tool("task.complete", "stage_completed", { agentId, taskId, sessionId: session.id });

        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              success: true, 
              stageComplete: true,
              message: `Current stage completed for task ${taskId}`
            }) 
          }]
        };
      }
    } catch (error) {
      logger.error("task.complete failed", error, { agentId, taskId });
      throw error;
    }
  }
);

server.tool(
  "agent.requestTask",
  "Request the highest-priority ready task for this agent. Requires x-agent-id header.",
  async ({ requestInfo }) => {
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    
    logger.tool("agent.requestTask", "start", { agentId });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);
      
      if (!agentId) {
        logger.tool("agent.requestTask", "failed", { reason: "missing_agent_id" });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent ID header required" }) }]
        };
      }

      const repoAgent = await db.query.repoAgents.findFirst({
        where: eq(repoAgents.id, agentId),
        with: { project: true }
      });
      if (!repoAgent) {
        logger.tool("agent.requestTask", "failed", { reason: "repo_agent_not_found", agentId });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "Repo agent not found" }) }]
        };
      }

      const activeSession = await db.query.sessions.findFirst({
        where: and(eq(sessions.repoAgentId, agentId), eq(sessions.status, "active"))
      });
      if (activeSession) {
        logger.tool("agent.requestTask", "failed", { reason: "active_session_exists", agentId, sessionId: activeSession.id });
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
        logger.tool("agent.requestTask", "no_tasks", { agentId, projectId: repoAgent.projectId });
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

      logger.tool("agent.requestTask", "success", { 
        agentId, 
        taskId: availableTask.id,
        taskTitle: availableTask.rawTitle,
        taskPriority: availableTask.priority,
        sessionId: session.id,
        projectId: repoAgent.projectId
      });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, task: availableTask, sessionId: session.id }) }]
      };
    } catch (error) {
      logger.error("agent.requestTask failed", error, { agentId });
      throw error;
    }
  }
);

server.tool(
  "agent.setAvailable", 
  "Mark agent as available and ready for new tasks. Clears any stale sessions.",
  async ({ requestInfo }) => {
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    
    logger.tool("agent.setAvailable", "start", { agentId });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);
      
      if (!agentId) {
        logger.tool("agent.setAvailable", "failed", { reason: "missing_agent_id" });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent ID header required" }) }]
        };
      }

      // Clear any stale active sessions for this agent
      const staleSessions = await db.query.sessions.findMany({
        where: and(eq(sessions.repoAgentId, agentId), eq(sessions.status, "active"))
      });

      if (staleSessions.length > 0) {
        await db
          .update(sessions)
          .set({ status: "completed", completedAt: new Date() })
          .where(and(eq(sessions.repoAgentId, agentId), eq(sessions.status, "active")));
        
        logger.tool("agent.setAvailable", "cleared_stale_sessions", { agentId, count: staleSessions.length });
      }

      // Update agent status to idle (available)
      await db
        .update(repoAgents)
        .set({ status: "idle", updatedAt: new Date() })
        .where(eq(repoAgents.id, agentId));

      logger.tool("agent.setAvailable", "success", { agentId });

      // Notify orchestrator
      if (orchestrator) {
        orchestrator.onAgentAvailable(agentId);
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, status: "available" }) }]
      };
    } catch (error) {
      logger.error("agent.setAvailable failed", error, { agentId });
      throw error;
    }
  }
);

server.tool(
  "agent.health",
  "Report runtime status for the agent. Requires x-agent-id header.",
  {
    status: z.enum(["available", "busy", "rate_limited", "error"])
  },
  async ({ status }, { requestInfo }) => {
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    
    logger.tool("agent.health", "start", { agentId, status });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);
      
      if (!agentId) {
        logger.tool("agent.health", "failed", { reason: "missing_agent_id", status });
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
      
      logger.tool("agent.health", "success", { agentId, previousStatus: status, newStatus: nextStatus });
      
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true, status }) }]
      };
    } catch (error) {
      logger.error("agent.health failed", error, { agentId, status });
      throw error;
    }
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
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    
    logger.tool("agent.rateLimit", "start", { agentId, sessionId, resolveAt });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);
      
      if (!agentId) {
        logger.tool("agent.rateLimit", "failed", { reason: "missing_agent_id", sessionId });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent ID header required" }) }]
        };
      }

      await db.update(repoAgents).set({ status: "rate_limited", updatedAt: new Date() }).where(eq(repoAgents.id, agentId));
      
      logger.tool("agent.rateLimit", "success", { agentId, sessionId, resolveAt });
      
      // Future: persist rate limit metadata
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true }) }]
      };
    } catch (error) {
      logger.error("agent.rateLimit failed", error, { agentId, sessionId });
      throw error;
    }
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
    const agentIdHeader = requestInfo?.headers?.["x-agent-id"];
    const agentId = Array.isArray(agentIdHeader) ? agentIdHeader[0] : agentIdHeader;
    
    logger.tool("agent.sessionComplete", "start", { agentId, sessionId, success, hasError: !!error });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);
      
      if (!agentId) {
        logger.tool("agent.sessionComplete", "failed", { reason: "missing_agent_id", sessionId });
        return {
          content: [{ type: "text", text: JSON.stringify({ success: false, message: "Agent ID header required" }) }]
        };
      }

      const session = await db.query.sessions.findFirst({
        where: and(eq(sessions.id, sessionId), eq(sessions.repoAgentId, agentId)),
        with: { task: true }
      });
      if (!session) {
        logger.tool("agent.sessionComplete", "failed", { reason: "session_not_found", agentId, sessionId });
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
        logger.tool("agent.sessionComplete", "task_completed", { taskId: session.task.id, sessionId });
      } else {
        await db
          .update(tasks)
          .set({ status: "todo", stage: null, ready: false, updatedAt: new Date() })
          .where(eq(tasks.id, session.task.id));
        logger.tool("agent.sessionComplete", "task_failed", { taskId: session.task.id, sessionId, error });
      }

      await db.update(repoAgents).set({ status: "idle", updatedAt: new Date() }).where(eq(repoAgents.id, agentId));
      
      logger.tool("agent.sessionComplete", "success", { agentId, sessionId, taskId: session.task.id, success });
      
      return {
        content: [{ type: "text", text: JSON.stringify({ success: true }) }]
      };
    } catch (dbError) {
      logger.error("agent.sessionComplete failed", dbError, { agentId, sessionId, success });
      throw dbError;
    }
  }
);

// Health tool for MCP server itself
// Context and task management tools
server.tool(
  "context.read",
  "Read project and task context for the current session.",
  {
    taskId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional()
  },
  async ({ taskId, projectId }, { requestInfo }) => {
    logger.tool("context.read", "start", { taskId, projectId });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);
      
      let result: any = {};

      if (taskId) {
        const task = await db.query.tasks.findFirst({
          where: eq(tasks.id, taskId),
          with: {
            project: true,
            repoAgent: true,
            actor: true
          }
        });

        if (task) {
          result.task = task;
          result.project = task.project;
          result.repoAgent = task.repoAgent;
          result.actor = task.actor;
          logger.tool("context.read", "task_found", { taskId, projectId: task.projectId });
        } else {
          logger.tool("context.read", "task_not_found", { taskId });
        }
      } else if (projectId) {
        const project = await db.query.projects.findFirst({
          where: eq(projects.id, projectId),
          with: {
            repoAgents: true,
            actors: true
          }
        });

        if (project) {
          result.project = project;
          logger.tool("context.read", "project_found", { projectId, repoAgentsCount: project.repoAgents.length });
        } else {
          logger.tool("context.read", "project_not_found", { projectId });
        }
      }

      logger.tool("context.read", "success", { taskId, projectId, hasResult: Object.keys(result).length > 0 });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result)
        }]
      };
    } catch (error) {
      logger.error("context.read failed", error, { taskId, projectId });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) })
        }]
      };
    }
  }
);

server.tool(
  "cards.update",
  "Update task fields during workflow stages.",
  {
    taskId: z.string().uuid(),
    updates: z.object({
      refinedTitle: z.string().optional(),
      refinedDescription: z.string().optional(),
      plan: z.any().optional(),
      status: z.enum(["todo", "doing", "done"]).optional(),
      stage: z.enum(["refine", "kickoff", "execute"]).optional(),
    })
  },
  async ({ taskId, updates }, { requestInfo }) => {
    logger.tool("cards.update", "start", { taskId, updates });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);
      
      await db
        .update(tasks)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(tasks.id, taskId));

      logger.tool("cards.update", "success", { taskId, updatedFields: Object.keys(updates) });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, taskId, updates })
        }]
      };
    } catch (error) {
      logger.error("cards.update failed", error, { taskId, updates });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) })
        }]
      };
    }
  }
);

server.tool(
  "memory.update",
  "Update project memory with learnings and context.",
  {
    projectId: z.string().uuid(),
    memory: z.string()
  },
  async ({ projectId, memory }, { requestInfo }) => {
    logger.tool("memory.update", "start", { projectId, memoryLength: memory.length });
    
    try {
      assertBearer(requestInfo?.headers?.authorization);
      
      await db
        .update(projects)
        .set({
          memory,
          updatedAt: new Date()
        })
        .where(eq(projects.id, projectId));

      logger.tool("memory.update", "success", { projectId, memoryLength: memory.length });
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: true, projectId })
        }]
      };
    } catch (error) {
      logger.error("memory.update failed", error, { projectId, memoryLength: memory.length });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) })
        }]
      };
    }
  }
);

// Health tool for MCP server itself
server.tool(
  "server.health",
  "Return MCP server status.",
  async () => {
    logger.tool("server.health", "check");
    return {
      content: [{ type: "text", text: JSON.stringify({ status: "ok", service: "Solo Unicorn MCP Server" }) }]
    };
  }
);

// Expose a function to register the HTTP transport handlers on a Hono app
export async function registerMcpHttp(app: any, basePath = "/mcp") {
  logger.info("Registering MCP HTTP transport", { basePath });
  
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => Math.random().toString(36).substring(2, 15)
  });

  // Connect the server to the transport
  await server.connect(transport);
  logger.info("MCP server connected to HTTP transport");

  // Streamable HTTP uses a single endpoint that handles all MCP messages
  app.all(basePath, async (c: any) => {
    const startTime = Date.now();
    const method = c.req.method;
    const url = c.req.url;
    
    logger.debug("MCP HTTP request received", { method, url });
    
    try {
      // Extract body for POST requests
      let body;
      if (c.req.method === 'POST') {
        body = await c.req.json();
        logger.debug("MCP request body", { 
          method: body?.method, 
          id: body?.id,
          hasParams: !!body?.params 
        });
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

      const duration = Date.now() - startTime;
      logger.debug("MCP HTTP request completed", { 
        method, 
        statusCode, 
        duration,
        responseSize: responseBody.length,
        mcpMethod: body?.method
      });

      return c.text(responseBody, statusCode, responseHeaders);
    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error("MCP HTTP request failed", err, { method, url, duration });
      return c.json({ error: "MCP server error" }, 500);
    }
  });
  
  logger.info("MCP HTTP transport registered successfully", { basePath });
}
