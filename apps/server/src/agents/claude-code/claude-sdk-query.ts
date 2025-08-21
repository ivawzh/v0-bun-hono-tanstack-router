/**
 * Shared Claude Code SDK query function
 */

import { query, type Options, type PermissionMode } from "@anthropic-ai/claude-code";
import { match, P } from "ts-pattern";
import { registerActiveSession, registerCompletedSession } from "../session-registry";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ClaudeQueryOptions {
  prompt: string;
  sessionId?: string;
  allowedTools: string[];
  disallowedTools: string[];
  permissionMode?: PermissionMode;
  model?: string;
  mcpServers: Options["mcpServers"];
  repositoryPath: string;
  env: Record<string, string>;
  taskId: string;
  agentId: string;
  projectId: string;
  claudeConfigDir?: string;
  onSessionStart?: (data: {
    sessionId: string;
    taskId: string;
    agentId: string;
    projectId: string;
    transcriptPath: string;
  }) => Promise<void>;
  onSessionStop?: (data: {
    sessionId: string;
    taskId: string;
    agentId: string;
    projectId: string;
  }) => Promise<void>;
  onRateLimit?: (message: string, agentId: string) => Promise<void>;
  onError?: (error: string, taskId: string) => void;
}

/**
 * Execute Claude Code SDK query with hooks and error handling
 */
export async function executeClaudeQuery(options: ClaudeQueryOptions): Promise<void> {
  try {
    console.log(`🚀 Starting Claude Code session for task ${options.taskId}`);

    for await (const message of query({
      prompt: options.prompt,
      options: {
        resume: options.sessionId || undefined,
        allowedTools: options.allowedTools,
        disallowedTools: options.disallowedTools,
        permissionMode: options.permissionMode || "bypassPermissions",
        model: options.model || "sonnet",
        mcpServers: options.mcpServers,
        cwd: options.repositoryPath,
        env: options.env,
        hooks: {
          SessionStart: [{
            matcher: '*',
            hooks: [
              async (input, toolUseID, hookOptions) => {
                console.log("[Claude Code] SessionStart hook called. Task:", options.taskId);
                console.log("[Claude Code] Path to conversation:", input.transcript_path);

                await Promise.all([
                  updateTaskSessionStarted({
                    sessionId: input.session_id,
                    taskId: options.taskId,
                    agentId: options.agentId,
                    projectId: options.projectId
                  }),

                  registerActiveSession({
                    sessionId: input.session_id,
                    taskId: options.taskId,
                    agentId: options.agentId,
                    projectId: options.projectId,
                    repositoryPath: options.repositoryPath,
                    recordedAt: new Date().toISOString(),
                    claudeConfigDir: options.claudeConfigDir,
                  }),
                ]);

                if (options.onSessionStart) {
                  await options.onSessionStart({
                    sessionId: input.session_id,
                    taskId: options.taskId,
                    agentId: options.agentId,
                    projectId: options.projectId,
                    transcriptPath: input.transcript_path,
                  });
                }

                return { continue: true };
              }
            ]
          }],
          Stop: [{
            matcher: '*',
            hooks: [
              async (input, toolUseID, hookOptions) => {
                console.log("[Claude Code] Stop hook called. Task:", options.taskId);

                await Promise.all([
                  updateTaskSessionCompleted(options.taskId),
                  registerCompletedSession({
                    sessionId: input.session_id,
                    taskId: options.taskId,
                    agentId: options.agentId,
                    projectId: options.projectId,
                    repositoryPath: options.repositoryPath,
                    recordedAt: new Date().toISOString(),
                    claudeConfigDir: options.claudeConfigDir,
                  }),
                ]);

                if (options.onSessionStop) {
                  await options.onSessionStop({
                    sessionId: input.session_id,
                    taskId: options.taskId,
                    agentId: options.agentId,
                    projectId: options.projectId,
                  });
                }

                return { continue: true };
              }
            ]
          }]
        }
      }
    })) {
      try {
        match(message)
        .with({ type: "result", subtype: "success", is_error: true, result: P.string }, (msg) => {
          console.log(`[Claude Code] ⏰ Agent ${options.agentId} is rate limited:`, msg.result);
          if (options.onRateLimit) {
            options.onRateLimit(msg.result, options.agentId);
          }
        })
        .with({ permission_denials: P.select() }, (denials) => {
          if (denials.length > 0) {
            console.error("[Claude Code] Permission denials:", denials);
          }
        })
        .otherwise(() => {})
      } catch (parseError) {
        console.error("[Claude Code] Error processing SDK message:", parseError);
      }
    }
  } catch (error) {
    console.error(`[Claude Code] error for task ${options.taskId}:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (options.onRateLimit && errorMessage.includes('limit')) {
      await options.onRateLimit(errorMessage, options.agentId);
    }

    if (options.onError) {
      options.onError(errorMessage, options.taskId);
    }

    throw error;
  }
}

/**
 * Update task session state when session ID is captured
 */
async function updateTaskSessionStarted(args: {
  taskId: string,
  agentId: string,
  sessionId: string,
  projectId: string
}): Promise<void> {
  try {
    await db
      .update(schema.tasks)
      .set({
        lastAgentSessionId: args.sessionId,
        agentSessionStatus: "ACTIVE",
        activeAgentId: args.agentId,
        lastAgentSessionStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, args.taskId));

    console.log(`✅ Updated task ${args.taskId} with session ${args.sessionId}`);
  } catch (error) {
    console.error("[Claude Code] Failed to update task session state:", error);
  }
}

/**
 * Update task when session completes
 */
async function updateTaskSessionCompleted(
  taskId: string,
): Promise<void> {
  try {
    await db
      .update(schema.tasks)
      .set({
        agentSessionStatus: "INACTIVE",
        activeAgentId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, taskId));

    console.log(
      `✅ Task ${taskId} session completed`
    );
  } catch (error) {
    console.error("[Claude Code] Failed to update task completion state:", error);
  }
}
