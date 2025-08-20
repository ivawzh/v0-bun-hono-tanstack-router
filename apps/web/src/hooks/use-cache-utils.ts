/**
 * React hook for simplified cache management utilities
 * 
 * Provides easy access to query invalidation and optimistic update patterns
 * with consistent error handling and rollback capabilities.
 */

import { useQueryClient } from '@tanstack/react-query'
import { cacheUtils, optimisticUtils, queryKeys, devUtils } from '@/lib/query-keys'
import { enhancedCacheUtils, cacheRecoveryService } from '@/lib/cache-recovery'
import { useCallback, useEffect, useState } from 'react'

export function useCacheUtils() {
  const queryClient = useQueryClient()

  return {
    // Query key factories
    queryKeys,

    // Project cache management (with error recovery)
    invalidateProject: useCallback(
      (projectId: string) => enhancedCacheUtils.invalidateProject(queryClient, projectId),
      [queryClient]
    ),

    invalidateProjectLists: useCallback(
      () => cacheRecoveryService.executeWithRecovery(
        queryClient,
        () => cacheUtils.invalidateProjectLists(queryClient),
        'invalidateProjectLists'
      ),
      [queryClient]
    ),

    // Task cache management (with error recovery)
    invalidateTask: useCallback(
      (taskId: string, projectId?: string) => enhancedCacheUtils.invalidateTask(queryClient, taskId, projectId),
      [queryClient]
    ),

    // Repository cache management (with error recovery)
    invalidateRepository: useCallback(
      (repositoryId: string, projectId?: string) => enhancedCacheUtils.invalidateRepository(queryClient, repositoryId, projectId),
      [queryClient]
    ),

    // Agent cache management (with error recovery)
    invalidateAgent: useCallback(
      (agentId: string) => enhancedCacheUtils.invalidateAgent(queryClient, agentId),
      [queryClient]
    ),

    // Actor cache management (with error recovery)
    invalidateActor: useCallback(
      (actorId: string, projectId?: string) => enhancedCacheUtils.invalidateActor(queryClient, actorId, projectId),
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

    // Bulk operations (with error recovery)
    invalidateMultiple: useCallback(
      (operations: Array<{ type: 'project' | 'task' | 'repository' | 'agent' | 'actor'; id: string; projectId?: string }>) =>
        enhancedCacheUtils.invalidateMultiple(queryClient, operations),
      [queryClient]
    ),

    // Emergency operations (with error recovery) 
    invalidateAll: useCallback(
      () => cacheRecoveryService.executeWithRecovery(
        queryClient,
        () => queryClient.invalidateQueries(),
        'invalidateAll'
      ),
      [queryClient]
    ),
    resetCache: useCallback(
      () => cacheRecoveryService.executeWithRecovery(
        queryClient,
        async () => { await cacheUtils.resetCache(queryClient) },
        'resetCache'
      ),
      [queryClient]
    ),

    // Auth operations (with error recovery)
    invalidateAuth: useCallback(
      () => cacheRecoveryService.executeWithRecovery(
        queryClient,
        () => cacheUtils.invalidateAuth(queryClient),
        'invalidateAuth'
      ),
      [queryClient]
    ),

    // Attachment operations (with error recovery)
    invalidateAttachments: useCallback(
      (taskId: string, projectId?: string) => enhancedCacheUtils.invalidateAttachments(queryClient, taskId, projectId),
      [queryClient]
    ),

    // Error recovery utilities
    recovery: {
      emergencyReset: useCallback(
        (reason: string) => enhancedCacheUtils.emergencyReset(queryClient, reason),
        [queryClient]
      ),
      getStats: useCallback(() => enhancedCacheUtils.getRecoveryStats(), []),
      getHealthStatus: useCallback(() => enhancedCacheUtils.getHealthStatus(), []),
      getDiagnostics: useCallback(() => enhancedCacheUtils.getDiagnostics(), []),
      forceProcessQueue: useCallback(() => enhancedCacheUtils.forceProcessQueue(), []),
      reset: useCallback(() => enhancedCacheUtils.resetRecoveryService(), []),
    },

    // Advanced cache operations
    batchInvalidate: useCallback(
      (operations: Array<{
        type: 'project' | 'task' | 'repository' | 'agent' | 'actor' | 'attachment'
        id: string
        projectId?: string
      }>) => enhancedCacheUtils.batchInvalidate(queryClient, operations),
      [queryClient]
    ),

    smartInvalidate: useCallback(
      (context: {
        entityType: 'project' | 'task' | 'repository' | 'agent' | 'actor'
        entityId: string
        projectId?: string
        action?: 'create' | 'update' | 'delete'
      }) => enhancedCacheUtils.smartInvalidate(queryClient, context),
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
      testRecovery: useCallback(
        (testType: 'network' | 'timeout' | 'general' = 'general') => {
          console.log(`🧪 Testing cache recovery for ${testType} errors`)
          
          // Create a simulated error
          let testError: Error
          switch (testType) {
            case 'network':
              testError = new Error('Network request failed - connection error')
              break
            case 'timeout':
              testError = new Error('Request timeout - operation aborted')
              break
            default:
              testError = new Error('Test cache operation failure')
          }
          
          // Test the recovery system
          return cacheRecoveryService.executeWithRecovery(
            queryClient,
            async () => {
              throw testError
            },
            `test-${testType}-recovery`,
            { maxRetries: 2, baseDelayMs: 100 }
          ).catch(() => {
            console.log(`✅ Cache recovery test completed for ${testType} errors`)
            console.log('📊 Recovery stats:', enhancedCacheUtils.getRecoveryStats())
            console.log('🏥 Health status:', enhancedCacheUtils.getHealthStatus())
          })
        },
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

/**
 * Hook for monitoring cache health and performance
 */
export function useCacheMonitoring() {
  const queryClient = useQueryClient()
  const [healthStatus, setHealthStatus] = useState(() => enhancedCacheUtils.getHealthStatus())
  const [recoveryStats, setRecoveryStats] = useState(() => enhancedCacheUtils.getRecoveryStats())
  
  useEffect(() => {
    const interval = setInterval(() => {
      setHealthStatus(enhancedCacheUtils.getHealthStatus())
      setRecoveryStats(enhancedCacheUtils.getRecoveryStats())
    }, 10000) // Update every 10 seconds
    
    return () => clearInterval(interval)
  }, [])
  
  const getCacheMetrics = useCallback(() => {
    const queries = queryClient.getQueryCache().getAll()
    return {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.state.fetchStatus === 'fetching').length,
      staleQueries: queries.filter(q => q.isStale()).length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
      successQueries: queries.filter(q => q.state.status === 'success').length,
      memoryUsage: queries.reduce((acc, query) => {
        // Rough estimation of memory usage
        return acc + (query.state.data ? JSON.stringify(query.state.data).length : 0)
      }, 0)
    }
  }, [queryClient])
  
  const forceHealthCheck = useCallback(() => {
    const newHealthStatus = enhancedCacheUtils.getHealthStatus()
    const newRecoveryStats = enhancedCacheUtils.getRecoveryStats()
    const cacheMetrics = getCacheMetrics()
    
    setHealthStatus(newHealthStatus)
    setRecoveryStats(newRecoveryStats)
    
    return {
      health: newHealthStatus,
      stats: newRecoveryStats,
      cache: cacheMetrics,
      diagnostics: enhancedCacheUtils.getDiagnostics()
    }
  }, [getCacheMetrics])
  
  return {
    healthStatus,
    recoveryStats,
    getCacheMetrics,
    forceHealthCheck,
    
    // Health indicators
    isHealthy: healthStatus.status === 'healthy',
    isDegraded: healthStatus.status === 'degraded',
    isCritical: healthStatus.status === 'critical',
    
    // Recovery actions
    forceProcessQueue: enhancedCacheUtils.forceProcessQueue,
    resetRecoveryService: enhancedCacheUtils.resetRecoveryService,
    emergencyReset: useCallback((reason: string) => 
      enhancedCacheUtils.emergencyReset(queryClient, reason), [queryClient]
    )
  }
}