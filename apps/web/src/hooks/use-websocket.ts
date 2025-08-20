import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cacheRecoveryService } from '@/lib/cache-recovery';

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
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    projectId,
    onMessage,
    autoReconnect = true,
    reconnectInterval = 3000
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

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

        // Clear any pending reconnection attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', message);

          // Selective cache invalidation based on message type (with error recovery)
          if (message.type === 'flush') {
            console.log('🔄 Flushing React Query cache');
            // Invalidate all queries with error recovery
            cacheRecoveryService.executeWithRecovery(
              queryClient,
              () => queryClient.invalidateQueries(),
              'WebSocket flush command'
            ).catch(error => {
              console.error('❌ Failed to flush cache via WebSocket:', error);
              // Trigger emergency reset as last resort
              cacheRecoveryService.emergencyReset(queryClient, 'WebSocket flush failure')
                .catch(resetError => console.error('❌ Emergency reset also failed:', resetError));
            });
          } else if (message.type === 'task.updated') {
            // Invalidate specific task data when task is updated remotely
            const { taskId, projectId } = message.data || {};
            if (taskId) {
              console.log('🔄 Invalidating task data:', taskId);
              
              const invalidateTask = () => queryClient.invalidateQueries({
                queryKey: ['tasks', 'detail', taskId],
              });
              
              const invalidateProject = projectId ? () => queryClient.invalidateQueries({
                queryKey: ['projects', 'getWithTasks', { input: { id: projectId } }],
                exact: true,
              }) : undefined;

              // Execute task invalidation with recovery
              cacheRecoveryService.executeWithRecovery(
                queryClient,
                invalidateTask,
                `WebSocket task.updated: ${taskId}`
              ).catch(error => console.error('❌ Failed to invalidate task via WebSocket:', error));

              // Execute project invalidation with recovery if projectId exists
              if (invalidateProject) {
                cacheRecoveryService.executeWithRecovery(
                  queryClient,
                  invalidateProject,
                  `WebSocket task.updated project: ${projectId}`
                ).catch(error => console.error('❌ Failed to invalidate project via WebSocket:', error));
              }
            }
          } else if (message.type === 'project.tasks.updated') {
            // Invalidate project tasks when tasks are updated remotely
            const { projectId } = message.data || {};
            if (projectId) {
              console.log('🔄 Invalidating project tasks:', projectId);
              
              cacheRecoveryService.executeWithRecovery(
                queryClient,
                () => queryClient.invalidateQueries({
                  queryKey: ['projects', 'getWithTasks', { input: { id: projectId } }],
                  exact: true,
                }),
                `WebSocket project.tasks.updated: ${projectId}`
              ).catch(error => console.error('❌ Failed to invalidate project tasks via WebSocket:', error));
            }
          }

          // Call custom message handler if provided
          if (onMessage) {
            onMessage(message);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
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
        if (autoReconnect && !event.wasClean && event.code !== 1000) {
          setConnectionStatus('error');
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect WebSocket...');
            connect();
          }, reconnectInterval);
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
  }, []); // Empty dependency array to only run on mount/unmount

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

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    sendMessage
  };
}