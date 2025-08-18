/**
 * Prompt System for Agent Tasks
 * Centralized prompt generation for different task stages
 */

import { generateRefinePrompt } from './clarify';
import { generatePlanPrompt } from './plan';
import { generateExecutePrompt } from './execute';
import { generateLoopPrompt } from './loop';
import { actors, projects, tasks } from '../../db/schema';

export type Task = typeof tasks.$inferSelect;
export type PromptParams = {
  task: Task;
  actor: typeof actors.$inferSelect;
  project: typeof projects.$inferSelect;
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
