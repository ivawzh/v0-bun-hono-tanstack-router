/**
 * Prompt System for Agent Tasks
 * Centralized prompt generation for different task modes
 */

import { generateRefinePrompt } from './clarify';
import { generatePlanPrompt } from './plan';
import { generateExecutePrompt } from './execute';
import { generateLoopPrompt } from './loop';
import { generateTalkPrompt } from './talk';
import { type Actor, type Agent, type Project, type Task } from '../../db/schema';

export type PromptParams = {
  task: Task;
  actor?: Actor | null;
  project: Project;
  agent: Agent;
  webUrl: string;
}

export type TaskMode = 'clarify' | 'plan' | 'execute' | 'loop' | 'talk' | 'check';

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
export function generatePrompt(mode: TaskMode, context: PromptParams): string {
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
    case 'check':
      // For check mode, we'll reuse the execute prompt since check is essentially
      // a retry of execution after feedback
      return generateExecutePrompt(context);
    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}

// Re-export individual prompt generators
export {
  generateRefinePrompt,
  generatePlanPrompt,
  generateExecutePrompt,
  generateLoopPrompt,
  generateTalkPrompt
};
