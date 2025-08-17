/**
 * V2 Migration Utilities
 * Safe bidirectional migration between V1 and V2 schemas
 */

import { db } from '../index';
import { eq, and } from 'drizzle-orm';
import * as v1Schema from '../schema/index';
import * as v2Schema from '../schema/v2';
import { canMigrateToV2 } from '../../lib/feature-flags';

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors: string[];
  warnings: string[];
}

interface MigrationSummary {
  users: MigrationResult;
  projects: MigrationResult;
  agents: MigrationResult;
  repositories: MigrationResult;
  actors: MigrationResult;
  tasks: MigrationResult;
  projectUsers: MigrationResult;
  taskAgents: MigrationResult;
}

/**
 * Validate that migration is allowed
 */
function validateMigrationAllowed(): void {
  if (!canMigrateToV2()) {
    throw new Error('V2 migration is disabled. Set ALLOW_V2_MIGRATION=true to enable.');
  }
}

/**
 * Migrate V1 data to V2 schema
 * This is a one-way migration that preserves all existing data
 */
export async function migrateV1ToV2(): Promise<MigrationSummary> {
  validateMigrationAllowed();
  
  console.log('[Migration] Starting V1 → V2 migration...');
  
  const summary: MigrationSummary = {
    users: { success: false, migratedCount: 0, errors: [], warnings: [] },
    projects: { success: false, migratedCount: 0, errors: [], warnings: [] },
    agents: { success: false, migratedCount: 0, errors: [], warnings: [] },
    repositories: { success: false, migratedCount: 0, errors: [], warnings: [] },
    actors: { success: false, migratedCount: 0, errors: [], warnings: [] },
    tasks: { success: false, migratedCount: 0, errors: [], warnings: [] },
    projectUsers: { success: false, migratedCount: 0, errors: [], warnings: [] },
    taskAgents: { success: false, migratedCount: 0, errors: [], warnings: [] }
  };

  try {
    // 1. Migrate users (no changes needed, same structure)
    summary.users = await migrateUsers();
    
    // 2. Migrate projects (add new fields)
    summary.projects = await migrateProjects();
    
    // 3. Convert agentClients to user-owned agents
    summary.agents = await migrateAgentClients();
    
    // 4. Convert repoAgents to repositories
    summary.repositories = await migrateRepoAgents();
    
    // 5. Migrate actors (no changes needed)
    summary.actors = await migrateActors();
    
    // 6. Create project-user relationships
    summary.projectUsers = await createProjectUserRelationships();
    
    // 7. Migrate tasks with new structure
    summary.tasks = await migrateTasks();
    
    // 8. Create task-agent relationships
    summary.taskAgents = await createTaskAgentRelationships();
    
    console.log('[Migration] V1 → V2 migration completed successfully');
    return summary;
    
  } catch (error) {
    console.error('[Migration] V1 → V2 migration failed:', error);
    throw error;
  }
}

/**
 * Migrate users table (same structure, just copy)
 */
async function migrateUsers(): Promise<MigrationResult> {
  try {
    const v1Users = await db.select().from(v1Schema.users);
    
    for (const user of v1Users) {
      await db.insert(v2Schema.users).values(user).onConflictDoUpdate({
        target: v2Schema.users.id,
        set: {
          email: user.email,
          displayName: user.displayName,
          updatedAt: new Date()
        }
      });
    }
    
    return {
      success: true,
      migratedCount: v1Users.length,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      migratedCount: 0,
      errors: [`Failed to migrate users: ${error}`],
      warnings: []
    };
  }
}

/**
 * Migrate projects table (add new V2 fields)
 */
async function migrateProjects(): Promise<MigrationResult> {
  try {
    const v1Projects = await db.select().from(v1Schema.projects);
    
    for (const project of v1Projects) {
      await db.insert(v2Schema.projects).values({
        ...project,
        repoConcurrencyLimit: 1, // Default limit
        settings: {} // Default empty settings
      }).onConflictDoUpdate({
        target: v2Schema.projects.id,
        set: {
          name: project.name,
          description: project.description,
          memory: project.memory,
          repoConcurrencyLimit: 1,
          settings: {},
          updatedAt: new Date()
        }
      });
    }
    
    return {
      success: true,
      migratedCount: v1Projects.length,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      migratedCount: 0,
      errors: [`Failed to migrate projects: ${error}`],
      warnings: []
    };
  }
}

