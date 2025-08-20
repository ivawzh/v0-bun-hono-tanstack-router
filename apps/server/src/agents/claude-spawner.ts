/**
 * Direct Claude CLI process spawning
 * Replaces Claude Code UI dependency
 */

import { spawn } from "child_process";
import crossSpawn from "cross-spawn";
import { generatePrompt, type TaskStage } from "./prompts";
import {
  registerActiveSession,
  registerCompletedSession,
} from "./session-registry";
import { db } from "../db";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/index";
import { broadcastFlush } from "../websocket/websocket-server";
import {
  getAttachmentFile,
  type AttachmentMetadata,
} from "@/utils/file-storage";
import path from "path";
import { promises as fs } from "fs";
import fsSync from "fs";
import os from "os";
import {
  query,
  type Options,
  type PermissionMode,
} from "@anthropic-ai/claude-code";
import { match, P } from "ts-pattern";

// Use cross-spawn on Windows for better command execution
const spawnFunction = process.platform === "win32" ? crossSpawn : spawn;

export interface SpawnOptions {
  sessionId?: string | null;
  taskId: string;
  agentId: string;
  projectId: string;
  repositoryPath: string;
  claudeConfigDir?: string;
  stage: TaskStage;
  model?: string;
  permissionMode?: PermissionMode;
  taskData: {
    task: schema.Task;
    actor?: schema.Actor | null;
    project: schema.Project;
  };
}

/**
 * Spawn Claude CLI process for a task
 */
