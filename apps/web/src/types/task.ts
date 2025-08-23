/**
 * Shared task type definitions
 * Aligned with backend database schema after list/mode terminology migration
 */

export interface Repository {
  id: string;
  name: string;
  repoPath: string;
  isDefault?: boolean | null;
  isAvailable?: boolean;
  activeTaskCount?: number;
  maxConcurrencyLimit?: number | null;
}

export interface Agent {
  id: string;
  name: string;
  agentType: 'CLAUDE_CODE' | 'CURSOR_CLI' | 'OPENCODE';
  isAvailable?: boolean;
  activeTaskCount?: number;
  maxConcurrencyLimit?: number | null;
}

export interface Actor {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean | null;
}

export interface TaskDependency {
  id: string;
  rawTitle: string;
  refinedTitle: string | null;
  list: 'todo' | 'doing' | 'done' | 'loop' | 'check';
  priority: number;
}

// For compatibility with some components that expect undefined instead of null
export interface AvailableTask {
  id: string;
  rawTitle: string;
  refinedTitle?: string | null;
  list: 'todo' | 'doing' | 'done' | 'loop' | 'check';
  priority: number;
}

export interface TaskIteration {
  id: string;
  taskId: string;
  iterationNumber: number;
  feedbackReason: string;
  rejectedAt: string | Date;
  rejectedBy: string;
}

export interface TaskV2 {
  id: string;
  projectId: string;
  rawTitle: string;
  rawDescription: string | null;
  refinedTitle: string | null;
  refinedDescription: string | null;
  list: 'todo' | 'doing' | 'done' | 'loop' | 'check';
  mode: 'clarify' | 'plan' | 'execute' | 'loop' | 'talk' | 'check' | null;
  priority: number;
  ready: boolean;
  plan?: any;
  attachments?: any[];
  createdAt: string | Date;
  updatedAt: string | Date;
  agentSessionStatus: 'INACTIVE' | 'PUSHING' | 'ACTIVE';

  // V2 specific fields
  mainRepositoryId: string;
  additionalRepositoryIds?: string[];
  assignedAgentIds?: string[];
  actorId: string | null;

  // Populated relationships
  mainRepository?: Repository | null;
  additionalRepositories?: Repository[];
  assignedAgents?: Agent[];
  actor?: Actor | null;
  activeSession?: any;
  dependencies?: TaskDependency[];
  iterations?: TaskIteration[];

  // Compatibility
  project?: any; // For backward compatibility with API responses
}

export interface DependencyData {
  dependencies: TaskDependency[];
  dependents: TaskDependency[];
}