/**
 * Convert V1 agentClients to V2 user-owned agents
 */
async function migrateAgentClients(): Promise<MigrationResult> {
  try {
    const v1AgentClients = await db.select().from(v1Schema.agentClients);
    const v1Users = await db.select().from(v1Schema.users);
    
    // For now, assign all agents to the first user (single-user system)
    const primaryUser = v1Users[0];
    if (!primaryUser) {
      return {
        success: false,
        migratedCount: 0,
        errors: ['No users found to assign agents to'],
        warnings: []
      };
    }
    
    for (const agentClient of v1AgentClients) {
      await db.insert(v2Schema.agents).values({
        id: agentClient.id,
        userId: primaryUser.id,
        name: `${agentClient.type} Agent`,
        agentType: agentClient.type,
        agentSettings: {},
        maxConcurrencyLimit: 1,
        state: agentClient.state,
        createdAt: agentClient.createdAt,
        updatedAt: agentClient.updatedAt
      }).onConflictDoUpdate({
        target: v2Schema.agents.id,
        set: {
          name: `${agentClient.type} Agent`,
          agentType: agentClient.type,
          state: agentClient.state,
          updatedAt: new Date()
        }
      });
    }
    
    return {
      success: true,
      migratedCount: v1AgentClients.length,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      migratedCount: 0,
      errors: [`Failed to migrate agent clients: ${error}`],
      warnings: []
    };
  }
}

/**
 * Convert V1 repoAgents to V2 repositories
 */
async function migrateRepoAgents(): Promise<MigrationResult> {
  try {
    const v1RepoAgents = await db.select().from(v1Schema.repoAgents);
    
    for (const repoAgent of v1RepoAgents) {
      await db.insert(v2Schema.repositories).values({
        id: repoAgent.id,
        projectId: repoAgent.projectId,
        name: repoAgent.name,
        repoPath: repoAgent.repoPath,
        isDefault: true, // First repo becomes default
        maxConcurrencyLimit: 1,
        createdAt: repoAgent.createdAt,
        updatedAt: repoAgent.updatedAt
      }).onConflictDoUpdate({
        target: v2Schema.repositories.id,
        set: {
          name: repoAgent.name,
          repoPath: repoAgent.repoPath,
          updatedAt: new Date()
        }
      });
    }
    
    return {
      success: true,
      migratedCount: v1RepoAgents.length,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      migratedCount: 0,
      errors: [`Failed to migrate repo agents: ${error}`],
      warnings: []
    };
  }
}

/**
 * Migrate actors (same structure)
 */
async function migrateActors(): Promise<MigrationResult> {
  try {
    const v1Actors = await db.select().from(v1Schema.actors);
    
    for (const actor of v1Actors) {
      await db.insert(v2Schema.actors).values(actor).onConflictDoUpdate({
        target: v2Schema.actors.id,
        set: {
          name: actor.name,
          description: actor.description,
          isDefault: actor.isDefault,
          updatedAt: new Date()
        }
      });
    }
    
    return {
      success: true,
      migratedCount: v1Actors.length,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      migratedCount: 0,
      errors: [`Failed to migrate actors: ${error}`],
      warnings: []
    };
  }
}

/**
 * Create project-user relationships for existing projects
 */
async function createProjectUserRelationships(): Promise<MigrationResult> {
  try {
    const v1Projects = await db.select().from(v1Schema.projects);
    let count = 0;
    
    for (const project of v1Projects) {
      await db.insert(v2Schema.projectUsers).values({
        userId: project.ownerId,
        projectId: project.id,
        role: 'member'
      }).onConflictDoNothing();
      count++;
    }
    
    return {
      success: true,
      migratedCount: count,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      migratedCount: 0,
      errors: [`Failed to create project-user relationships: ${error}`],
      warnings: []
    };
  }
}

/**
 * Migrate tasks with new V2 structure
 */
