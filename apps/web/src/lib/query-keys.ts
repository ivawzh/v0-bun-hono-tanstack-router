/**
 * Standardized query key factory for consistent cache management
 * 
 * This module provides:
 * - Standardized query key generation for all entities
 * - Type-safe invalidation patterns
 * - Cache utility helpers for optimistic updates
 * - Migration utilities for existing hardcoded query keys
 */

import type { QueryClient } from '@tanstack/react-query'

/**
 * Query key factory for type-safe and consistent query keys
 * 
 * Usage:
 * ```ts
 * // In your component:
 * const { data } = useQuery(orpc.projects.getWithTasks.queryOptions({
 *   input: { id: projectId },
 *   queryKey: queryKeys.projects.withTasks(projectId), // Override oRPC key
 * }))
 * 
 * // For invalidation:
 * cacheUtils.invalidateProject(queryClient, projectId)
 * ```
 */
export const queryKeys = {
  // Projects
  projects: {
    all: () => ['projects'] as const,
    lists: () => [...queryKeys.projects.all(), 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.projects.lists(), { input: filters }] as const,
    details: () => [...queryKeys.projects.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    withTasks: (id: string) => [...queryKeys.projects.all(), 'getWithTasks', { input: { id } }] as const,
    // Legacy key mapping for migration
    legacy: {
      getWithTasks: (id: string) => ['projects', 'getWithTasks', { input: { id } }] as const,
    }
  },

  // Tasks  
  tasks: {
    all: () => ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all(), 'list'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.tasks.lists(), { input: filters }] as const,
    details: () => [...queryKeys.tasks.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
    byProject: (projectId: string) => [...queryKeys.tasks.all(), 'byProject', projectId] as const,
    // Legacy/Special keys
    v2: {
      detail: (id: string) => ['v2-task', id] as const,
      byProject: () => ['v2-project-tasks'] as const,
    }
  },

  // Repositories
  repositories: {
    all: () => ['repositories'] as const,
    lists: () => [...queryKeys.repositories.all(), 'list'] as const,
    list: (projectId: string) => [...queryKeys.repositories.lists(), { input: { projectId } }] as const,
    details: () => [...queryKeys.repositories.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.repositories.details(), id] as const,
    byProject: (projectId: string) => [...queryKeys.repositories.all(), 'byProject', projectId] as const,
  },

  // Agents
  agents: {
    all: () => ['userAgents'] as const,
    lists: () => [...queryKeys.agents.all(), 'list'] as const,
    list: (options?: { includeTaskCounts?: boolean }) => [...queryKeys.agents.lists(), { input: options }] as const,
    details: () => [...queryKeys.agents.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.agents.details(), id] as const,
  },

  // Actors
  actors: {
    all: () => ['actors'] as const,
    lists: () => [...queryKeys.actors.all(), 'list'] as const,
    list: (projectId: string) => [...queryKeys.actors.lists(), { input: { projectId } }] as const,
    details: () => [...queryKeys.actors.all(), 'detail'] as const,
    detail: (id: string) => [...queryKeys.actors.details(), id] as const,
    byProject: (projectId: string) => [...queryKeys.actors.all(), 'byProject', projectId] as const,
  },

  // Attachments
  attachments: {
    all: () => ['attachments'] as const,
    byTask: (taskId: string) => [...queryKeys.attachments.all(), 'byTask', taskId] as const,
  },

  // Auth
  auth: {
    all: () => ['auth'] as const,
    user: () => [...queryKeys.auth.all(), 'user'] as const,
    session: () => [...queryKeys.auth.all(), 'session'] as const,
  },
} as const

/**
 * Error handling for cache operations
 */
const handleCacheError = (operation: string, error: unknown) => {
  console.warn(`Cache operation '${operation}' failed:`, error)
  // In development, show more detailed error information
  if (process.env.NODE_ENV === 'development') {
    console.error(error)
  }
}

/**
 * Debug logger for cache operations (only in development)
 */
const debugLog = (operation: string, details?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔄 Cache: ${operation}`, details)
  }
}

/**
 * Helper to execute cache operations with error handling
 */
const executeCacheOperation = async (
  operation: string,
  promises: Promise<any>[],
  debugDetails?: any
) => {
  debugLog(operation, debugDetails)
  
  try {
    const results = await Promise.allSettled(promises)
    const failures = results.filter(r => r.status === 'rejected')
    
    if (failures.length > 0) {
      handleCacheError(operation, failures)
    }
    
    return results
  } catch (error) {
    handleCacheError(operation, error)
    throw error
  }
}

/**
 * Cache invalidation utilities for consistent cache management
 */
export const cacheUtils = {
  /**
   * Invalidate all data for a specific project
   */
  invalidateProject: (queryClient: QueryClient, projectId: string) => {
    const operations = [
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.withTasks(projectId),
        exact: true,
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.byProject(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.repositories.byProject(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.actors.byProject(projectId),
      }),
    ]
    
    return executeCacheOperation('invalidateProject', operations, { projectId })
  },

  /**
   * Invalidate task-related queries
   */
  invalidateTask: (queryClient: QueryClient, taskId: string, projectId?: string) => {
    const promises = [
      queryClient.invalidateQueries({
        queryKey: queryKeys.tasks.detail(taskId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.attachments.byTask(taskId),
      }),
    ]

    if (projectId) {
      promises.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.projects.withTasks(projectId),
          exact: true,
        })
      )
    }

    return executeCacheOperation('invalidateTask', promises, { taskId, projectId })
  },

  /**
   * Invalidate repository-related queries
   */
  invalidateRepository: (queryClient: QueryClient, repositoryId: string, projectId?: string) => {
    const promises = [
      queryClient.invalidateQueries({
        queryKey: queryKeys.repositories.detail(repositoryId),
      }),
    ]

    if (projectId) {
      promises.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.repositories.byProject(projectId),
        })
      )
    }

    return Promise.all(promises)
  },

  /**
   * Invalidate agent-related queries
   */
  invalidateAgent: (queryClient: QueryClient, agentId: string) => {
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.agents.detail(agentId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.agents.lists(),
      }),
    ])
  },

  /**
   * Invalidate actor-related queries
   */
  invalidateActor: (queryClient: QueryClient, actorId: string, projectId?: string) => {
    const promises = [
      queryClient.invalidateQueries({
        queryKey: queryKeys.actors.detail(actorId),
      }),
    ]

    if (projectId) {
      promises.push(
        queryClient.invalidateQueries({
          queryKey: queryKeys.actors.byProject(projectId),
        })
      )
    }

    return Promise.all(promises)
  },

  /**
   * Invalidate all project lists (useful after creating/deleting projects)
   */
  invalidateProjectLists: (queryClient: QueryClient) => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.projects.lists(),
    })
  },

  /**
   * Invalidate all auth-related queries
   */
  invalidateAuth: (queryClient: QueryClient) => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.auth.all(),
    })
  },

  /**
   * Invalidate all attachment-related queries for a task
   */
  invalidateAttachments: (queryClient: QueryClient, taskId: string) => {
    return queryClient.invalidateQueries({
      queryKey: queryKeys.attachments.byTask(taskId),
    })
  },

  /**
   * Bulk invalidation for multiple entities at once
   */
  invalidateMultiple: async (
    queryClient: QueryClient, 
    operations: Array<{ type: 'project' | 'task' | 'repository' | 'agent' | 'actor'; id: string; projectId?: string }>
  ) => {
    const promises = operations.map(op => {
      switch (op.type) {
        case 'project':
          return cacheUtils.invalidateProject(queryClient, op.id)
        case 'task':
          return cacheUtils.invalidateTask(queryClient, op.id, op.projectId)
        case 'repository':
          return cacheUtils.invalidateRepository(queryClient, op.id, op.projectId)
        case 'agent':
          return cacheUtils.invalidateAgent(queryClient, op.id)
        case 'actor':
          return cacheUtils.invalidateActor(queryClient, op.id, op.projectId)
        default:
          return Promise.resolve()
      }
    })
    
    return Promise.all(promises)
  },

  /**
   * Emergency cache reset (clear all queries)
   */
  resetCache: (queryClient: QueryClient) => {
    return queryClient.clear()
  },

  /**
   * Cancel queries to prevent race conditions during optimistic updates
   */
  cancelQueries: (queryClient: QueryClient, queryKey: readonly unknown[]) => {
    return queryClient.cancelQueries({ queryKey })
  },

  /**
   * Get cached data for a specific query
   */
  getCachedData: <T>(queryClient: QueryClient, queryKey: readonly unknown[]) => {
    return queryClient.getQueryData<T>(queryKey)
  },

  /**
   * Set cached data for a specific query
   */
  setCachedData: <T>(queryClient: QueryClient, queryKey: readonly unknown[], data: T) => {
    return queryClient.setQueryData<T>(queryKey, data)
  },
}

/**
 * Optimistic update helpers for common patterns
 */
export const optimisticUtils = {
  /**
   * Optimistically update task in project data
   */
  updateTaskInProject: async (
    queryClient: QueryClient,
    projectId: string,
    taskId: string,
    updater: (task: any) => any
  ) => {
    const queryKey = queryKeys.projects.withTasks(projectId)
    
    // Cancel outgoing queries
    await cacheUtils.cancelQueries(queryClient, queryKey)
    
    // Snapshot previous value
    const previousData = cacheUtils.getCachedData(queryClient, queryKey)
    
    // Optimistically update
    if (previousData) {
      cacheUtils.setCachedData(queryClient, queryKey, {
        ...previousData,
        tasks: (previousData as any).tasks.map((task: any) =>
          task.id === taskId ? updater(task) : task
        ),
      })
    }
    
    return { previousData, queryKey }
  },

  /**
   * Optimistically remove task from project data
   */
  removeTaskFromProject: async (
    queryClient: QueryClient,
    projectId: string,
    taskId: string
  ) => {
    const queryKey = queryKeys.projects.withTasks(projectId)
    
    // Cancel outgoing queries
    await cacheUtils.cancelQueries(queryClient, queryKey)
    
    // Snapshot previous value
    const previousData = cacheUtils.getCachedData(queryClient, queryKey)
    
    // Optimistically remove
    if (previousData) {
      cacheUtils.setCachedData(queryClient, queryKey, {
        ...previousData,
        tasks: (previousData as any).tasks.filter((task: any) => task.id !== taskId),
      })
    }
    
    return { previousData, queryKey }
  },

  /**
   * Optimistically add task to project data
   */
  addTaskToProject: async (
    queryClient: QueryClient,
    projectId: string,
    newTask: any
  ) => {
    const queryKey = queryKeys.projects.withTasks(projectId)
    
    // Cancel outgoing queries
    await cacheUtils.cancelQueries(queryClient, queryKey)
    
    // Snapshot previous value
    const previousData = cacheUtils.getCachedData(queryClient, queryKey)
    
    // Optimistically add
    if (previousData) {
      cacheUtils.setCachedData(queryClient, queryKey, {
        ...previousData,
        tasks: [...(previousData as any).tasks, newTask],
      })
    }
    
    return { previousData, queryKey }
  },

  /**
   * Rollback optimistic update on error
   */
  rollback: (queryClient: QueryClient, queryKey: readonly unknown[], previousData: any) => {
    if (previousData) {
      cacheUtils.setCachedData(queryClient, queryKey, previousData)
    }
  },
}