export async function spawnClaudeSession(
  options: SpawnOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      sessionId,
      taskId,
      agentId,
      projectId,
      repositoryPath,
      claudeConfigDir,
      stage,
      taskData,
    } = options;
    const { task } = taskData;

    // Generate the appropriate prompt for the task stage
    const attachments = (task.attachments as AttachmentMetadata[]) || [];

    const stagePrompt = generatePrompt(stage, taskData);

    if (!stagePrompt || !stagePrompt.trim()) {
      return {
        success: false,
        error: `No prompt generated. Stage: ${stage}, Task ID: ${taskId}. Task title: ${taskData.task.rawTitle || taskData.task.refinedTitle}.`,
      };
    }

    const imagesPrompt = await processTaskImagesPrompt(
      task.id,
      attachments,
      repositoryPath
    );
    const prompt = stagePrompt + (imagesPrompt ? `\n\n${imagesPrompt}` : "");

    // Prepare environment variables
    const env = {
      ...process.env,
      // Add Claude config directory if specified
      ...(claudeConfigDir && { CLAUDE_CONFIG_DIR: claudeConfigDir }),
      // Session tracking
      ...(sessionId && { SESSION_ID: sessionId }),
      REPOSITORY_PATH: repositoryPath,
      SOLO_UNICORN_PROJECT_ID: projectId,
      SOLO_UNICORN_AGENT_ID: agentId,
      SOLO_UNICORN_TASK_ID: taskId,
    };

    const mcpServers = {
      "solo-unicorn": {
        type: "http",
        url: "http://localhost:8500/mcp",
        headers: {
          Authorization: `Bearer ${process.env.CLAUDE_CODE_UI_AUTH_TOKEN}`,
          Accept: "application/json, text/event-stream",
        },
      },
    } satisfies Options["mcpServers"];

    const defaultToolsSettings = {
      allowedTools: [
        "Bash(git log:*)",
        "Bash(git diff:*)",
        "Bash(git status:*)",
        "Write",
        "Read",
        "Edit",
        "Glob",
        "Grep",
        "MultiEdit",
        "Task",
        "WebSearch",
        "WebFetch",
        "TodoRead",
        "TodoWrite",

        // Solo Unicorn MCP tools
        "mcp__solo-unicorn",
      ],
      disallowedTools: [],
      skipPermissions: true,
    };

    // Use Claude Code SDK with streaming JSON
    try {
      console.log(`🚀 Starting Claude Code session for task ${taskId}. [${task.stage}] ${taskData.task.rawTitle || taskData.task.refinedTitle}`);

      for await (const message of query({
        prompt,
        options: {
          resume: sessionId || undefined,
          allowedTools: defaultToolsSettings.allowedTools,
          disallowedTools: defaultToolsSettings.disallowedTools,
          permissionMode: options.permissionMode || "bypassPermissions",
          model: options.model || "sonnet",
          mcpServers,
          cwd: repositoryPath,
          env,
          hooks: {
            SessionStart: [
              {
                hooks: [
                  async (input, toolUseID, options) => {
                    console.log(
                      "SessionStart hook called. ",
                      task.stage,
                      task.rawTitle || task.refinedTitle,
                    );

                    await Promise.all([
                      // Update task with captured session ID and ACTIVE status
                      await updateTaskSessionStarted(
                        taskId,
                        agentId,
                        input.session_id,
                        projectId
                      ),

                      // Register session in file-based registry
                      await registerActiveSession({
                        sessionId: input.session_id,
                        taskId,
                        agentId,
                        projectId,
                        repositoryPath,
                        startedAt: new Date().toISOString(),
                        claudeConfigDir,
                      }),
                    ]);

                    return { continue: true };
                  },
                ],
              },
            ],
            Stop: [
              {
                hooks: [
                  async (input, toolUseID, options) => {
                    console.log("[Claude Code] Stop hook called. ", task.stage, task.rawTitle || task.refinedTitle);
                    await Promise.all([
                      // Update task status to NON_ACTIVE when process completes
                      await updateTaskSessionCompleted(taskId, projectId, 0),

                      // Register session in file-based registry
                      await registerCompletedSession({
                        sessionId: input.session_id,
                        taskId,
                        agentId,
                        projectId,
                        repositoryPath,
                        startedAt: new Date().toISOString(),
                        claudeConfigDir,
                      }),
                    ]);
                    return { continue: true };
                  },
                ],
              },
            ],
          },
        },
      })) {
        try {
          match(message)
          .with({ type: "result", result: P.string }, (msg) => {
            detectAndHandleRateLimit(msg.result, agentId);
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
      console.error(`[Claude Code] error for task ${taskId}:`, error);

      // Handle rate limit detection in error messages
      if (error instanceof Error) {
        await detectAndHandleRateLimit(error.message, agentId);
      }

      throw error;
    }

    // // Use Claude Code CLI as a child process
    // spawnClaudeChildProcess({
    //   prompt,
    //   sessionId: sessionId || undefined,
    //   mcpConfig: mcpConfig,
    //   env,
    //   repositoryPath,
    //   model: options.model,
    //   permissionMode: options.permissionMode,
    //   taskId,
    //   agentId,
    //   projectId,
    //   claudeConfigDir,
    // });

    return { success: true };
  } catch (error) {
    console.error("[Claude Code] Failed to spawn Claude CLI session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown spawn error",
    };
  }
}

/**
 * Extract rate limit reset time from Claude AI usage limit message
 */
function extractRateLimitResetTime(text: string): string | null {
  try {
    if (typeof text !== "string") return null;

    const match = text.match(/Claude AI usage limit reached\|(\d{10,13})/);
    if (!match) return null;

    let timestampMs = parseInt(match[1], 10);
    if (!Number.isFinite(timestampMs)) return null;
    if (timestampMs < 1e12) timestampMs *= 1000; // seconds → ms

    const reset = new Date(timestampMs);
    return reset.toISOString();
  } catch (error) {
    console.error("[Claude Code] Error extracting rate limit reset time:", error);
    return null;
  }
}

/**
 * Handle rate limit detection and agent update
 */
async function detectAndHandleRateLimit(line: string, agentId: string): Promise<void> {
  const rateLimitResetTime = extractRateLimitResetTime(line);
  if (rateLimitResetTime) {
    console.log("[Claude Code] 🚫 Claude rate limit detected, updating agent");
    try {
      await db
        .update(schema.agents)
        .set({
          rateLimitResetAt: new Date(rateLimitResetTime),
          updatedAt: new Date(),
        })
        .where(eq(schema.agents.id, agentId));
    } catch (error) {
      console.error("[Claude Code] Failed to update agent rate limit:", error);
    }
  }
}

/**
 * Update task session state when session ID is captured
 */
async function updateTaskSessionStarted(
  taskId: string,
  agentId: string,
  sessionId: string,
  projectId: string
): Promise<void> {
  try {
    await db
      .update(schema.tasks)
      .set({
        lastAgentSessionId: sessionId,
        agentSessionStatus: "ACTIVE",
        activeAgentId: agentId,
        lastAgentSessionStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, taskId));

    // Broadcast to invalidate frontend queries
    broadcastFlush(projectId);
    console.log(`✅ Updated task ${taskId} with session ${sessionId}`);
  } catch (error) {
    console.error("[Claude Code] Failed to update task session state:", error);
  }
}

/**
 * Update task when session completes
 */
async function updateTaskSessionCompleted(
  taskId: string,
  projectId: string,
  exitCode: number
): Promise<void> {
  try {
    await db
      .update(schema.tasks)
      .set({
        agentSessionStatus: "NON_ACTIVE",
        activeAgentId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, taskId));

    // Broadcast to invalidate frontend queries
    broadcastFlush(projectId);
    console.log(
      `✅ Task ${taskId} session completed with exit code ${exitCode}`
    );
  } catch (error) {
    console.error("[Claude Code] Failed to update task completion state:", error);
  }
}

async function processTaskImagesPrompt(
  taskId: string,
  attachments: AttachmentMetadata[],
  mainRepoPath: string
): Promise<string | null> {
  // Filter for image attachments
  const imageAttachments = attachments.filter((attachment) =>
    attachment && attachment.type && attachment.type.startsWith("image/")
  );
  if (imageAttachments.length === 0) {
    return null;
  }
  const tempImagePaths = [];
  let tempDir = null;
  tempDir = path.join(mainRepoPath, ".tmp", "images", Date.now().toString());
  await fs.mkdir(tempDir, { recursive: true });
  for (const [index, attachment] of imageAttachments.entries()) {
    try {
      // Get the file buffer using the existing utility
      const buffer = await getAttachmentFile(
        taskId,
        attachment.id!,
        attachments
      );

      // Convert to base64
      const base64Data = buffer.toString("base64");

      const extension = attachment.type?.split("/")[1] || "png";
      const filename = `image_${index}.${extension}`;
      const filepath = path.join(tempDir, filename);
      // Write base64 data to file
      await fs.writeFile(filepath, Buffer.from(base64Data, "base64"));
      tempImagePaths.push(filepath);
    } catch (error) {
      console.error("[Claude Code] Failed to process image attachment", error, {
        taskId,
        attachmentId: attachment?.id,
        filename: attachment?.filename,
      });
      // Continue processing other images even if one fails
    }
  }

  if (tempImagePaths.length > 0) {
    return `[Images provided at the following paths:]\n${tempImagePaths.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;
  }

  return null;
}

function getMcpConfigPath() {
  let hasMcpServers = false;
  const claudeConfigPath = path.join(os.homedir(), ".claude.json");

  // Check Claude config for MCP servers
  if (fsSync.existsSync(claudeConfigPath)) {
    try {
      const claudeConfig = JSON.parse(
        fsSync.readFileSync(claudeConfigPath, "utf8")
      );

      // Check global MCP servers
      if (
        claudeConfig.mcpServers &&
        Object.keys(claudeConfig.mcpServers).length > 0
      ) {
        console.log(
          `✅ Found ${Object.keys(claudeConfig.mcpServers).length} global MCP servers`
        );
        hasMcpServers = true;
      }

      // Check project-specific MCP servers
      if (!hasMcpServers && claudeConfig.claudeProjects) {
        const currentProjectPath = process.cwd();
        const projectConfig = claudeConfig.claudeProjects[currentProjectPath];
        if (
          projectConfig &&
          projectConfig.mcpServers &&
          Object.keys(projectConfig.mcpServers).length > 0
        ) {
          console.log(
            `✅ Found ${Object.keys(projectConfig.mcpServers).length} project MCP servers`
          );
          hasMcpServers = true;
        }
      }
    } catch (e) {
      console.log(`❌ Failed to parse Claude config:`, e);
    }
  }

  console.log(`🔍 hasMcpServers result: ${hasMcpServers}`);

  if (hasMcpServers) {
    // Use Claude config file if it has MCP servers
    let configPath = undefined;

    if (fsSync.existsSync(claudeConfigPath)) {
      try {
        const claudeConfig = JSON.parse(
          fsSync.readFileSync(claudeConfigPath, "utf8")
        );

        // Check if we have any MCP servers (global or project-specific)
        const hasGlobalServers =
          claudeConfig.mcpServers &&
          Object.keys(claudeConfig.mcpServers).length > 0;
        const currentProjectPath = process.cwd();
        const projectConfig =
          claudeConfig.claudeProjects &&
          claudeConfig.claudeProjects[currentProjectPath];
        const hasProjectServers =
          projectConfig &&
          projectConfig.mcpServers &&
          Object.keys(projectConfig.mcpServers).length > 0;

        if (hasGlobalServers || hasProjectServers) {
          configPath = claudeConfigPath;
        }
      } catch (e) {
        // No valid config found
      }
    }

    if (configPath) {
      console.log(`📡 Adding MCP config: ${configPath}`);
    } else {
      console.log("[Claude Code] ⚠️ MCP servers detected but no valid config file found");
    }

    return configPath;
  }
}

type SpawnClaudeChildProcessArgs = {
  prompt: string;
  sessionId?: string;
  env: Record<string, string>;
  repositoryPath: string;
  model?: string;
  permissionMode?: string;
  taskId: string;
  agentId: string;
  projectId: string;
  claudeConfigDir?: string;
};
function spawnClaudeChildProcess(args: SpawnClaudeChildProcessArgs) {
  const mcpConfigPath = getMcpConfigPath();

  // Prepare Claude CLI command
  const claudeArgs: string[] = [
    "--print",
    args.prompt,
    "--output-format",
    "stream-json",
  ];

  // Add resume flag if resuming an existing session
  if (args.sessionId) {
    claudeArgs.push("--resume", args.sessionId);
  }

  if (args.model) {
    claudeArgs.push("--model", args.model || "sonnet");
  }

  if (mcpConfigPath) {
    claudeArgs.push("--mcp-config", mcpConfigPath);
  }

  if (args.permissionMode && args.permissionMode !== "default") {
    claudeArgs.push("--permission-mode", args.permissionMode);
  }

  // Spawn Claude CLI process
  const childProcess = spawnFunction("claude", claudeArgs, {
    cwd: args.repositoryPath,
    env: args.env,
    stdio: "pipe", // We'll handle I/O separately
    detached: true, // Allow process to run independently
  });

  // Send initial prompt to Claude
  childProcess.stdin?.write(args.prompt);
  childProcess.stdin?.end();

  // Set up error handling
  childProcess.on("error", (error) => {
    console.error(
      `Claude CLI spawn error for session ${args.sessionId}:`,
      error
    );
  });

  // Handle stdout (streaming JSON responses)
  childProcess.stdout?.on("data", async (data) => {
    const rawOutput = (data?.toString() as string) || "";

    const lines = rawOutput.split("\n").filter((line: string) => line.trim());

    for (const line of lines) {
      try {
        const response = JSON.parse(line);
        console.log("[Claude Code] 📄 Parsed JSON response:", response);

        // Capture session ID if it's in the response
        if (response.session_id && !args.sessionId) {
          args.sessionId = response.session_id;
          console.log("[Claude Code] 📝 Captured session ID:", args.sessionId);

          // Update task with captured session ID and ACTIVE status
          await updateTaskSessionStarted(
            args.taskId,
            args.agentId,
            response.session_id,
            args.projectId
          );

          // Register session in file-based registry
          await registerActiveSession({
            sessionId: response.session_id,
            taskId: args.taskId,
            agentId: args.agentId,
            projectId: args.projectId,
            repositoryPath: args.repositoryPath,
            startedAt: new Date().toISOString(),
            claudeConfigDir: args.claudeConfigDir,
          });
        }

        // Check for rate limit in JSON response
        await detectAndHandleRateLimit(line, args.agentId);
      } catch (parseError: any) {
        // If not JSON, check for rate limit in raw text
        await detectAndHandleRateLimit(line, args.agentId);
      }
    }
  });

  // Handle stderr
  childProcess.stderr?.on("data", async (data) => {
    const errorMessage = data.toString();
    console.error(`Claude CLI stderr [${args.sessionId}]:`, errorMessage);

    // Check for rate limit in stderr
    await detectAndHandleRateLimit(errorMessage, args.agentId);
  });

  // Handle process completion
  childProcess.on("close", async (code) => {
    console.log(
      `Claude CLI process [${args.sessionId}] exited with code ${code}`
    );

    await Promise.all([
      // Update task status to NON_ACTIVE when process completes
      await updateTaskSessionCompleted(args.taskId, args.projectId, code || 0),

      // Register session in file-based registry
      await registerCompletedSession({
        sessionId: args.sessionId!,
        taskId: args.taskId,
        agentId: args.agentId,
        projectId: args.projectId,
        repositoryPath: args.repositoryPath,
        startedAt: new Date().toISOString(),
        claudeConfigDir: args.claudeConfigDir,
      }),
    ]);
  });

  // Allow process to run detached
  childProcess.unref();

  console.log(
    `🚀 Spawned Claude CLI session ${args.sessionId} for task ${args.taskId}`
  );
}
