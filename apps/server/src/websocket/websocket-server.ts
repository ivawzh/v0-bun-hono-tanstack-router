import type { ServerWebSocket } from "bun";

interface ClientSubscription {
  projectId?: string;
  ws: ServerWebSocket<any>;
  lastPing?: number;
}

class WebSocketServer {
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

  // Just broadcast a "flush" message to invalidate all queries
  broadcastFlush(projectId?: string) {
    const message = {
      type: 'flush',
      data: { projectId, timestamp: new Date().toISOString() }
    };

    let sentCount = 0;
    for (const [clientId, client] of this.clients.entries()) {
      // If projectId is specified, only send to clients subscribed to that project
      // If no projectId, send to all clients
      if (!projectId || client.projectId === projectId) {
        try {
          client.ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`Failed to send flush to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }

    if (sentCount > 0) {
      console.log(`📤 Broadcasted flush to ${sentCount} clients${projectId ? ` in project ${projectId}` : ''}`);
    }
  }

  // Broadcast agent rate limit updates
  broadcastAgentRateLimit(projectId: string, agentId: string, rateLimitResetAt: Date | null) {
    const message = {
      type: 'agent.rate_limit_updated',
      data: {
        projectId,
        agentId,
        rateLimitResetAt: rateLimitResetAt?.toISOString() || null,
        timestamp: new Date().toISOString()
      }
    };

    let sentCount = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (client.projectId === projectId) {
        try {
          client.ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`Failed to send rate limit update to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }

    if (sentCount > 0) {
      console.log(`📤 Broadcasted agent rate limit update to ${sentCount} clients in project ${projectId}`);
    }
  }

  // Broadcast task approval with detailed state changes
  broadcastTaskApproved(projectId: string, taskData: any) {
    const message = {
      type: 'task.approved',
      data: {
        projectId,
        taskId: taskData.id,
        task: taskData,
        timestamp: new Date().toISOString()
      }
    };

    let sentCount = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (client.projectId === projectId) {
        try {
          client.ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`Failed to send task approved update to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }

    if (sentCount > 0) {
      console.log(`📤 Broadcasted task approved update to ${sentCount} clients in project ${projectId}`);
    }
  }

  // Broadcast task rejection with detailed state changes
  broadcastTaskRejected(projectId: string, taskData: any, iterationNumber: number, feedbackReason: string) {
    const message = {
      type: 'task.rejected',
      data: {
        projectId,
        taskId: taskData.id,
        task: taskData,
        iterationNumber,
        feedbackReason,
        timestamp: new Date().toISOString()
      }
    };

    let sentCount = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (client.projectId === projectId) {
        try {
          client.ws.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`Failed to send task rejected update to client ${clientId}:`, error);
          this.removeClient(clientId);
        }
      }
    }

    if (sentCount > 0) {
      console.log(`📤 Broadcasted task rejected update to ${sentCount} clients in project ${projectId}`);
    }
  }

  sendToClient(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.ws.send(JSON.stringify({
          ...message,
          timestamp: new Date().toISOString()
        }));
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
export const wsManager = new WebSocketServer();

// WebSocket message handlers
export function handleWebSocketMessage(ws: ServerWebSocket<any>, clientId: string, message: string) {
  try {
    const parsed = JSON.parse(message);
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

export function broadcastFlush(projectId?: string) {
  wsManager.broadcastFlush(projectId);
}

export function broadcastAgentRateLimit(projectId: string, agentId: string, rateLimitResetAt: Date | null) {
  wsManager.broadcastAgentRateLimit(projectId, agentId, rateLimitResetAt);
}

export function broadcastTaskApproved(projectId: string, taskData: any) {
  wsManager.broadcastTaskApproved(projectId, taskData);
}

export function broadcastTaskRejected(projectId: string, taskData: any, iterationNumber: number, feedbackReason: string) {
  wsManager.broadcastTaskRejected(projectId, taskData, iterationNumber, feedbackReason);
}
