/**
 * Prompt System for Agent Tasks
 * Centralized prompt generation for different task stages
 */

import { generateRefinePrompt } from './clarify';
import { generatePlanPrompt } from './plan';
import { generateExecutePrompt } from './execute';
import { generateLoopPrompt } from './loop';
import { type Actor, type Project, type Task } from '../../db/schema';

export type PromptParams = {
  task: Task;
  actor?: Actor | null;
  project: Project;
}

export type TaskStage = 'clarify' | 'plan' | 'execute' | 'loop';

/**
 * Generate prompt for any stage of task execution
 */
export function generatePrompt(stage: TaskStage, context: PromptParams): string {
  switch (stage) {
    case 'clarify':
      return generateRefinePrompt(context);
    case 'plan':
      return generatePlanPrompt(context);
    case 'execute':
      return generateExecutePrompt(context);
    case 'loop':
      return generateLoopPrompt(context);
    default:
      throw new Error(`Unknown stage: ${stage}`);
  }
}

// Re-export individual prompt generators
export {
  generateRefinePrompt,
  generatePlanPrompt,
  generateExecutePrompt,
  generateLoopPrompt
};
