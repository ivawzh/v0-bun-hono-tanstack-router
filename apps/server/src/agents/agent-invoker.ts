/**
 * Direct Claude Code process spawning
 */

import { spawn } from "child_process";
import crossSpawn from "cross-spawn";
import { generatePrompt, type TaskMode } from "./prompts";
import {
  registerActiveSession,
  registerCompletedSession,
} from "./session-registry";
import { db } from "../db";
import { eq } from "drizzle-orm";
import * as schema from "../db/schema/index";
import { broadcastFlush, broadcastAgentRateLimit } from "../websocket/websocket-server";
import {
  getAttachmentFile,
  type AttachmentMetadata,
} from "@/utils/file-storage";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  type Options,
  type PermissionMode,
} from "@anthropic-ai/claude-code";
import { executeClaudeQuery, type ClaudeQueryOptions } from "./claude-code/claude-sdk-query";

// Use cross-spawn on Windows for better command execution
const spawnFunction = process.platform === "win32" ? crossSpawn : spawn;

export interface SpawnOptions {
  sessionId?: string | null;
  taskId: string;
  agentId: string;
  projectId: string;
  repositoryPath: string;
  additionalRepositories?: schema.Repository[];
  claudeConfigDir?: string;
  mode: TaskMode;
  model?: string;
  permissionMode?: PermissionMode;
  taskData: {
    task: schema.Task;
    actor?: schema.Actor | null;
    project: schema.Project;
    agent: schema.Agent;
  };
}

/**
 * Spawn Claude Code process for a task
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
      mode,
      taskData,
    } = options;
    const { task } = taskData;

    // Generate the appropriate prompt for the task mode
    const attachments = (task.attachments as AttachmentMetadata[]) || [];

    const modePrompt = generatePrompt(mode, taskData);

    if (!modePrompt || !modePrompt.trim()) {
      return {
        success: false,
        error: `No prompt generated. Mode: ${mode}, Task ID: ${taskId}. Task title: ${taskData.task.rawTitle || taskData.task.refinedTitle}.`,
      };
    }

    const imagesPrompt = await processTaskImagesPrompt(
      task.id,
      attachments,
      repositoryPath
    );
    const prompt = modePrompt + (imagesPrompt ? `\n\n${imagesPrompt}` : "");

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

    // Check if we should use child process for hot reload safety
    if (process.env.HOT_RELOAD === 'true') {
      console.log(`🔄 Hot reload mode detected - use agent in child process to prevent aboration from bun server hot reload.`);

      // Use SDK in child process for hot reload safety
      await spawnClaudeSdkChildProcess({
        prompt,
        sessionId: sessionId || undefined,
        env,
        repositoryPath,
        model: options.model,
        permissionMode: options.permissionMode,
        taskId,
        agentId,
        projectId,
        claudeConfigDir,
        mcpServers,
        allowedTools: defaultToolsSettings.allowedTools,
        disallowedTools: defaultToolsSettings.disallowedTools,
      });

      return { success: true };
    }

    // Use Claude Code SDK with streaming JSON (normal mode)
    try {
      console.log(`🚀 Starting Claude Code session for task ${taskId}. [${task.mode}] ${taskData.task.rawTitle || taskData.task.refinedTitle}`);

      await executeClaudeQuery({
        prompt,
        sessionId: sessionId || undefined,
        allowedTools: defaultToolsSettings.allowedTools,
        disallowedTools: defaultToolsSettings.disallowedTools,
        permissionMode: options.permissionMode || "bypassPermissions",
        model: options.model || "sonnet",
        mcpServers,
        repositoryPath,
        env,
        taskId,
        agentId,
        projectId,
        claudeConfigDir,

        onSessionStart: async (data) => {
          broadcastFlush(data.projectId);
        },

        onSessionStop: async (data) => {
          broadcastFlush(data.projectId);
        },

        onRateLimit: async (message, agentId) => {
          await detectAndHandleRateLimit(message, agentId);
        },

        onError: (error, taskId) => {
          console.error(`[Claude Code] Task ${taskId} error:`, error);
        }
      });
    } catch (error) {
      console.error(`[Claude Code] error for task ${taskId}:`, error);

      // Handle rate limit detection in error messages
      if (error instanceof Error) {
        await detectAndHandleRateLimit(error.message, agentId);
      }

      throw error;
    }

    // // Use Claude Code CLI as a child process (deprecated)
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
    console.error("[Claude Code] Failed to spawn Claude Code session:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown spawn error",
    };
  }
}

/**
 * Save rate limit message to local file for analysis
 */
async function saveRateLimitMessage(message: string): Promise<void> {
  try {
    const rateLimitDir = path.join(os.homedir(), '.solo-unicorn');
    const rateLimitFile = path.join(rateLimitDir, 'rate-limit-messages.json');

    // Ensure directory exists
    try {
      await fs.promises.access(rateLimitDir);
    } catch {
      await fs.promises.mkdir(rateLimitDir, { recursive: true });
    }

    // Read existing messages or create empty set
    let messages: string[] = [];
    try {
      await fs.promises.access(rateLimitFile);
      const fileContent = await fs.promises.readFile(rateLimitFile, 'utf8');
      messages = JSON.parse(fileContent);
      if (!Array.isArray(messages)) {
        messages = [];
      }
    } catch (error) {
      // File doesn't exist or is invalid, start with empty array
      messages = [];
    }

    // Add message if not already present (maintain uniqueness)
    if (!messages.includes(message)) {
      messages.push(message);
      messages.sort(); // Keep messages sorted for easier analysis

      // Write back to file
      await fs.promises.writeFile(rateLimitFile, JSON.stringify(messages, null, 2), 'utf8');
      console.log(`[Claude Code] 📝 Saved rate limit message: "${message}"`);
    }
  } catch (error) {
    console.error("[Claude Code] Failed to save rate limit message:", error);
  }
}

