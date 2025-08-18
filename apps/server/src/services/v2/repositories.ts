/**
 * V2 Repositories Service
 * CRUD operations for project repositories
 */

import { db } from '../../db';
import { eq, and } from 'drizzle-orm';
import * as v1Schema from '../../db/schema/index';
import * as v2Schema from '../../db/schema/v2';
import { useV2Schema } from '../../lib/feature-flags';

interface CreateRepositoryInput {
  projectId: string;
  name: string;
  repoPath: string;
  isDefault?: boolean;
  maxConcurrencyLimit?: number;
}

interface UpdateRepositoryInput {
  name?: string;
  repoPath?: string;
  isDefault?: boolean;
  maxConcurrencyLimit?: number;
}

/**
 * Create a new repository
 */
export async function createRepository(input: CreateRepositoryInput) {
  if (!useV2Schema()) {
    // V1 behavior: create as repoAgent (requires agentClient)
    throw new Error('Creating repositories requires V2 schema. Use repo agents in V1.');
  }

  // If setting as default, remove default from other repos
  if (input.isDefault) {
    await db.update(v2Schema.repositories)
      .set({ isDefault: false })
      .where(eq(v2Schema.repositories.projectId, input.projectId));
  }

  const repository = await db.insert(v2Schema.repositories).values({
    projectId: input.projectId,
    name: input.name,
    repoPath: input.repoPath,
    isDefault: input.isDefault || false,
    maxConcurrencyLimit: input.maxConcurrencyLimit || 1
  }).returning();

  return repository[0];
}

/**
 * Get all repositories for a project
 */
export async function getProjectRepositories(projectId: string) {
  if (!useV2Schema()) {
    // V1 behavior: return repoAgents as repositories
    const repoAgents = await db.select()
      .from(v1Schema.repoAgents)
      .where(eq(v1Schema.repoAgents.projectId, projectId))
      .orderBy(v1Schema.repoAgents.createdAt);

    return repoAgents.map(repoAgent => ({
      id: repoAgent.id,
      projectId: repoAgent.projectId,
      name: repoAgent.name,
      repoPath: repoAgent.repoPath,
      isDefault: !repoAgent.isPaused, // Map isPaused to isDefault (inverted)
      maxConcurrencyLimit: 1, // Default limit
      lastTaskPushedAt: null,
      createdAt: repoAgent.createdAt,
      updatedAt: repoAgent.updatedAt
    }));
  }

  return await db.select()
    .from(v2Schema.repositories)
    .where(eq(v2Schema.repositories.projectId, projectId))
    .orderBy(v2Schema.repositories.isDefault, v2Schema.repositories.createdAt);
}

/**
 * Get a specific repository by ID
 */
export async function getRepository(repositoryId: string) {
  if (!useV2Schema()) {
    // V1 behavior: get repoAgent
    const repoAgents = await db.select()
      .from(v1Schema.repoAgents)
      .where(eq(v1Schema.repoAgents.id, repositoryId))
      .limit(1);

    if (!repoAgents[0]) return null;

    const repoAgent = repoAgents[0];
    return {
      id: repoAgent.id,
      projectId: repoAgent.projectId,
      name: repoAgent.name,
      repoPath: repoAgent.repoPath,
      isDefault: !repoAgent.isPaused,
      maxConcurrencyLimit: 1,
      lastTaskPushedAt: null,
      createdAt: repoAgent.createdAt,
      updatedAt: repoAgent.updatedAt
    };
  }

  const repositories = await db.select()
    .from(v2Schema.repositories)
    .where(eq(v2Schema.repositories.id, repositoryId))
    .limit(1);

  return repositories[0] || null;
}

/**
 * Update a repository
 */
