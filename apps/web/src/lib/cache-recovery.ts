/**
 * Comprehensive cache invalidation error recovery and fallback strategies
 * 
 * This service provides multiple layers of reliability to ensure cache invalidation
 * works even in edge cases and failure scenarios:
 * 
 * 1. Retry with exponential backoff
 * 2. Fallback invalidation strategies  
 * 3. Background cleanup and recovery
 * 4. Emergency cache reset
 * 5. Queued operations for offline scenarios
 */

import type { QueryClient } from '@tanstack/react-query'
import { queryKeys, cacheUtils } from './query-keys'

interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  timeoutMs?: number
  fallbackStrategy?: 'conservative' | 'aggressive' | 'minimal'
}

interface QueuedOperation {
  id: string
  operation: () => Promise<any>
  description: string
  timestamp: number
  retries: number
  maxRetries: number
}

interface RecoveryStats {
  totalAttempts: number
  successfulRetries: number
  failedOperations: number
  emergencyResets: number
  queuedOperations: number
  fallbackStrategiesUsed: number
  networkErrors: number
  timeoutErrors: number
  conservativeRefreshes: number
  circuitBreakerTrips: number
  lastRecoveryAttempt: number | null
  avgRecoveryTime: number
  criticalFailures: number
}

class CacheRecoveryService {
  private operationQueue: Map<string, QueuedOperation> = new Map()
  private isProcessingQueue = false
  private stats: RecoveryStats = {
    totalAttempts: 0,
    successfulRetries: 0,
    failedOperations: 0,
    emergencyResets: 0,
    queuedOperations: 0,
    fallbackStrategiesUsed: 0,
    networkErrors: 0,
    timeoutErrors: 0,
    conservativeRefreshes: 0,
    circuitBreakerTrips: 0,
    lastRecoveryAttempt: null,
    avgRecoveryTime: 0,
    criticalFailures: 0
  }

