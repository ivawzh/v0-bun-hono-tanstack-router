/**
 * Prompt System for Agent Tasks
 * Centralized prompt generation for different task stages
 */

import { generateRefinePrompt } from './refine';
import { generatePlanPrompt } from './plan';
import { generateExecutePrompt } from './execute';
import { generateLoopPrompt } from './loop';

export interface TaskContext {
  id: string;
  projectId: string;
  rawTitle: string;
  rawDescription?: string;
  refinedTitle?: string;
  refinedDescription?: string;
  plan?: any;
  priority: string;
  attachments?: any[];
  actorDescription?: string;
  projectMemory?: string;
  repoPath: string;
}

export type TaskStage = 'refine' | 'plan' | 'execute' | 'loop';

/**
 * Generate prompt for any stage of task execution
 */
export function generatePrompt(stage: TaskStage, context: TaskContext): string {
  switch (stage) {
    case 'refine':
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
