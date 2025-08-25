/**
 * Prompt System for Agent Tasks
 * Centralized prompt generation for different task modes
 */

import { generateRefinePrompt } from './clarify';
import { generatePlanPrompt } from './plan';
import { generateExecutePrompt } from './execute';
import { generateLoopPrompt } from './loop';
import { generateTalkPrompt } from './talk';
import { type Actor, type Agent, type Project, type Task, type TaskIteration, type TaskMode } from '../../db/schema';

export type { TaskMode } from '../../db/schema';

export type PromptParams = {
  task: Task;
  actor?: Actor | null;
  project: Project;
  agent: Agent;
  webUrl: string;
  taskIterations: Array<TaskIteration>;
}

export type SplitPrompt = {
  systemPrompt: string;
  taskPrompt: string;
}

/**
 * Convert agent type enum to user-friendly display name
 */
export function getAgentTypeDisplayName(agentType: string): string {
  switch (agentType) {
    case 'CLAUDE_CODE':
      return 'Claude Code';
    case 'CURSOR_CLI':
      return 'Cursor CLI';
    case 'OPENCODE':
      return 'OpenCode';
    default:
      return agentType;
  }
}

/**
 * Generate prompt for any mode of task execution
 */
export function generatePrompt(mode: TaskMode, context: PromptParams): SplitPrompt {
  switch (mode) {
    case 'clarify':
      return generateRefinePrompt(context);
    case 'plan':
      return generatePlanPrompt(context);
    case 'execute':
      return generateExecutePrompt(context);
    case 'loop':
      return generateLoopPrompt(context);
    case 'talk':
      return generateTalkPrompt(context);
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}