/**
 * Extract rate limit message text for analysis
 */
function extractRateLimitMessage(text: string): string | null {
  try {
    if (typeof text !== "string") return null;

    // Generic fallback for any "limit reached" message
    const genericMatch = text.match(/([^.]*limit reached[^.]*)/i);
    if (genericMatch) {
      return genericMatch[1].trim();
    }

    return null;
  } catch (error) {
    console.error("[Claude Code] Error extracting rate limit message:", error);
    return null;
  }
}

/**
 * Extract rate limit reset time from Claude AI usage limit message
 */
function extractRateLimitResetTime(text: string): string | null {
  try {
    if (typeof text !== "string") return null;

    // Try old format first: "Claude AI usage limit reached|{timestamp}"
    const oldMatch = text.match(/Claude AI usage limit reached\|(\d{10,13})/);
    if (oldMatch) {
      let timestampMs = parseInt(oldMatch[1], 10);
      if (!Number.isFinite(timestampMs)) return null;
      if (timestampMs < 1e12) timestampMs *= 1000; // seconds → ms

      const reset = new Date(timestampMs);
      return reset.toISOString();
    }

    // Try new format: "X-hour limit reached ∙ resets Yam/pm"
    const newMatch = text.match(/limit reached.*?resets\s*(\d{1,2})([ap]m)/i);
    if (!newMatch) return null;

    const hour = parseInt(newMatch[1], 10);
    const ampm = newMatch[2].toLowerCase();

    if (hour < 1 || hour > 12) return null;

    // Convert to 24-hour format
    let hour24 = hour;
    if (ampm === 'pm' && hour !== 12) {
      hour24 += 12;
    } else if (ampm === 'am' && hour === 12) {
      hour24 = 0;
    }

    // Create date for today with the specified time
    const now = new Date();
    const resetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour24, 0, 0, 0);

    // If the time has already passed today, assume it's tomorrow
    let resetDate = resetToday;
    if (resetToday <= now) {
      resetDate = new Date(resetToday.getTime() + 24 * 60 * 60 * 1000);
    }

    return resetDate.toISOString();
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
  const rateLimitCauseMessage = extractRateLimitMessage(line);

  if (rateLimitResetTime) {
    console.log("[Claude Code] 🚫 Claude rate limit detected, updating agent");
    try {
      // Update agent with rate limit info
      const [updatedAgent] = await db
        .update(schema.agents)
        .set({
          rateLimitResetAt: new Date(rateLimitResetTime),
          updatedAt: new Date(),
        })
        .where(eq(schema.agents.id, agentId))
        .returning();

      // Get project ID for broadcasting
      if (updatedAgent) {
        // Broadcast specific agent rate limit update to all project clients
        broadcastAgentRateLimit(updatedAgent.projectId, agentId, new Date(rateLimitResetTime));
        console.log("[Claude Code] 📡 Broadcasted agent rate limit update");
      }
    } catch (error) {
      console.error("[Claude Code] Failed to update agent rate limit:", error);
    }
  }

  // Save rate limit message for analysis (even if reset time extraction failed)
  if (rateLimitCauseMessage) {
    await saveRateLimitMessage(rateLimitCauseMessage);
  }
}

/**
 * Update task session state when session ID is captured
 */
export async function updateTaskSessionStarted(
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
  await fs.promises.mkdir(tempDir, { recursive: true });
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
      await fs.promises.writeFile(filepath, Buffer.from(base64Data, "base64"));
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

type SpawnClaudeSdkChildProcessArgs = {
  prompt: string;
  sessionId?: string;
  env: Record<string, string>;
  repositoryPath: string;
  model?: string;
  permissionMode?: PermissionMode;
  taskId: string;
  agentId: string;
  projectId: string;
  claudeConfigDir?: string;
  mcpServers: Options["mcpServers"];
  allowedTools: string[];
  disallowedTools: string[];
};

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

/**
 * Spawn Claude Code SDK session in a child process for hot reload safety
 */
async function spawnClaudeSdkChildProcess(args: SpawnClaudeSdkChildProcessArgs): Promise<void> {
  // Use the standalone worker file
  const workerFile = path.join(__dirname, 'claude-code/claude-sdk-in-child-process.ts');

  // Spawn child process with Bun
  const childProcess = spawn('bun', [workerFile, JSON.stringify(args)], {
    cwd: args.repositoryPath,
    env: args.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: true, // Survives parent process termination
  });

  // Handle communication from worker
  childProcess.stdout?.on('data', async (data) => {
    const output = data.toString();
    const lines = output.split('\n').filter((line: string) => line.trim());

    for (const line of lines) {
      try {
        const message = JSON.parse(line);

      } catch (parseError) {
        // Not JSON, just log as regular output
        console.log('[Claude SDK Worker]', line);
      }
    }
  });

  childProcess.stderr?.on('data', async (data) => {
    const errorMessage = data.toString();
    console.error(`[Claude SDK Worker] stderr [${args.taskId}]:`, errorMessage);

    // Check for rate limit in stderr
    await detectAndHandleRateLimit(errorMessage, args.agentId);
  });

  childProcess.on('close', async (code) => {
    console.log(`[Claude SDK Worker] Process child process exited with code ${code}. Task ID: ${args.taskId}`);
  });

  childProcess.on('error', (error) => {
    console.error(`[Claude SDK Worker] Spawn error for task ${args.taskId}:`, error);
  });

  // Allow process to run detached
  childProcess.unref();

  console.log(`🔄 [Claude SDK Worker] Spawned Claude SDK session for task ${args.taskId}`);
}