export async function updateRepository(repositoryId: string, input: UpdateRepositoryInput) {
  if (!useV2Schema()) {
    throw new Error('Updating repositories requires V2 schema');
  }

  // If setting as default, remove default from other repos in same project
  if (input.isDefault) {
    const repository = await getRepository(repositoryId);
    if (repository) {
      await db.update(v2Schema.repositories)
        .set({ isDefault: false })
        .where(and(
          eq(v2Schema.repositories.projectId, repository.projectId),
          eq(v2Schema.repositories.id, repositoryId)
        ));
    }
  }

  const updated = await db.update(v2Schema.repositories)
    .set({
      ...input,
      updatedAt: new Date()
    })
    .where(eq(v2Schema.repositories.id, repositoryId))
    .returning();

  return updated[0] || null;
}

/**
 * Delete a repository
 */
export async function deleteRepository(repositoryId: string) {
  if (!useV2Schema()) {
    throw new Error('Deleting repositories requires V2 schema');
  }

  // Check if repository has active tasks
  const activeTasks = await db.select()
    .from(v2Schema.tasks)
    .where(and(
      eq(v2Schema.tasks.mainRepositoryId, repositoryId),
      eq(v2Schema.tasks.isAiWorking, true)
    ))
    .limit(1);

  if (activeTasks.length > 0) {
    throw new Error('Cannot delete repository with active tasks');
  }

  // Check if repository is used in additional repos
  const additionalRepoUsage = await db.select()
    .from(v2Schema.taskRepositories)
    .where(eq(v2Schema.taskRepositories.repositoryId, repositoryId))
    .limit(1);

  if (additionalRepoUsage.length > 0) {
    throw new Error('Cannot delete repository used in additional repository assignments');
  }

  const deleted = await db.delete(v2Schema.repositories)
    .where(eq(v2Schema.repositories.id, repositoryId))
    .returning();

  return deleted[0] || null;
}

/**
 * Get default repository for a project
 */
export async function getDefaultRepository(projectId: string) {
  const repositories = await getProjectRepositories(projectId);
  return repositories.find(repo => repo.isDefault) || repositories[0] || null;
}

/**
 * Set repository as default
 */
export async function setDefaultRepository(projectId: string, repositoryId: string) {
  if (!useV2Schema()) {
    throw new Error('Setting default repository requires V2 schema');
  }

  // Remove default from all repos in project
  await db.update(v2Schema.repositories)
    .set({ isDefault: false })
    .where(eq(v2Schema.repositories.projectId, projectId));

  // Set target repo as default
  const updated = await db.update(v2Schema.repositories)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(
      eq(v2Schema.repositories.id, repositoryId),
      eq(v2Schema.repositories.projectId, projectId)
    ))
    .returning();

  return updated[0] || null;
}

/**
 * Get repositories with task counts
 */
export async function getRepositoriesWithTaskCounts(projectId: string) {
  const repositories = await getProjectRepositories(projectId);
  const repositoriesWithCounts = [];

  for (const repository of repositories) {
    let activeTaskCount = 0;
    let totalTaskCount = 0;

    if (useV2Schema()) {
      // V2: count main repository tasks and additional repository tasks
      const mainTasks = await db.select()
        .from(v2Schema.tasks)
        .where(eq(v2Schema.tasks.mainRepositoryId, repository.id));

      const additionalTasks = await db.select()
        .from(v2Schema.taskRepositories)
        .innerJoin(v2Schema.tasks, eq(v2Schema.tasks.id, v2Schema.taskRepositories.taskId))
        .where(eq(v2Schema.taskRepositories.repositoryId, repository.id));

      const activeTasks = await db.select()
        .from(v2Schema.tasks)
        .where(and(
          eq(v2Schema.tasks.mainRepositoryId, repository.id),
          eq(v2Schema.tasks.isAiWorking, true)
        ));

      activeTaskCount = activeTasks.length;
      totalTaskCount = mainTasks.length + additionalTasks.length;
    } else {
      // V1: count repoAgent tasks
      const tasks = await db.select()
        .from(v1Schema.tasks)
        .where(eq(v1Schema.tasks.repoAgentId, repository.id));

      const activeTasks = tasks.filter(task => task.isAiWorking);
      activeTaskCount = activeTasks.length;
      totalTaskCount = tasks.length;
    }

    repositoriesWithCounts.push({
      ...repository,
      activeTaskCount,
      totalTaskCount,
      isAvailable: activeTaskCount < repository.maxConcurrencyLimit
    });
  }

  return repositoriesWithCounts;
}

