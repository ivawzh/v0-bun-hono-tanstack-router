import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cacheRecoveryService, enhancedCacheUtils } from '@/lib/cache-recovery';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  projectId?: string;
  onMessage?: (message: WebSocketMessage) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  fallbackStrategy?: 'conservative' | 'aggressive' | 'minimal';
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    projectId,
    onMessage,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    fallbackStrategy = 'conservative'
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const queryClient = useQueryClient();
  const lastSuccessfulMessageRef = useRef<number>(Date.now());

  // Helper function to handle WebSocket messages with comprehensive error recovery
  const handleWebSocketMessage = useCallback(async (message: WebSocketMessage): Promise<void> => {
    switch (message.type) {
      case 'flush':
        console.log('🔄 Flushing React Query cache');
        // Invalidate all queries with error recovery
        await cacheRecoveryService.executeWithRecovery(
          queryClient,
          () => queryClient.invalidateQueries(),
          'WebSocket flush command',
          { fallbackStrategy }
        );
        break;

      case 'task.updated':
        await handleTaskUpdatedMessage(message);
        break;

      case 'project.tasks.updated':
        await handleProjectTasksUpdatedMessage(message);
        break;

      case 'cache.invalidate':
        await handleCacheInvalidateMessage(message);
        break;

      case 'agent.rate_limit_updated':
        await handleAgentRateLimitMessage(message);
        break;

      case 'task.approved':
        await handleTaskApprovedMessage(message);
        break;

      case 'task.rejected':
        await handleTaskRejectedMessage(message);
        break;

      default:
        console.log(`📨 Unknown WebSocket message type: ${message.type}`);
    }
  }, [queryClient, fallbackStrategy]);

  // Handle task.updated messages
  const handleTaskUpdatedMessage = useCallback(async (message: WebSocketMessage): Promise<void> => {
    const { taskId, projectId } = message.data || {};
    if (!taskId) return;

    console.log('🔄 Invalidating task data:', taskId);
    
    // Use enhanced cache utils for better error recovery
    await enhancedCacheUtils.smartInvalidate(queryClient, {
      entityType: 'task',
      entityId: taskId,
      projectId,
      action: 'update'
    });
  }, [queryClient]);

  // Handle project.tasks.updated messages
  const handleProjectTasksUpdatedMessage = useCallback(async (message: WebSocketMessage): Promise<void> => {
    const { projectId } = message.data || {};
    if (!projectId) return;

    console.log('🔄 Invalidating project tasks:', projectId);
    
    await enhancedCacheUtils.invalidateProject(queryClient, projectId);
  }, [queryClient]);

  // Handle cache.invalidate messages
  const handleCacheInvalidateMessage = useCallback(async (message: WebSocketMessage): Promise<void> => {
    const { operations } = message.data || {};
    if (!operations || !Array.isArray(operations)) return;

    console.log('🔄 Batch invalidating cache:', operations);
    
    await enhancedCacheUtils.batchInvalidate(queryClient, operations);
  }, [queryClient]);

  // Handle agent.rate_limit_updated messages
  const handleAgentRateLimitMessage = useCallback(async (message: WebSocketMessage): Promise<void> => {
    const { projectId, agentId } = message.data || {};
    if (!projectId || !agentId) return;

    console.log('🔄 Invalidating agent data due to rate limit update:', { projectId, agentId });
    
    // Invalidate agents queries for the specific project
    await enhancedCacheUtils.smartInvalidate(queryClient, {
      entityType: 'agent',
      entityId: agentId,
      projectId,
      action: 'update'
    });
  }, [queryClient]);

  // Handle task.approved messages
  const handleTaskApprovedMessage = useCallback(async (message: WebSocketMessage): Promise<void> => {
    const { taskId, projectId, task } = message.data || {};
    if (!taskId || !projectId) return;

    console.log('✅ Task approved - updating cache:', { taskId, projectId, taskList: task?.list });
    
    // Use enhanced cache utils to smartly update the task state
    await enhancedCacheUtils.smartInvalidate(queryClient, {
      entityType: 'task',
      entityId: taskId,
      projectId,
      action: 'update'
    });
  }, [queryClient]);

  // Handle task.rejected messages  
  const handleTaskRejectedMessage = useCallback(async (message: WebSocketMessage): Promise<void> => {
    const { taskId, projectId, task, iterationNumber, feedbackReason } = message.data || {};
    if (!taskId || !projectId) return;

    console.log('❌ Task rejected - updating cache:', { 
      taskId, 
      projectId, 
      taskList: task?.list, 
      iterationNumber,
      feedbackReason: feedbackReason?.slice(0, 50) + '...'
    });
    
    // Use enhanced cache utils to smartly update the task state
    await enhancedCacheUtils.smartInvalidate(queryClient, {
      entityType: 'task',
      entityId: taskId,
      projectId,
      action: 'update'
    });
  }, [queryClient]);

  // Handle WebSocket message processing failures
  const handleWebSocketFallback = useCallback((message: WebSocketMessage, error: unknown): void => {
    console.warn(`⚠️ WebSocket message fallback for type: ${message.type}`, error);
    
    // Use different fallback strategies based on message type and configuration
    switch (fallbackStrategy) {
      case 'aggressive':
        // For aggressive strategy, trigger broad cache invalidation
        cacheRecoveryService.executeWithRecovery(
          queryClient,
          () => queryClient.invalidateQueries(),
          `WebSocket fallback: ${message.type}`,
          { maxRetries: 1, fallbackStrategy: 'aggressive' }
        ).catch(() => console.error('❌ Aggressive WebSocket fallback failed'));
        break;
        
      case 'minimal':
        // For minimal strategy, only mark relevant queries as stale
        cacheRecoveryService.executeWithRecovery(
          queryClient,
          () => queryClient.invalidateQueries({ refetchType: 'none' }),
          `WebSocket fallback: ${message.type}`,
          { maxRetries: 1, fallbackStrategy: 'minimal' }
        ).catch(() => console.error('❌ Minimal WebSocket fallback failed'));
        break;
        
      case 'conservative':
      default:
        // For conservative strategy, invalidate based on message content
        if (message.data?.projectId) {
          enhancedCacheUtils.invalidateProject(queryClient, message.data.projectId)
            .catch(() => console.error('❌ Conservative WebSocket fallback failed'));
        } else {
          // General fallback - invalidate common queries
          cacheRecoveryService.executeWithRecovery(
            queryClient,
            () => Promise.all([
              queryClient.invalidateQueries({ queryKey: ['projects'] }),
              queryClient.invalidateQueries({ queryKey: ['tasks'] })
            ]),
            `WebSocket fallback: ${message.type}`,
            { maxRetries: 1, fallbackStrategy: 'conservative' }
          ).catch(() => console.error('❌ Conservative WebSocket fallback failed'));
        }
    }
  }, [queryClient, fallbackStrategy]);

  // Handle message parsing errors
  const handleParsingError = useCallback((rawData: string, error: unknown): void => {
    console.error('Failed to parse WebSocket message:', { rawData, error });
    
    // Try to extract useful information from raw data
    if (rawData.includes('flush')) {
      console.log('🔄 Detected flush command in malformed message, executing fallback');
      cacheRecoveryService.executeWithRecovery(
        queryClient,
        () => queryClient.invalidateQueries({ refetchType: 'none' }),
        'Malformed flush command fallback',
        { maxRetries: 1, fallbackStrategy }
      ).catch(() => console.error('❌ Parsing error fallback failed'));
    } else if (rawData.includes('task.approved') || rawData.includes('task.rejected')) {
      console.log('🔄 Detected task approval/rejection in malformed message, executing task fallback');
      cacheRecoveryService.executeWithRecovery(
        queryClient,
        () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
        'Malformed task approval/rejection fallback',
        { maxRetries: 1, fallbackStrategy }
      ).catch(() => console.error('❌ Task approval/rejection parsing error fallback failed'));
    }
  }, [queryClient, fallbackStrategy]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Prevent multiple concurrent connection attempts
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      setConnectionStatus('connecting');
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8500';
      console.log('🔌 Attempting WebSocket connection to:', wsUrl);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');

        // Clear any pending reconnection attempts and reset counter
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        lastSuccessfulMessageRef.current = Date.now();
        
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', message);

          // Handle different message types with comprehensive error recovery
          handleWebSocketMessage(message).catch(error => {
            console.error('❌ WebSocket message handling failed:', error);
            // Use fallback strategy based on configuration
            handleWebSocketFallback(message, error);
          });

          // Call custom message handler if provided
          if (onMessage) {
            onMessage(message);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          // Attempt to handle as raw text or trigger fallback
          handleParsingError(event.data, error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          url: wsUrl
        });
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Attempt to reconnect if enabled and not a clean close
        if (autoReconnect && !event.wasClean && event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          setConnectionStatus('error');
          reconnectAttemptsRef.current++;
          
          // Exponential backoff for reconnection
          const delay = Math.min(reconnectInterval * Math.pow(2, reconnectAttemptsRef.current - 1), 30000);
          
          console.log(`🔄 Attempting to reconnect WebSocket (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}) in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached, triggering fallback cache refresh');
          // Trigger a conservative cache refresh when WebSocket is permanently disconnected
          cacheRecoveryService.executeWithRecovery(
            queryClient,
            () => queryClient.invalidateQueries({ refetchType: 'none' }),
            'WebSocket permanent disconnection fallback',
            { fallbackStrategy: fallbackStrategy }
          ).catch(error => console.error('❌ Disconnection fallback failed:', error));
        }
      };

      ws.onerror = (error) => {
        console.error('💥 WebSocket error:', {
          error,
          url: wsUrl,
          readyState: ws.readyState,
          readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState]
        });
        setConnectionStatus('error');
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [autoReconnect, reconnectInterval, queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'timestamp'>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const fullMessage: WebSocketMessage = {
        ...message,
        timestamp: new Date().toISOString()
      };
      wsRef.current.send(JSON.stringify(fullMessage));
      console.log('📤 WebSocket message sent:', fullMessage);
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }, []);

  // Auto-connect on mount and clean up on unmount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]); // Include connect/disconnect for proper cleanup

  // Subscribe to project when projectId changes and we're connected
  useEffect(() => {
    if (isConnected && projectId && wsRef.current?.readyState === WebSocket.OPEN) {
      const message = {
        type: 'subscribe',
        data: { projectId },
        timestamp: new Date().toISOString()
      };
      wsRef.current.send(JSON.stringify(message));
      console.log('📤 WebSocket message sent:', message);
    }
  }, [projectId, isConnected]); // Remove sendMessage dependency

  // Health monitoring effect
  useEffect(() => {
    if (!isConnected) return;
    
    const healthCheckInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - lastSuccessfulMessageRef.current;
      const staleThreshold = 300000; // 5 minutes
      
      // If we haven't received any messages for a while, refresh cache conservatively
      if (timeSinceLastMessage > staleThreshold) {
        console.log('🏥 WebSocket health check: No recent messages, triggering conservative refresh');
        cacheRecoveryService.executeWithRecovery(
          queryClient,
          () => queryClient.invalidateQueries({ 
            refetchType: 'none',
            stale: true 
          }),
          'WebSocket health check - stale data refresh',
          { maxRetries: 1, fallbackStrategy: 'conservative' }
        ).catch(error => {
          console.warn('⚠️ Health check cache refresh failed:', error);
        });
        
        // Update timestamp to prevent repeated attempts
        lastSuccessfulMessageRef.current = Date.now();
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(healthCheckInterval);
  }, [isConnected, queryClient, fallbackStrategy]);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    sendMessage,
    
    // Health and recovery utilities
    health: {
      reconnectAttempts: reconnectAttemptsRef.current,
      maxReconnectAttempts,
      lastSuccessfulMessage: lastSuccessfulMessageRef.current,
      timeSinceLastMessage: () => Date.now() - lastSuccessfulMessageRef.current,
    },
    
    // Force cache refresh (useful for debugging)
    forceCacheRefresh: useCallback(async (strategy: 'conservative' | 'aggressive' | 'minimal' = 'conservative') => {
      console.log(`🔧 Force refreshing cache with ${strategy} strategy`);
      await cacheRecoveryService.executeWithRecovery(
        queryClient,
        () => queryClient.invalidateQueries(),
        'Manual cache refresh',
        { fallbackStrategy: strategy }
      );
    }, [queryClient]),
    
    // Reset connection (force reconnect)
    resetConnection: useCallback(() => {
      console.log('🔄 Resetting WebSocket connection');
      reconnectAttemptsRef.current = 0;
      disconnect();
      setTimeout(() => connect(), 1000);
    }, [connect, disconnect])
  };
}