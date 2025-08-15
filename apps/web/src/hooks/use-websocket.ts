import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

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

          // SIMPLIFIED: Just invalidate all queries on "flush" message
          if (message.type === 'flush') {
            console.log('🔄 Flushing React Query cache');
            queryClient.invalidateQueries();
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