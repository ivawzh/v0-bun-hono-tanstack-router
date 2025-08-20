# Cache Utils Example Usage

This document demonstrates how to use the new standardized cache utilities.

## Before (Old Hardcoded Approach)

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function MyComponent({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();

  // ❌ Hardcoded query keys - prone to inconsistency  
  const { data: project } = useQuery({
    queryKey: ["projects", "getWithTasks", { input: { id: projectId } }],
    queryFn: () => orpc.projects.getWithTasks({ input: { id: projectId } }),
  });

  const createTask = useMutation({
    mutationFn: orpc.tasks.create,
    onSuccess: () => {
      // ❌ Manual invalidation with hardcoded keys
      queryClient.invalidateQueries({
        queryKey: ["projects", "getWithTasks", { input: { id: projectId } }],
        exact: true,
      });
    },
  });

  const deleteTask = useMutation({
    mutationFn: orpc.tasks.delete,
    onMutate: async (variables) => {
      // ❌ Manual optimistic updates - lots of boilerplate
      await queryClient.cancelQueries({
        queryKey: ["projects", "getWithTasks", { input: { id: projectId } }]
      });
      
      const previousData = queryClient.getQueryData([
        "projects", "getWithTasks", { input: { id: projectId } }
      ]);
      
      if (previousData) {
        queryClient.setQueryData([
          "projects", "getWithTasks", { input: { id: projectId } }
        ], (old: any) => ({
          ...old,
          tasks: old.tasks.filter((task: any) => task.id !== variables.id)
        }));
      }
      
      return { previousData };
    },
    onError: (error, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData([
          "projects", "getWithTasks", { input: { id: projectId } }
        ], context.previousData);
      }
    },
  });

  return <div>...</div>;
}
```

## After (New Standardized Approach)

```tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { useProjectCache } from "@/hooks/use-cache-utils";

function MyComponent({ projectId }: { projectId: string }) {
  // ✅ Project-specific cache utilities with consistent patterns
  const cache = useProjectCache(projectId);

  // ✅ Standardized query keys through cache utilities
  const { data: project } = useQuery({
    queryKey: cache.queryKeys.projects.withTasks(),
    queryFn: () => orpc.projects.getWithTasks({ input: { id: projectId } }),
  });

  const createTask = useMutation({
    mutationFn: orpc.tasks.create,
    onSuccess: () => {
      // ✅ Simple, standardized invalidation
      cache.invalidate();
    },
  });

  const deleteTask = useMutation({
    mutationFn: orpc.tasks.delete,
    onMutate: async (variables) => {
      // ✅ One-liner optimistic removal with automatic rollback
      return await cache.task.optimisticRemove(variables.id);
    },
    onError: (error, variables, context) => {
      // ✅ Simple rollback
      if (context?.previousData && context?.queryKey) {
        cache.optimistic.rollback(context.queryKey, context.previousData);
      }
    },
  });

  return <div>...</div>;
}
```

## Key Benefits

### 1. **Consistency**
- All query keys follow the same pattern
- No more typos or inconsistent key structures
- Type-safe query key generation

### 2. **Reduced Boilerplate** 
- `cache.invalidate()` vs manual `invalidateQueries()` calls
- `cache.task.optimisticRemove()` vs manual optimistic update setup
- Pre-configured project context

### 3. **Better Organization**
- Clear separation between cache logic and component logic
- Reusable patterns across components
- Easier testing and debugging

### 4. **Error Prevention**
- Type-safe operations
- Consistent rollback patterns
- Automatic context management

## Available Methods

### Project Cache (`useProjectCache(projectId)`)

```tsx
const cache = useProjectCache(projectId);

// Query keys
cache.queryKeys.projects.withTasks()
cache.queryKeys.tasks.byProject()
cache.queryKeys.repositories.list()
cache.queryKeys.agents.list(options)

// Invalidation
cache.invalidate() // Invalidates all project data
cache.task.invalidate(taskId) // Task-specific invalidation

// Optimistic updates  
cache.task.optimisticUpdate(taskId, updater)
cache.task.optimisticRemove(taskId)
cache.task.optimisticAdd(newTask)
```

### General Cache (`useCacheUtils()`)

```tsx
const cache = useCacheUtils();

// Multi-entity operations
cache.invalidateMultiple([
  { type: 'project', id: projectId },
  { type: 'task', id: taskId, projectId },
]);

// Emergency operations
cache.invalidateAll()
cache.resetCache()

// Direct access
cache.getCachedData(queryKey)
cache.setCachedData(queryKey, data)
```

## Migration Guide

1. **Replace hardcoded query keys**:
   ```tsx
   // Before
   ["projects", "getWithTasks", { input: { id } }]
   
   // After  
   cache.queryKeys.projects.withTasks()
   ```

2. **Simplify invalidation**:
   ```tsx
   // Before
   queryClient.invalidateQueries({
     queryKey: ["projects", "getWithTasks", { input: { id: projectId } }],
     exact: true
   });
   
   // After
   cache.invalidate()
   ```

3. **Use optimistic helpers**:
   ```tsx
   // Before: Manual optimistic update setup
   
   // After
   onMutate: (vars) => cache.task.optimisticRemove(vars.id)
   ```

The new utilities provide a clean, consistent, and type-safe approach to cache management while dramatically reducing boilerplate code.