  private readonly defaultRetryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    timeoutMs: 10000,
    fallbackStrategy: 'conservative'
  }

  // Circuit breaker state
  private circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private circuitBreakerFailures = 0
  private circuitBreakerLastFailure = 0
  private readonly circuitBreakerThreshold = 5
  private readonly circuitBreakerTimeout = 30000 // 30 seconds
  
  // Recovery time tracking
  private recoveryTimes: number[] = []
  private readonly maxRecoveryTimeHistory = 10

  /**
   * Track error types for analytics
   */
  private trackErrorType(error: unknown): void {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as Error).message.toLowerCase()
      if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
        this.stats.networkErrors++
      } else if (message.includes('timeout')) {
        this.stats.timeoutErrors++
      }
    }
  }

  /**
   * Get contextual fallback strategies based on error type and strategy preference
   */
  private getFallbackStrategiesForError(
    error: unknown,
    queryClient: QueryClient,
    description: string,
    strategy: RetryOptions['fallbackStrategy'] = 'conservative'
  ): Array<{ name: string; execute: () => Promise<void> }> {
    const baseStrategies = [
      {
        name: 'Broad Invalidation',
        execute: () => this.executeBroadInvalidation(queryClient, description)
      },
      {
        name: 'Pattern-Based Invalidation', 
        execute: () => this.executePatternBasedInvalidation(queryClient, description)
      },
      {
        name: 'Selective Reset',
        execute: () => this.executeSelectiveReset(queryClient, description)
      }
    ]
    
    // Add strategy-specific fallbacks
    switch (strategy) {
      case 'minimal':
        return [
          {
            name: 'Minimal Fallback',
            execute: () => this.executeMinimalFallback(queryClient, description)
          },
          ...baseStrategies.slice(0, 1) // Only broad invalidation
        ]
        
      case 'aggressive':
        return [
          ...baseStrategies,
          {
            name: 'Conservative Refresh',
            execute: () => this.executeConservativeRefresh(queryClient, description)
          },
          {
            name: 'Full Cache Clear',
            execute: () => this.executeFullCacheClear(queryClient, description)
          }
        ]
        
      case 'conservative':
      default:
        return baseStrategies
    }
  }
  
  /**
   * Execute full cache clear as last resort
   */
  private async executeFullCacheClear(queryClient: QueryClient, description: string): Promise<void> {
    console.warn(`🧹 Full cache clear fallback for: ${description}`)
    await queryClient.clear()
  }

  /**
   * Execute conservative cache refresh for queued operations
   */
  private async executeConservativeRefresh(queryClient: QueryClient, description: string): Promise<void> {
    this.stats.conservativeRefreshes++
    
    // Conservative approach: invalidate common query patterns
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all() })
    ])
  }

  /**
   * Check and manage circuit breaker state
   */
  private async checkCircuitBreaker(): Promise<boolean> {
    const now = Date.now()
    
    switch (this.circuitBreakerState) {
      case 'OPEN':
        if (now - this.circuitBreakerLastFailure > this.circuitBreakerTimeout) {
          this.circuitBreakerState = 'HALF_OPEN'
          console.log('🔧 Circuit breaker moving to HALF_OPEN state')
          return true
        }
        return false
        
      case 'HALF_OPEN':
      case 'CLOSED':
        return true
        
      default:
        return true
    }
  }
  
  /**
   * Handle circuit breaker on operation result
   */
  private handleCircuitBreakerResult(success: boolean): void {
    if (success) {
      // Reset circuit breaker on success
      if (this.circuitBreakerState === 'HALF_OPEN') {
        this.circuitBreakerState = 'CLOSED'
        this.circuitBreakerFailures = 0
        console.log('✅ Circuit breaker reset to CLOSED state')
      }
    } else {
      // Track failures
      this.circuitBreakerFailures++
      this.circuitBreakerLastFailure = Date.now()
      
      // Trip circuit breaker if threshold reached
      if (this.circuitBreakerFailures >= this.circuitBreakerThreshold) {
        this.circuitBreakerState = 'OPEN'
        this.stats.circuitBreakerTrips++
        console.error('🚨 Circuit breaker OPEN - cache operations temporarily disabled')
      }
    }
  }

  /**
   * Execute cache operation with comprehensive error recovery and circuit breaker
   */
  async executeWithRecovery<T>(
    queryClient: QueryClient,
    operation: () => Promise<T>,
    description: string,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const retryOptions = { ...this.defaultRetryOptions, ...options }
    const startTime = Date.now()
    
    this.stats.totalAttempts++
    this.stats.lastRecoveryAttempt = startTime

    // Check circuit breaker
    const circuitBreakerOpen = !(await this.checkCircuitBreaker())
    if (circuitBreakerOpen) {
      console.warn('⚡ Circuit breaker is OPEN - using emergency fallback')
      await this.executeEmergencyFallback(queryClient, description)
      throw new Error(`Circuit breaker OPEN: ${description}`)
    }

    let lastError: unknown
    
    for (let attempt = 0; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        // Add timeout wrapper if specified
        const result = retryOptions.timeoutMs 
          ? await this.withTimeout(operation(), retryOptions.timeoutMs)
          : await operation()
        
        // Track successful recovery
        if (attempt > 0) {
          this.stats.successfulRetries++
          console.log(`✅ Cache operation recovered after ${attempt} retries: ${description}`)
        }
        
        // Update circuit breaker and recovery metrics
        this.handleCircuitBreakerResult(true)
        this.updateRecoveryMetrics(startTime)
        
        return result
      } catch (error) {
        lastError = error
        const isLastAttempt = attempt === retryOptions.maxRetries
        
        // Track error types for better analytics
        this.trackErrorType(error)
        
        // Handle critical errors immediately
        if (this.isCriticalError(error)) {
          this.stats.criticalFailures++
          console.error(`🚨 Critical cache error detected: ${description}`, error)
          await this.handleCriticalError(queryClient, description, error)
          break
        }
        
        if (isLastAttempt) {
          break
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryOptions.baseDelayMs * Math.pow(retryOptions.backoffMultiplier, attempt),
          retryOptions.maxDelayMs
        )

        console.warn(`⚠️ Cache operation failed (attempt ${attempt + 1}/${retryOptions.maxRetries + 1}), retrying in ${delay}ms: ${description}`, error)
        await this.sleep(delay)
      }
    }

    // All attempts failed
    this.stats.failedOperations++
    this.handleCircuitBreakerResult(false)
    console.error(`❌ Cache operation failed after ${retryOptions.maxRetries} retries: ${description}`, lastError)
    
    // Try fallback strategies based on configured strategy
    await this.executeFallbackStrategies(queryClient, description, lastError, retryOptions.fallbackStrategy)
    
    throw new Error(`Cache operation failed after all retries: ${description}`)
  }

  /**
   * Add timeout wrapper for operations
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeoutMs}ms`))
      }, timeoutMs)
      
      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutId))
    })
  }
  
  /**
   * Check if error is critical and requires immediate handling
   */
  private isCriticalError(error: unknown): boolean {
    if (!error || typeof error !== 'object' || !('message' in error)) return false
    
    const message = (error as Error).message.toLowerCase()
    return (
      message.includes('memory') ||
      message.includes('quota') ||
      message.includes('rate limit') ||
      message.includes('authentication') ||
      message.includes('authorization') ||
      message.includes('cors')
    )
  }
  
  /**
   * Handle critical errors with immediate fallback
   */
  private async handleCriticalError(
    queryClient: QueryClient,
    description: string,
    error: unknown
  ): Promise<void> {
    console.error(`🚨 Handling critical error for: ${description}`, error)
    
    // For critical errors, use minimal fallback to avoid cascading failures
    try {
      await this.executeMinimalFallback(queryClient, description)
    } catch (fallbackError) {
      console.error('❌ Critical error fallback also failed:', fallbackError)
      // Queue for later retry with higher priority
      await this.queueCriticalOperation(queryClient, description, error)
    }
  }
  
  /**
   * Execute emergency fallback for circuit breaker scenarios
   */
  private async executeEmergencyFallback(
    queryClient: QueryClient,
    description: string
  ): Promise<void> {
    console.log(`🚨 Emergency fallback for circuit breaker: ${description}`)
    
    // Use cached data if available, otherwise minimal refresh
    try {
      await this.executeMinimalFallback(queryClient, description)
    } catch (error) {
      console.warn('⚠️ Emergency fallback failed, using stale cache:', error)
    }
  }
  
  /**
   * Execute minimal fallback strategy
   */
  private async executeMinimalFallback(
    queryClient: QueryClient,
    description: string
  ): Promise<void> {
    // Only invalidate the most essential queries to avoid overloading
    const essentialInvalidations = [
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.projects.all(), 
        refetchType: 'none' // Don't trigger refetch, just mark stale
      }),
    ]
    
    await Promise.allSettled(essentialInvalidations)
  }
  
  /**
   * Update recovery time metrics
   */
  private updateRecoveryMetrics(startTime: number): void {
    const recoveryTime = Date.now() - startTime
    this.recoveryTimes.push(recoveryTime)
    
    // Keep only recent recovery times
    if (this.recoveryTimes.length > this.maxRecoveryTimeHistory) {
      this.recoveryTimes.shift()
    }
    
    // Update average
    this.stats.avgRecoveryTime = this.recoveryTimes.reduce((a, b) => a + b, 0) / this.recoveryTimes.length
  }

  /**
   * Execute fallback strategies when primary invalidation fails
   */
  private async executeFallbackStrategies(
    queryClient: QueryClient,
    originalDescription: string,
    originalError: unknown,
    strategy: RetryOptions['fallbackStrategy'] = 'conservative'
  ): Promise<void> {
    console.log(`🔄 Executing ${strategy} fallback strategies for: ${originalDescription}`)
    this.stats.fallbackStrategiesUsed++

    // Get contextual fallback strategies based on error type and strategy preference
    const fallbackStrategies = this.getFallbackStrategiesForError(originalError, queryClient, originalDescription, strategy)

    for (const strategyItem of fallbackStrategies) {
      try {
        await strategyItem.execute()
        console.log(`✅ Fallback strategy '${strategyItem.name}' succeeded for: ${originalDescription}`)
        return // Success, no need to try other strategies
      } catch (error) {
        console.warn(`⚠️ Fallback strategy '${strategyItem.name}' failed:`, error)
      }
    }

    // All fallback strategies failed, queue for background retry
    await this.queueOperationForRetry(queryClient, originalDescription, originalError)
  }

  /**
   * Broad invalidation strategy - invalidate related entity types
   */
  private async executeBroadInvalidation(queryClient: QueryClient, description: string): Promise<void> {
    // Extract entity type from description and invalidate broadly
    if (description.includes('project')) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.all() })
    }
    if (description.includes('task')) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all() })
    }
    if (description.includes('repository')) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.repositories.all() })
    }
    if (description.includes('agent')) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.agents.all() })
    }
    if (description.includes('actor')) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.actors.all() })
    }
    if (description.includes('attachment')) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.attachments.all() })
    }
  }

  /**
   * Pattern-based invalidation - use partial query key patterns
   */
  private async executePatternBasedInvalidation(queryClient: QueryClient, description: string): Promise<void> {
    // Extract patterns from description and invalidate by pattern
    const patterns = this.extractPatternsFromDescription(description)
    
    for (const pattern of patterns) {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey
          return pattern.every((part, index) => 
            index < queryKey.length && queryKey[index] === part
          )
        }
      })
    }
  }

  /**
   * Selective reset - remove specific queries instead of invalidating
   */
  private async executeSelectiveReset(queryClient: QueryClient, description: string): Promise<void> {
    // More aggressive: remove queries instead of just invalidating
    const patterns = this.extractPatternsFromDescription(description)
    
    for (const pattern of patterns) {
      queryClient.removeQueries({
        predicate: (query) => {
          const queryKey = query.queryKey
          return pattern.every((part, index) => 
            index < queryKey.length && queryKey[index] === part
          )
        }
      })
    }
  }

  /**
   * Extract invalidation patterns from operation description
   */
  private extractPatternsFromDescription(description: string): string[][] {
    const patterns: string[][] = []
    
    // Extract entity types and IDs from description
    const entityMatches = [
      { pattern: /project[s]?\s*(?:id:?\s*)?([a-f0-9-]+)/gi, entity: 'projects' },
      { pattern: /task[s]?\s*(?:id:?\s*)?([a-f0-9-]+)/gi, entity: 'tasks' },
      { pattern: /repository[s]?\s*(?:id:?\s*)?([a-f0-9-]+)/gi, entity: 'repositories' },
      { pattern: /agent[s]?\s*(?:id:?\s*)?([a-f0-9-]+)/gi, entity: 'userAgents' },
      { pattern: /actor[s]?\s*(?:id:?\s*)?([a-f0-9-]+)/gi, entity: 'actors' },
      { pattern: /attachment[s]?\s*(?:id:?\s*)?([a-f0-9-]+)/gi, entity: 'attachments' },
    ]

    for (const { pattern, entity } of entityMatches) {
      let match
      while ((match = pattern.exec(description)) !== null) {
        patterns.push([entity])
        if (match[1]) {
          patterns.push([entity, 'detail', match[1]])
        }
      }
    }

    return patterns
  }

  /**
   * Queue critical operation with higher priority
   */
  private async queueCriticalOperation(queryClient: QueryClient, description: string, error: unknown): Promise<void> {
    const operationId = `critical_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const queuedOperation: QueuedOperation = {
      id: operationId,
      operation: async () => {
        // For critical operations, use minimal fallback
        await this.executeMinimalFallback(queryClient, description)
      },
      description: `CRITICAL: ${description}`,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 10 // More retries for critical operations
    }

    // Add to front of queue for priority processing
    const entries = Array.from(this.operationQueue.entries())
    this.operationQueue.clear()
    this.operationQueue.set(operationId, queuedOperation)
    entries.forEach(([id, op]) => this.operationQueue.set(id, op))
    
    this.stats.queuedOperations++
    console.error(`🚨 Queued CRITICAL operation: ${description}`)
    
    if (!this.isProcessingQueue) {
      this.startBackgroundProcessing()
    }
  }

  /**
   * Queue failed operation for background retry
   */
  private async queueOperationForRetry(queryClient: QueryClient, description: string, error: unknown): Promise<void> {
    const operationId = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const queuedOperation: QueuedOperation = {
      id: operationId,
      operation: async () => {
        // Attempt a conservative cache refresh
        await this.executeConservativeRefresh(queryClient, description)
      },
      description,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 5
    }

    this.operationQueue.set(operationId, queuedOperation)
    this.stats.queuedOperations++
    
    console.log(`📥 Queued operation for background retry: ${description}`)
    
    // Start processing queue if not already running
    if (!this.isProcessingQueue) {
      this.startBackgroundProcessing()
    }
  }

  /**
   * Start background processing of queued operations
   */
  private startBackgroundProcessing(): void {
    if (this.isProcessingQueue) return

    this.isProcessingQueue = true
    console.log('🔄 Starting background cache recovery processing')

    const processQueue = async () => {
      while (this.operationQueue.size > 0) {
        const operations = Array.from(this.operationQueue.values())
        
        for (const operation of operations) {
          try {
            await operation.operation()
            this.operationQueue.delete(operation.id)
            console.log(`✅ Background recovery succeeded: ${operation.description}`)
          } catch (error) {
            operation.retries++
            
            if (operation.retries >= operation.maxRetries) {
              this.operationQueue.delete(operation.id)
              console.error(`❌ Background recovery failed permanently: ${operation.description}`, error)
            } else {
              console.warn(`⚠️ Background recovery failed (attempt ${operation.retries}/${operation.maxRetries}): ${operation.description}`)
            }
          }
        }

        // Wait before next processing cycle
        if (this.operationQueue.size > 0) {
          await this.sleep(10000) // 10 second intervals
        }
      }

      this.isProcessingQueue = false
      console.log('✅ Background cache recovery processing completed')
    }

    processQueue().catch(error => {
      console.error('❌ Background processing error:', error)
      this.isProcessingQueue = false
    })
  }

  /**
   * Emergency cache reset with recovery tracking
   */
  async emergencyReset(queryClient: QueryClient, reason: string): Promise<void> {
    console.warn(`🚨 Emergency cache reset triggered: ${reason}`)
    this.stats.emergencyResets++
    
    try {
      // Clear all cache
      await queryClient.clear()
      
      // Clear operation queue since cache is reset
      this.operationQueue.clear()
      
      console.log('✅ Emergency cache reset completed successfully')
    } catch (error) {
      console.error('❌ Emergency cache reset failed:', error)
      throw error
    }
  }

  /**
   * Get recovery service statistics
   */
  getStats(): RecoveryStats & { queueSize: number } {
    return {
      ...this.stats,
      queueSize: this.operationQueue.size
    }
  }

  /**
   * Clear statistics and queue (for testing/development)
   */
  reset(): void {
    this.operationQueue.clear()
    this.isProcessingQueue = false
    this.circuitBreakerState = 'CLOSED'
    this.circuitBreakerFailures = 0
    this.circuitBreakerLastFailure = 0
    this.recoveryTimes = []
    this.stats = {
      totalAttempts: 0,
      successfulRetries: 0,
      failedOperations: 0,
      emergencyResets: 0,
      queuedOperations: 0,
      fallbackStrategiesUsed: 0,
      networkErrors: 0,
      timeoutErrors: 0,
      conservativeRefreshes: 0,
      circuitBreakerTrips: 0,
      lastRecoveryAttempt: null,
      avgRecoveryTime: 0,
      criticalFailures: 0
    }
  }

  /**
   * Health check and diagnostics for the cache recovery system
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'critical'
    reasons: string[]
    recommendations: string[]
    metrics: RecoveryStats & { queueSize: number; failureRate: number }
  } {
    const reasons: string[] = []
    const recommendations: string[] = []
    
    // Calculate metrics
    const totalOperations = this.stats.totalAttempts
    const failureRate = totalOperations > 0 ? this.stats.failedOperations / totalOperations : 0
    const queueSize = this.operationQueue.size
    
    // Determine health status
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy'
    
    // Check failure rates
    if (failureRate > 0.5 && totalOperations > 10) {
      status = 'critical'
      reasons.push('High failure rate (>50%)')
      recommendations.push('Check network connectivity and server status')
    } else if (failureRate > 0.2 && totalOperations > 5) {
      status = 'degraded'
      reasons.push('Moderate failure rate (>20%)')
      recommendations.push('Monitor for recurring issues')
    }
    
    // Check queue size
    if (queueSize > 20) {
      status = 'critical'
      reasons.push(`Large operation queue (${queueSize} items)`)
      recommendations.push('Consider emergency cache reset - queue is critically large')
    } else if (queueSize > 10 && status === 'healthy') {
      status = 'degraded'
      reasons.push(`Growing operation queue (${queueSize} items)`)
      recommendations.push('Monitor queue size and consider intervention if it keeps growing')
    }
    
    // Check emergency reset frequency
    if (this.stats.emergencyResets > 5) {
      status = 'critical'
      reasons.push('Frequent emergency resets')
      recommendations.push('Investigate underlying cache infrastructure issues')
    } else if (this.stats.emergencyResets > 2 && status === 'healthy') {
      status = 'degraded'
      reasons.push('Multiple emergency resets occurred')
      recommendations.push('Review application cache usage patterns')
    }
    
    // Check error patterns
    if (this.stats.networkErrors > this.stats.totalAttempts * 0.3) {
      reasons.push('High network error rate')
      recommendations.push('Check network stability and API endpoints')
    }
    
    if (this.stats.timeoutErrors > this.stats.totalAttempts * 0.2) {
      reasons.push('High timeout error rate')
      recommendations.push('Consider increasing timeout values or optimizing queries')
    }
    
    // Provide positive feedback for healthy status
    if (status === 'healthy') {
      reasons.push('All metrics within normal ranges')
      recommendations.push('Cache recovery system is operating normally')
    }
    
    return {
      status,
      reasons,
      recommendations,
      metrics: {
        ...this.stats,
        queueSize,
        failureRate
      }
    }
  }

  /**
   * Advanced diagnostic method for troubleshooting
   */
  getDiagnostics(): {
    activeQueries: number
    oldestQueuedOperation: number | null
    errorPatterns: Record<string, number>
    recommendations: string[]
  } {
    const oldestOperation = Array.from(this.operationQueue.values())
      .reduce((oldest, op) => (!oldest || op.timestamp < oldest.timestamp) ? op : oldest, null as QueuedOperation | null)
    
    const errorPatterns = {
      'Network Errors': this.stats.networkErrors,
      'Timeout Errors': this.stats.timeoutErrors,
      'General Failures': this.stats.failedOperations - this.stats.networkErrors - this.stats.timeoutErrors,
    }
    
    const recommendations: string[] = []
    
    if (oldestOperation && Date.now() - oldestOperation.timestamp > 300000) { // 5 minutes
      recommendations.push('Oldest queued operation is very old - consider manual intervention')
    }
    
    if (this.stats.fallbackStrategiesUsed > this.stats.totalAttempts * 0.1) {
      recommendations.push('High fallback usage indicates primary operations are frequently failing')
    }
    
    return {
      activeQueries: 0, // This would need QueryClient access to calculate
      oldestQueuedOperation: oldestOperation?.timestamp || null,
      errorPatterns,
      recommendations
    }
  }

  /**
   * Force process the operation queue (manual intervention)
   */
  async forceProcessQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      console.log('Queue processing is already running')
      return
    }
    
    console.log('🔧 Force processing operation queue')
    this.startBackgroundProcessing()
  }

  /**
   * Utility: Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export singleton instance
export const cacheRecoveryService = new CacheRecoveryService()

/**
 * Enhanced cache utils with error recovery
 */
export const enhancedCacheUtils = {
  /**
   * Invalidate project with comprehensive error recovery
   */
  invalidateProject: (queryClient: QueryClient, projectId: string) => {
    return cacheRecoveryService.executeWithRecovery(
      queryClient,
      () => cacheUtils.invalidateProject(queryClient, projectId),
      `invalidateProject: ${projectId}`
    )
  },

  /**
   * Invalidate task with comprehensive error recovery
   */
  invalidateTask: (queryClient: QueryClient, taskId: string, projectId?: string) => {
    return cacheRecoveryService.executeWithRecovery(
      queryClient,
      () => cacheUtils.invalidateTask(queryClient, taskId, projectId),
      `invalidateTask: ${taskId} (project: ${projectId || 'none'})`
    )
  },

  /**
   * Invalidate repository with comprehensive error recovery
   */
  invalidateRepository: (queryClient: QueryClient, repositoryId: string, projectId?: string) => {
    return cacheRecoveryService.executeWithRecovery(
      queryClient,
      () => cacheUtils.invalidateRepository(queryClient, repositoryId, projectId),
      `invalidateRepository: ${repositoryId} (project: ${projectId || 'none'})`
    )
  },

  /**
   * Invalidate agent with comprehensive error recovery
   */
  invalidateAgent: (queryClient: QueryClient, agentId: string) => {
    return cacheRecoveryService.executeWithRecovery(
      queryClient,
      () => cacheUtils.invalidateAgent(queryClient, agentId),
      `invalidateAgent: ${agentId}`
    )
  },

  /**
   * Invalidate actor with comprehensive error recovery
   */
  invalidateActor: (queryClient: QueryClient, actorId: string, projectId?: string) => {
    return cacheRecoveryService.executeWithRecovery(
      queryClient,
      () => cacheUtils.invalidateActor(queryClient, actorId, projectId),
      `invalidateActor: ${actorId} (project: ${projectId || 'none'})`
    )
  },

  /**
   * Invalidate attachments with comprehensive error recovery
   */
  invalidateAttachments: (queryClient: QueryClient, taskId: string, projectId?: string) => {
    return cacheRecoveryService.executeWithRecovery(
      queryClient,
      () => cacheUtils.invalidateAttachments(queryClient, taskId, projectId),
      `invalidateAttachments: task ${taskId} (project: ${projectId || 'none'})`
    )
  },

  /**
   * Bulk invalidation with comprehensive error recovery
   */
  invalidateMultiple: (
    queryClient: QueryClient,
    operations: Array<{ type: 'project' | 'task' | 'repository' | 'agent' | 'actor'; id: string; projectId?: string }>
  ) => {
    return cacheRecoveryService.executeWithRecovery(
      queryClient,
      () => cacheUtils.invalidateMultiple(queryClient, operations),
      `invalidateMultiple: ${operations.length} operations`
    )
  },

  /**
   * Emergency operations
   */
  emergencyReset: (queryClient: QueryClient, reason: string) => {
    return cacheRecoveryService.emergencyReset(queryClient, reason)
  },

  /**
   * Get recovery statistics
   */
  getRecoveryStats: () => cacheRecoveryService.getStats(),

  /**
   * Reset recovery service (for development/testing)
   */
  resetRecoveryService: () => cacheRecoveryService.reset(),

  /**
   * Health and diagnostics
   */
  getHealthStatus: () => cacheRecoveryService.getHealthStatus(),
  
  getDiagnostics: () => cacheRecoveryService.getDiagnostics(),
  
  forceProcessQueue: () => cacheRecoveryService.forceProcessQueue(),

  /**
   * Batch invalidation with comprehensive error recovery
   */
  batchInvalidate: async (
    queryClient: QueryClient,
    operations: Array<{
      type: 'project' | 'task' | 'repository' | 'agent' | 'actor' | 'attachment'
      id: string
      projectId?: string
    }>
  ) => {
    const batchDescription = `batchInvalidate: ${operations.length} operations`
    
    return cacheRecoveryService.executeWithRecovery(
      queryClient,
      async () => {
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
            case 'attachment':
              return cacheUtils.invalidateAttachments(queryClient, op.id, op.projectId)
            default:
              return Promise.resolve()
          }
        })
        
        return Promise.all(promises)
      },
      batchDescription
    )
  },

  /**
   * Smart invalidation - automatically determines what to invalidate based on context
   */
  smartInvalidate: (queryClient: QueryClient, context: {
    entityType: 'project' | 'task' | 'repository' | 'agent' | 'actor'
    entityId: string
    projectId?: string
    action?: 'create' | 'update' | 'delete'
  }) => {
    const description = `smartInvalidate: ${context.action || 'modify'} ${context.entityType} ${context.entityId}`
    
    return cacheRecoveryService.executeWithRecovery(
      queryClient,
      async () => {
        // Base invalidation
        switch (context.entityType) {
          case 'project':
            await cacheUtils.invalidateProject(queryClient, context.entityId)
            break
          case 'task':
            await cacheUtils.invalidateTask(queryClient, context.entityId, context.projectId)
            break
          case 'repository':
            await cacheUtils.invalidateRepository(queryClient, context.entityId, context.projectId)
            break
          case 'agent':
            await cacheUtils.invalidateAgent(queryClient, context.entityId)
            break
          case 'actor':
            await cacheUtils.invalidateActor(queryClient, context.entityId, context.projectId)
            break
        }
        
        // Action-specific additional invalidations
        if (context.action === 'create') {
          // Invalidate lists when creating new entities
          await cacheUtils.invalidateProjectLists(queryClient)
        } else if (context.action === 'delete' && context.projectId) {
          // Invalidate project when deleting entities within it
          await cacheUtils.invalidateProject(queryClient, context.projectId)
        }
      },
      description
    )
  },
}