/**
 * Check if repository is available for new tasks
 */
export async function isRepositoryAvailable(repositoryId: string): Promise<boolean> {
  const repository = await getRepository(repositoryId);
  if (!repository) return false;

  let activeTaskCount = 0;

  if (useV2Schema()) {
    // Count tasks using this repository (main + additional)
    const mainTasks = await db.select()
      .from(v2Schema.tasks)
      .where(and(
        eq(v2Schema.tasks.mainRepositoryId, repositoryId),
        eq(v2Schema.tasks.isAiWorking, true)
      ));

    const additionalTasks = await db.select()
      .from(v2Schema.taskRepositories)
      .innerJoin(v2Schema.tasks, eq(v2Schema.tasks.id, v2Schema.taskRepositories.taskId))
      .where(and(
        eq(v2Schema.taskRepositories.repositoryId, repositoryId),
        eq(v2Schema.tasks.isAiWorking, true)
      ));

    activeTaskCount = mainTasks.length + additionalTasks.length;
  } else {
    // V1: count repoAgent active tasks
    const activeTasks = await db.select()
      .from(v1Schema.tasks)
      .where(and(
        eq(v1Schema.tasks.repoAgentId, repositoryId),
        eq(v1Schema.tasks.isAiWorking, true)
      ));

    activeTaskCount = activeTasks.length;
  }

  return activeTaskCount < repository.maxConcurrencyLimit;
}

/**
 * Update repository last task pushed timestamp
 */
export async function updateRepositoryLastTaskPushed(repositoryId: string) {
  if (!useV2Schema()) {
    return; // V1 doesn't track this
  }

  await db.update(v2Schema.repositories)
    .set({
      lastTaskPushedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(v2Schema.repositories.id, repositoryId));
}

/**
 * Add additional repository to task
 */
export async function addRepositoryToTask(taskId: string, repositoryId: string) {
  if (!useV2Schema()) {
    throw new Error('Additional repositories require V2 schema');
  }

  // Check if assignment already exists
  const existing = await db.select()
    .from(v2Schema.taskRepositories)
    .where(and(
      eq(v2Schema.taskRepositories.taskId, taskId),
      eq(v2Schema.taskRepositories.repositoryId, repositoryId)
    ))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const assignment = await db.insert(v2Schema.taskRepositories).values({
    taskId,
    repositoryId
  }).returning();

  return assignment[0];
}

/**
 * Remove additional repository from task
 */
export async function removeRepositoryFromTask(taskId: string, repositoryId: string) {
  if (!useV2Schema()) {
    throw new Error('Additional repositories require V2 schema');
  }

  const removed = await db.delete(v2Schema.taskRepositories)
    .where(and(
      eq(v2Schema.taskRepositories.taskId, taskId),
      eq(v2Schema.taskRepositories.repositoryId, repositoryId)
    ))
    .returning();

  return removed[0] || null;
}

/**
 * Get additional repositories for a task
 */
export async function getTaskAdditionalRepositories(taskId: string) {
  if (!useV2Schema()) {
    return []; // V1 doesn't support additional repositories
  }

  const repositoriesWithTask = await db.select({
    repository: v2Schema.repositories,
    assignment: v2Schema.taskRepositories
  })
    .from(v2Schema.repositories)
    .innerJoin(v2Schema.taskRepositories, eq(v2Schema.taskRepositories.repositoryId, v2Schema.repositories.id))
    .where(eq(v2Schema.taskRepositories.taskId, taskId))
    .orderBy(v2Schema.repositories.name);

  return repositoriesWithTask.map(row => row.repository);
}