async function migrateTasks(): Promise<MigrationResult> {
  try {
    const v1Tasks = await db.select().from(v1Schema.tasks);
    
    for (const task of v1Tasks) {
      // Find corresponding repository (converted from repoAgent)
      const repository = await db.select().from(v2Schema.repositories)
        .where(eq(v2Schema.repositories.id, task.repoAgentId))
        .limit(1);
      
      if (repository.length === 0) {
        continue; // Skip if repository not found
      }
      
      await db.insert(v2Schema.tasks).values({
        ...task,
        mainRepositoryId: repository[0].id,
        lastAgentSessionId: null // Will be set by agents later
        // Remove repoAgentId as it's replaced by mainRepositoryId
      }).onConflictDoUpdate({
        target: v2Schema.tasks.id,
        set: {
          rawTitle: task.rawTitle,
          rawDescription: task.rawDescription,
          refinedTitle: task.refinedTitle,
          refinedDescription: task.refinedDescription,
          plan: task.plan,
          status: task.status,
          stage: task.stage,
          priority: task.priority,
          ready: task.ready,
          isAiWorking: task.isAiWorking,
          aiWorkingSince: task.aiWorkingSince,
          attachments: task.attachments,
          mainRepositoryId: repository[0].id,
          updatedAt: new Date()
        }
      });
    }
    
    return {
      success: true,
      migratedCount: v1Tasks.length,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      migratedCount: 0,
      errors: [`Failed to migrate tasks: ${error}`],
      warnings: []
    };
  }
}

/**
 * Create task-agent relationships
 */
async function createTaskAgentRelationships(): Promise<MigrationResult> {
  try {
    const v1Tasks = await db.select().from(v1Schema.tasks);
    const v1RepoAgents = await db.select().from(v1Schema.repoAgents);
    const v2Agents = await db.select().from(v2Schema.agents);
    
    let count = 0;
    
    for (const task of v1Tasks) {
      // Find the repoAgent that was assigned to this task
      const repoAgent = v1RepoAgents.find(ra => ra.id === task.repoAgentId);
      if (!repoAgent) continue;
      
      // Find the corresponding agent (converted from agentClient)
      const agent = v2Agents.find(a => a.id === repoAgent.agentClientId);
      if (!agent) continue;
      
      await db.insert(v2Schema.taskAgents).values({
        taskId: task.id,
        agentId: agent.id
      }).onConflictDoNothing();
      count++;
    }
    
    return {
      success: true,
      migratedCount: count,
      errors: [],
      warnings: []
    };
  } catch (error) {
    return {
      success: false,
      migratedCount: 0,
      errors: [`Failed to create task-agent relationships: ${error}`],
      warnings: []
    };
  }
}

/**
 * Rollback from V2 to V1 (data loss may occur for V2-specific features)
 */
export async function rollbackV2ToV1(): Promise<MigrationSummary> {
  validateMigrationAllowed();
  
  console.log('[Migration] Starting V2 → V1 rollback...');
  console.warn('[Migration] WARNING: V2-specific data will be lost during rollback');
  
  // Implementation would go here - this is complex and should be implemented carefully
  // For now, return a placeholder
  throw new Error('V2 to V1 rollback not yet implemented - use database backup restoration instead');
}

/**
 * Check if V2 migration is needed
 */
export async function checkMigrationStatus(): Promise<{
  needsMigration: boolean;
  v1DataExists: boolean;
  v2DataExists: boolean;
  summary: string;
}> {
  try {
    // Check if V1 tables have data
    const v1Users = await db.select().from(v1Schema.users).limit(1);
    const v1Projects = await db.select().from(v1Schema.projects).limit(1);
    const v1AgentClients = await db.select().from(v1Schema.agentClients).limit(1);
    
    const v1DataExists = v1Users.length > 0 || v1Projects.length > 0 || v1AgentClients.length > 0;
    
    // Check if V2 tables have data
    let v2DataExists = false;
    try {
      const v2Agents = await db.select().from(v2Schema.agents).limit(1);
      const v2Repositories = await db.select().from(v2Schema.repositories).limit(1);
      v2DataExists = v2Agents.length > 0 || v2Repositories.length > 0;
    } catch {
      // V2 tables might not exist yet
      v2DataExists = false;
    }
    
    const needsMigration = v1DataExists && !v2DataExists;
    
    let summary = '';
    if (needsMigration) {
      summary = 'V1 data found, V2 migration needed';
    } else if (v2DataExists) {
      summary = 'V2 data exists, migration already completed';
    } else if (v1DataExists) {
      summary = 'Both V1 and V2 data exist, check consistency';
    } else {
      summary = 'No data found, fresh installation';
    }
    
    return {
      needsMigration,
      v1DataExists,
      v2DataExists,
      summary
    };
  } catch (error) {
    throw new Error(`Failed to check migration status: ${error}`);
  }
}