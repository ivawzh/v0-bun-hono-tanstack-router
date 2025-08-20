# Cache Management Guide

This guide covers the standardized cache management utilities in Solo Unicorn.

## Overview

The cache management system provides:
- **Standardized Query Keys**: Consistent key generation for all entities
- **Type-Safe Invalidation**: Centralized cache invalidation patterns
- **Error Handling**: Robust error handling with development logging
- **Optimistic Updates**: Utilities for smooth UI updates
- **Development Tools**: Debugging and performance monitoring utilities

## Quick Start

```typescript
import { useCacheUtils } from '@/hooks/use-cache-utils'

function MyComponent() {
  const cache = useCacheUtils()
  
  // Invalidate specific data
  await cache.invalidateProject(projectId)
  await cache.invalidateTask(taskId, projectId)
  
  // Optimistic updates
  const context = await cache.optimistic.updateTaskInProject(
    projectId, 
    taskId, 
    (task) => ({ ...task, status: 'completed' })
  )
  
  // On error, rollback
  if (error) {
    cache.optimistic.rollback(context.queryKey, context.previousData)
  }
}
```

## Query Key Structure

All query keys follow a hierarchical structure:

```typescript
// Projects
['projects'] // All projects
['projects', 'list', { input: filters }] // Project list with filters
['projects', 'detail', projectId] // Single project
['projects', 'getWithTasks', { input: { id: projectId } }] // Project with tasks

// Tasks
['tasks'] // All tasks
['tasks', 'byProject', projectId] // Tasks by project
['tasks', 'detail', taskId] // Single task

// And so on for repositories, agents, actors, attachments, auth...
```

## Cache Invalidation Patterns

### Standard Invalidation
```typescript
// Invalidate all project-related data
cache.invalidateProject(projectId) // Invalidates project, tasks, repos, actors

// Invalidate specific task and related data
cache.invalidateTask(taskId, projectId) // Invalidates task, attachments, and project

// Invalidate multiple entities at once
cache.invalidateMultiple([
  { type: 'project', id: projectId },
  { type: 'task', id: taskId, projectId },
])
```

### Project-Scoped Operations
```typescript
import { useProjectCache } from '@/hooks/use-cache-utils'

function ProjectComponent({ projectId }: { projectId: string }) {
  const cache = useProjectCache(projectId)
  
  // Pre-configured for this project
  await cache.invalidate() // Invalidates entire project
  
  // Task operations within project
  await cache.task.invalidate(taskId)
  await cache.task.optimisticUpdate(taskId, updater)
  
  // Access project-scoped query keys
  const projectKey = cache.queryKeys.projects.withTasks()
  const tasksKey = cache.queryKeys.tasks.byProject()
}
```

## Optimistic Updates

For smooth user experience during mutations:

```typescript
// In your mutation onMutate
const context = await cache.optimistic.updateTaskInProject(
  projectId,
  taskId,
  (task) => ({ ...task, title: newTitle })
)

// Store context for potential rollback
return { context }

// In your mutation onError
const { context } = mutationContext
cache.optimistic.rollback(context.queryKey, context.previousData)

// In your mutation onSettled
// Cache will be automatically revalidated
```

## Error Handling

The cache utilities include built-in error handling:

- **Development Mode**: Detailed error logging and warnings
- **Production Mode**: Graceful failure handling without breaking UI
- **Promise.allSettled**: Partial failures don't stop other operations

```typescript
// Errors are logged but don't throw by default
await cache.invalidateProject(projectId) // Won't throw even if some queries fail

// Force error throwing if needed
try {
  await cache.invalidateProject(projectId)
} catch (error) {
  // Handle critical cache failures
}
```

## Development Tools

### Debugging Active Queries
```typescript
// Log all active queries in console
cache.dev?.logActiveQueries()
```

### Performance Monitoring
```typescript
// Enable performance monitoring for cache operations
cache.dev?.enablePerformanceMonitoring()
// Will log timing for all cache invalidations
```

### Manual Cache Management
```typescript
// Clear specific entity from cache
cache.dev?.clearEntity('projects', projectId)
cache.dev?.clearEntity('tasks') // Clear all tasks

// Validate query key structure
cache.dev?.validateQueryKey(queryKey)
```

### Emergency Operations
```typescript
// Clear all cached data
cache.resetCache()

// Invalidate everything
cache.invalidateAll()
```

## Migration from Hardcoded Keys

Replace hardcoded query keys with the standardized system:

```typescript
// ❌ Before (hardcoded)
queryClient.invalidateQueries({ queryKey: ['v2-task', taskId] })
queryClient.invalidateQueries({ queryKey: ['v2-project-tasks'] })

// ✅ After (standardized)
cache.invalidateTask(taskId, projectId)
```

## Best Practices

1. **Use Specific Invalidation**: Prefer `invalidateTask()` over `invalidateAll()`
2. **Include Context**: Always pass `projectId` when available for complete invalidation
3. **Handle Optimistic Updates**: Use the optimistic utilities for smooth UX
4. **Leverage Development Tools**: Use `cache.dev.*` utilities during development
5. **Error Boundaries**: Don't rely on cache operations for critical error handling

## File Locations

- **Query Keys**: `/libs/query-keys.ts`
- **React Hooks**: `/hooks/use-cache-utils.ts`
- **Usage Examples**: Search codebase for `useCacheUtils` imports

## Contributing

When adding new entities:

1. Add query key factory to `queryKeys` object
2. Add invalidation utility to `cacheUtils`
3. Add hook method to `useCacheUtils`
4. Update this documentation
5. Add TypeScript types as needed