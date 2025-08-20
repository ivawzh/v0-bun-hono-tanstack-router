/**
 * React hook for simplified cache management utilities
 * 
 * Provides easy access to query invalidation and optimistic update patterns
 * with consistent error handling and rollback capabilities.
 */

import { useQueryClient } from '@tanstack/react-query'
import { cacheUtils, optimisticUtils, queryKeys, devUtils } from '@/lib/query-keys'
import { useCallback } from 'react'

export function useCacheUtils() {
  const queryClient = useQueryClient()

  return {
    // Query key factories
    queryKeys,

    // Project cache management
    invalidateProject: useCallback(
      (projectId: string) => cacheUtils.invalidateProject(queryClient, projectId),
      [queryClient]
    ),

    invalidateProjectLists: useCallback(
      () => cacheUtils.invalidateProjectLists(queryClient),
      [queryClient]
    ),

    // Task cache management
    invalidateTask: useCallback(
      (taskId: string, projectId?: string) => cacheUtils.invalidateTask(queryClient, taskId, projectId),
      [queryClient]
    ),

    // Repository cache management
    invalidateRepository: useCallback(
      (repositoryId: string, projectId?: string) => cacheUtils.invalidateRepository(queryClient, repositoryId, projectId),
      [queryClient]
    ),

    // Agent cache management
    invalidateAgent: useCallback(
      (agentId: string) => cacheUtils.invalidateAgent(queryClient, agentId),
      [queryClient]
    ),

    // Actor cache management
    invalidateActor: useCallback(
      (actorId: string, projectId?: string) => cacheUtils.invalidateActor(queryClient, actorId, projectId),
      [queryClient]
    ),

    // Optimistic updates
    optimistic: {
      updateTaskInProject: useCallback(
        (projectId: string, taskId: string, updater: (task: any) => any) =>
          optimisticUtils.updateTaskInProject(queryClient, projectId, taskId, updater),
        [queryClient]
      ),

      removeTaskFromProject: useCallback(
        (projectId: string, taskId: string) =>
          optimisticUtils.removeTaskFromProject(queryClient, projectId, taskId),
        [queryClient]
      ),

      addTaskToProject: useCallback(
        (projectId: string, newTask: any) =>
          optimisticUtils.addTaskToProject(queryClient, projectId, newTask),
        [queryClient]
      ),

      rollback: useCallback(
        (queryKey: readonly unknown[], previousData: any) =>
          optimisticUtils.rollback(queryClient, queryKey, previousData),
        [queryClient]
      ),
    },

    // Direct cache access
    getCachedData: useCallback(
      <T>(queryKey: readonly unknown[]) => cacheUtils.getCachedData<T>(queryClient, queryKey),
      [queryClient]
    ),

    setCachedData: useCallback(
      <T>(queryKey: readonly unknown[], data: T) => cacheUtils.setCachedData<T>(queryClient, queryKey, data),
      [queryClient]
    ),

    cancelQueries: useCallback(
      (queryKey: readonly unknown[]) => cacheUtils.cancelQueries(queryClient, queryKey),
      [queryClient]
    ),

    // Bulk operations
    invalidateMultiple: useCallback(
      (operations: Array<{ type: 'project' | 'task' | 'repository' | 'agent' | 'actor'; id: string; projectId?: string }>) =>
        cacheUtils.invalidateMultiple(queryClient, operations),
      [queryClient]
    ),

    // Emergency operations  
    invalidateAll: useCallback(() => queryClient.invalidateQueries(), [queryClient]),
    resetCache: useCallback(() => cacheUtils.resetCache(queryClient), [queryClient]),

    // Auth operations
    invalidateAuth: useCallback(() => cacheUtils.invalidateAuth(queryClient), [queryClient]),

    // Attachment operations
    invalidateAttachments: useCallback(
      (taskId: string, projectId?: string) => cacheUtils.invalidateAttachments(queryClient, taskId, projectId),
      [queryClient]
    ),

    // Development utilities (only available in development)
    dev: process.env.NODE_ENV === 'development' ? {
      logActiveQueries: useCallback(() => devUtils.logActiveQueries(queryClient), [queryClient]),
      clearEntity: useCallback(
        (entity: keyof typeof queryKeys, id?: string) => devUtils.clearEntity(queryClient, entity, id),
        [queryClient]
      ),
      validateQueryKey: useCallback(
        (queryKey: readonly unknown[]) => devUtils.validateQueryKey(queryKey),
        []
      ),
      enablePerformanceMonitoring: useCallback(
        () => devUtils.monitorCachePerformance(queryClient),
        [queryClient]
      ),
    } : undefined,
  }
}

/**
 * Hook for project-specific cache operations
 * Pre-configured with project context for convenience
 */
export function useProjectCache(projectId: string) {
  const cache = useCacheUtils()

  return {
    ...cache,

    // Expose query keys scoped for this project
    queryKeys: {
      projects: {
        withTasks: () => cache.queryKeys.projects.withTasks(projectId),
        detail: () => cache.queryKeys.projects.detail(projectId),
      },
      tasks: {
        byProject: () => cache.queryKeys.tasks.byProject(projectId),
        detail: (taskId: string) => cache.queryKeys.tasks.detail(taskId),
        v2: {
          detail: (taskId: string) => cache.queryKeys.tasks.v2.detail(taskId),
          byProject: () => cache.queryKeys.tasks.v2.byProject(),
        }
      },
      repositories: {
        list: () => cache.queryKeys.repositories.list(projectId),
        byProject: () => cache.queryKeys.repositories.byProject(projectId),
        detail: (repoId: string) => cache.queryKeys.repositories.detail(repoId),
      },
      agents: {
        list: (options?: { includeTaskCounts?: boolean }) => cache.queryKeys.agents.list(options),
        detail: (agentId: string) => cache.queryKeys.agents.detail(agentId),
      },
      actors: {
        list: () => cache.queryKeys.actors.list(projectId),
        byProject: () => cache.queryKeys.actors.byProject(projectId),
        detail: (actorId: string) => cache.queryKeys.actors.detail(actorId),
      },
      attachments: {
        byTask: (taskId: string) => cache.queryKeys.attachments.byTask(taskId),
      }
    },

    // Pre-configured project operations
    invalidate: useCallback(() => cache.invalidateProject(projectId), [cache, projectId]),

    getProjectWithTasks: useCallback(
      () => cache.getCachedData(cache.queryKeys.projects.withTasks(projectId)),
      [cache, projectId]
    ),

    // Task operations within this project
    task: {
      invalidate: useCallback(
        (taskId: string) => cache.invalidateTask(taskId, projectId),
        [cache, projectId]
      ),

      optimisticUpdate: useCallback(
        (taskId: string, updater: (task: any) => any) =>
          cache.optimistic.updateTaskInProject(projectId, taskId, updater),
        [cache, projectId]
      ),

      optimisticRemove: useCallback(
        (taskId: string) => cache.optimistic.removeTaskFromProject(projectId, taskId),
        [cache, projectId]
      ),

      optimisticAdd: useCallback(
        (newTask: any) => cache.optimistic.addTaskToProject(projectId, newTask),
        [cache, projectId]
      ),
    },

    // Repository operations within this project
    repository: {
      invalidate: useCallback(
        (repositoryId: string) => cache.invalidateRepository(repositoryId, projectId),
        [cache, projectId]
      ),
    },

    // Actor operations within this project
    actor: {
      invalidate: useCallback(
        (actorId: string) => cache.invalidateActor(actorId, projectId),
        [cache, projectId]
      ),
    },
  }
}