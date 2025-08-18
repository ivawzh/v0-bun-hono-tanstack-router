/**
 * V2 Repository Service Functions
 * Repository operations with V2 schema
 */

import { db } from '../../db';
import { eq, and } from 'drizzle-orm';
import * as schema from '../../db/schema/index';

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
  // If setting as default, remove default from other repos
  if (input.isDefault) {
    await db.update(schema.repositories)
      .set({ isDefault: false })
      .where(eq(schema.repositories.projectId, input.projectId));
  }

  const repository = await db.insert(schema.repositories).values({
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
  return await db.select()
    .from(schema.repositories)
    .where(eq(schema.repositories.projectId, projectId))
    .orderBy(schema.repositories.isDefault, schema.repositories.createdAt);
}

/**
 * Get a specific repository by ID
 */
export async function getRepository(repositoryId: string) {
  const repositories = await db.select()
    .from(schema.repositories)
    .where(eq(schema.repositories.id, repositoryId))
    .limit(1);

  return repositories[0] || null;
}

/**
 * Update a repository
 */
export async function updateRepository(repositoryId: string, input: UpdateRepositoryInput) {
  // If setting as default, remove default from other repos in same project
  if (input.isDefault) {
    const repository = await getRepository(repositoryId);
    if (repository) {
      await db.update(schema.repositories)
        .set({ isDefault: false })
        .where(and(
          eq(schema.repositories.projectId, repository.projectId),
          eq(schema.repositories.id, repositoryId)
        ));
    }
  }

  const updated = await db.update(schema.repositories)
    .set({
      ...input,
      updatedAt: new Date()
    })
    .where(eq(schema.repositories.id, repositoryId))
    .returning();

  return updated[0] || null;
}

/**
 * Delete a repository
 */
export async function deleteRepository(repositoryId: string) {
  // Check if repository has active tasks
  const activeTasks = await db.select()
    .from(schema.tasks)
    .where(and(
      eq(schema.tasks.mainRepositoryId, repositoryId),
      eq(schema.tasks.isAiWorking, true)
    ))
    .limit(1);

  if (activeTasks.length > 0) {
    throw new Error('Cannot delete repository with active tasks');
  }

  // Check if repository is used in additional repos
  const additionalRepoUsage = await db.select()
    .from(schema.taskRepositories)
    .where(eq(schema.taskRepositories.repositoryId, repositoryId))
    .limit(1);

  if (additionalRepoUsage.length > 0) {
    throw new Error('Cannot delete repository used in additional repository assignments');
  }

  const deleted = await db.delete(schema.repositories)
    .where(eq(schema.repositories.id, repositoryId))
    .returning();

  return deleted[0] || null;
}

/**
 * Get default repository for a project
 */
export async function getDefaultRepository(projectId: string) {
  const defaultRepo = await db.select()
    .from(schema.repositories)
    .where(and(
      eq(schema.repositories.projectId, projectId),
      eq(schema.repositories.isDefault, true)
    ))
    .limit(1);

  return defaultRepo[0] || null;
}

/**
 * Set repository as default
 */
export async function setDefaultRepository(projectId: string, repositoryId: string) {
  // Remove default from all repos in project
  await db.update(schema.repositories)
    .set({ isDefault: false })
    .where(eq(schema.repositories.projectId, projectId));

  // Set target repo as default
  const updated = await db.update(schema.repositories)
    .set({ isDefault: true, updatedAt: new Date() })
    .where(and(
      eq(schema.repositories.id, repositoryId),
      eq(schema.repositories.projectId, projectId)
    ))
    .returning();

  return updated[0] || null;
}

/**
 * Get repositories with task counts
 */
export async function getRepositoriesWithCounts(projectId: string) {
  const repositories = await getProjectRepositories(projectId);
  const repositoriesWithCounts = [];

  for (const repository of repositories) {
    // Count main repository tasks and additional repository tasks
    const mainTasks = await db.select()
      .from(schema.tasks)
      .where(eq(schema.tasks.mainRepositoryId, repository.id));

    const additionalTasks = await db.select()
      .from(schema.taskRepositories)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskRepositories.taskId))
      .where(eq(schema.taskRepositories.repositoryId, repository.id));

    const activeTasks = await db.select()
      .from(schema.tasks)
      .where(and(
        eq(schema.tasks.mainRepositoryId, repository.id),
        eq(schema.tasks.isAiWorking, true)
      ));

    const activeTaskCount = activeTasks.length;
    const totalTaskCount = mainTasks.length + additionalTasks.length;

    repositoriesWithCounts.push({
      ...repository,
      activeTaskCount,
      totalTaskCount,
      isAvailable: activeTaskCount < (repository.maxConcurrencyLimit || 1)
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

  // Count tasks using this repository (main + additional)
  const mainTasks = await db.select()
    .from(schema.tasks)
    .where(and(
      eq(schema.tasks.mainRepositoryId, repositoryId),
      eq(schema.tasks.isAiWorking, true)
    ));

  const additionalTasks = await db.select()
    .from(schema.taskRepositories)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskRepositories.taskId))
    .where(and(
      eq(schema.taskRepositories.repositoryId, repositoryId),
      eq(schema.tasks.isAiWorking, true)
    ));

  const activeTaskCount = mainTasks.length + additionalTasks.length;

  return activeTaskCount < (repository.maxConcurrencyLimit || 1);
}

/**
 * Update repository last task pushed timestamp
 */
export async function updateRepositoryLastTaskPushed(repositoryId: string) {
  await db.update(schema.repositories)
    .set({
      lastTaskPushedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(schema.repositories.id, repositoryId));
}

/**
 * Add additional repository to task
 */
export async function addRepositoryToTask(taskId: string, repositoryId: string) {
  // Check if assignment already exists
  const existing = await db.select()
    .from(schema.taskRepositories)
    .where(and(
      eq(schema.taskRepositories.taskId, taskId),
      eq(schema.taskRepositories.repositoryId, repositoryId)
    ))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const assignment = await db.insert(schema.taskRepositories).values({
    taskId,
    repositoryId
  }).returning();

  return assignment[0];
}

/**
 * Remove additional repository from task
 */
export async function removeRepositoryFromTask(taskId: string, repositoryId: string) {
  const removed = await db.delete(schema.taskRepositories)
    .where(and(
      eq(schema.taskRepositories.taskId, taskId),
      eq(schema.taskRepositories.repositoryId, repositoryId)
    ))
    .returning();

  return removed[0] || null;
}

/**
 * Get additional repositories for a task
 */
export async function getTaskAdditionalRepositories(taskId: string) {
  const repositoriesWithTask = await db.select({
    repository: schema.repositories,
    assignment: schema.taskRepositories
  })
    .from(schema.repositories)
    .innerJoin(schema.taskRepositories, eq(schema.taskRepositories.repositoryId, schema.repositories.id))
    .where(eq(schema.taskRepositories.taskId, taskId))
    .orderBy(schema.repositories.name);

  return repositoriesWithTask.map(row => row.repository);
}