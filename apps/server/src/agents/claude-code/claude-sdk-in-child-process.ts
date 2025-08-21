#!/usr/bin/env bun
/**
 * Start Claude SDK Worker
 * This will be used by agent-invoker to spawn Claude Code session in a child process.
 * This is used only when current env is in dev hot-reload mode, i.e. ENV.HOT_RELOAD='true'.
 * Purpose of this is to avoid aboration from bun server hot reload.
 */
import { executeClaudeQuery, type ClaudeQueryOptions } from "./claude-sdk-query";

// Parse arguments from parent process
const args: ClaudeQueryOptions = JSON.parse(process.argv[2]);

async function runWorker() {
  // Set up communication callbacks to send messages back to parent
  const workerOptions: ClaudeQueryOptions = {
    ...args,

    onError: (error, taskId) => {
      // Send error back to parent
      console.log(JSON.stringify({
        type: 'error',
        error,
        taskId
      }));
      process.exit(1);
    }
  };

  try {
    await executeClaudeQuery(workerOptions);
  } catch (error) {
    console.error(`[SDK Worker] Fatal error for task ${args.taskId}:`, error);
    process.exit(1);
  }
}

runWorker();
