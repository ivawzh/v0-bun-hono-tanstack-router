/**
 * Prompt System for Agent Tasks
 * Centralized prompt generation for different task stages
 */

import { generateRefinePrompt } from './clarify';
import { generatePlanPrompt } from './plan';
import { generateExecutePrompt } from './execute';
import { generateLoopPrompt } from './loop';
import { generateTalkPrompt } from './talk';
import { type Actor, type Project, type Task } from '../../db/schema';

export type PromptParams = {
  task: Task;
  actor?: Actor | null;
  project: Project;
}

export type TaskMode = 'clarify' | 'plan' | 'execute' | 'loop' | 'talk';

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
