import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

    try {
      setConnectionStatus('connecting');
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8500/ws';
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // Subscribe to project updates if projectId is provided
        if (projectId) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            data: { projectId },
            timestamp: new Date().toISOString()
          }));
        }

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

          // Handle different message types
          switch (message.type) {
            case 'task.updated':
            case 'task.created':
            case 'task.deleted':
              // Invalidate task-related queries
              queryClient.invalidateQueries({ queryKey: ['projects', 'getWithTasks'] });
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              break;
              
            case 'agent.status.changed':
              // Invalidate agent-related queries  
              queryClient.invalidateQueries({ queryKey: ['agents'] });
              queryClient.invalidateQueries({ queryKey: ['repoAgents'] });
              break;
              
            case 'session.started':
            case 'session.completed':
            case 'session.failed':
              // Invalidate session-related queries
              queryClient.invalidateQueries({ queryKey: ['agents'] });
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              toast.info(`Agent session ${message.type.split('.')[1]}`);
              break;
              
            default:
              console.log('Unhandled WebSocket message type:', message.type);
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
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        wsRef.current = null;

        // Attempt to reconnect if enabled
        if (autoReconnect && !event.wasClean) {
          setConnectionStatus('error');
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect WebSocket...');
            connect();
          }, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('💥 WebSocket error:', error);
        setConnectionStatus('error');
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [projectId, onMessage, autoReconnect, reconnectInterval, queryClient]);

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
  }, [connect, disconnect]);

  // Reconnect when projectId changes
  useEffect(() => {
    if (isConnected && projectId && wsRef.current) {
      sendMessage({
        type: 'subscribe',
        data: { projectId }
      });
    }
  }, [projectId, isConnected, sendMessage]);

  return {
    isConnected,
    connectionStatus,
    connect,
    disconnect,
    sendMessage
  };
}