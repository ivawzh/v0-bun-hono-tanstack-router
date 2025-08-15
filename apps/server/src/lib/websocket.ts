import type { ServerWebSocket } from "bun";

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface ClientSubscription {
  projectId?: string;
  ws: ServerWebSocket<any>;
  lastPing?: number;
}

class WebSocketManager {
  private clients = new Map<string, ClientSubscription>();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start ping interval to keep connections alive
    this.pingInterval = setInterval(() => {
      this.pingAllClients();
    }, 30000); // 30 seconds
  }

  addClient(ws: ServerWebSocket<any>, clientId: string) {
    console.log(`🔌 WebSocket client connected: ${clientId}`);
    this.clients.set(clientId, { ws, lastPing: Date.now() });
    
    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection.established',
      data: { clientId, timestamp: new Date().toISOString() }
    });
  }

  removeClient(clientId: string) {
    console.log(`🔌 WebSocket client disconnected: ${clientId}`);
    this.clients.delete(clientId);
  }

  subscribeToProject(clientId: string, projectId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.projectId = projectId;
      console.log(`📡 Client ${clientId} subscribed to project ${projectId}`);
      
      this.sendToClient(clientId, {
        type: 'subscription.confirmed',
        data: { projectId }
      });
    }
  }

  broadcastToProject(projectId: string, message: Omit<WebSocketMessage, 'timestamp'>) {
    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: new Date().toISOString()
    };

    let sentCount = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (client.projectId === projectId) {
        try {
          client.ws.send(JSON.stringify(fullMessage));
          sentCount++;
        } catch (error) {
          console.error(`Failed to send message to client ${clientId}:`, error);
          // Remove dead client
          this.removeClient(clientId);
        }
      }
    }

    if (sentCount > 0) {
      console.log(`📤 Broadcasted ${message.type} to ${sentCount} clients in project ${projectId}`);
    }
  }

  broadcastToAll(message: Omit<WebSocketMessage, 'timestamp'>) {
    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: new Date().toISOString()
    };

    let sentCount = 0;
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.ws.send(JSON.stringify(fullMessage));
        sentCount++;
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }

    console.log(`📤 Broadcasted ${message.type} to ${sentCount} clients`);
  }

  sendToClient(clientId: string, message: Omit<WebSocketMessage, 'timestamp'>) {
    const client = this.clients.get(clientId);
    if (client) {
      const fullMessage: WebSocketMessage = {
        ...message,
        timestamp: new Date().toISOString()
      };

      try {
        client.ws.send(JSON.stringify(fullMessage));
        console.log(`📤 Sent ${message.type} to client ${clientId}`);
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  private pingAllClients() {
    const now = Date.now();
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.ws.ping();
        client.lastPing = now;
      } catch (error) {
        console.error(`Failed to ping client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getProjectClientCount(projectId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.projectId === projectId) {
        count++;
      }
    }
    return count;
  }

  shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all connections
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.ws.close(1000, 'Server shutdown');
      } catch (error) {
        console.error(`Failed to close connection for client ${clientId}:`, error);
      }
    }

    this.clients.clear();
    console.log('🛑 WebSocket manager shutdown complete');
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

// WebSocket message handlers
export function handleWebSocketMessage(ws: ServerWebSocket<any>, clientId: string, message: string) {
  try {
    const parsed: WebSocketMessage = JSON.parse(message);
    console.log(`📨 WebSocket message from ${clientId}:`, parsed);

    switch (parsed.type) {
      case 'subscribe':
        if (parsed.data?.projectId) {
          wsManager.subscribeToProject(clientId, parsed.data.projectId);
        }
        break;

      case 'ping':
        wsManager.sendToClient(clientId, { type: 'pong', data: {} });
        break;

      default:
        console.log(`⚠️ Unhandled WebSocket message type: ${parsed.type}`);
    }
  } catch (error) {
    console.error(`Failed to parse WebSocket message from ${clientId}:`, error);
    wsManager.sendToClient(clientId, {
      type: 'error',
      data: { message: 'Invalid message format' }
    });
  }
}

// Helper functions for broadcasting specific events
export function broadcastTaskUpdate(projectId: string, taskId: string, action: 'created' | 'updated' | 'deleted', task?: any) {
  wsManager.broadcastToProject(projectId, {
    type: `task.${action}`,
    data: { taskId, task }
  });
}

export function broadcastAgentStatusChange(agentId: string, status: string, details?: any) {
  wsManager.broadcastToAll({
    type: 'agent.status.changed',
    data: { agentId, status, details }
  });
}

export function broadcastSessionEvent(projectId: string, sessionId: string, event: 'started' | 'completed' | 'failed', details?: any) {
  wsManager.broadcastToProject(projectId, {
    type: `session.${event}`,
    data: { sessionId, details }
  });
}