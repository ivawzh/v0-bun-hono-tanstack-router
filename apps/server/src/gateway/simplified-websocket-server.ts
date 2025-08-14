import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '../db';
import { tasks, sessions, repoAgents } from '../db/schema';
import { eq, and } from 'drizzle-orm';

interface WSClient {
  ws: WebSocket;
  clientType?: 'claude_code' | 'opencode'; // Coding client type
  authenticated: boolean;
}

/**
 * Simplified WebSocket Server for Solo Unicorn
 * Implements least powerful principle: one user, one machine, one coding session at a time
 */
export class SimplifiedWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WSClient> = new Map();
  private activeSession: string | null = null; // Track single active session

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/agent'
    });

    this.setupWebSocketServer();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      const client: WSClient = {
        ws,
        authenticated: false
      };

      this.clients.set(clientId, client);
      console.log(`[WS] New connection: ${clientId}`);

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString()
      }));

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(clientId, message);
        } catch (error) {
          console.error('[WS] Error handling message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      ws.on('close', () => {
        console.log(`[WS] Connection closed: ${clientId}`);
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`[WS] Connection error for ${clientId}:`, error);
      });
    });
  }

  private async handleMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'AGENT_REGISTER':
        await this.handleAgentRegister(clientId, message);
        break;

      case 'TASK_REQUEST':
        await this.handleTaskRequest(clientId, message);
        break;

      case 'TASK_ASSIGN':
        await this.handleTaskAssign(clientId, message);
        break;

      case 'TASK_UPDATE':
        await this.handleTaskUpdate(clientId, message);
        break;

      case 'SESSION_START':
        await this.handleSessionStart(clientId, message);
        break;

      case 'SESSION_END':
        await this.handleSessionEnd(clientId, message);
        break;

      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        client.ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${message.type}`
        }));
    }
  }

  private async handleAgentRegister(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Verify agent auth token
    const expectedToken = process.env.AGENT_AUTH_TOKEN;
    if (message.token !== expectedToken) {
      client.ws.send(JSON.stringify({
        type: 'auth_failed',
        message: 'Invalid authentication token'
      }));
      return;
    }

    client.authenticated = true;
    client.clientType = message.clientType; // claude_code, opencode, etc.

    client.ws.send(JSON.stringify({
      type: 'registered',
      clientType: client.clientType,
      canStartSession: this.activeSession === null
    }));

    console.log(`[WS] Agent registered: ${clientId} (${client.clientType})`);
  }

  private async handleTaskRequest(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      client?.ws.send(JSON.stringify({
        type: 'error',
        message: 'Not authenticated'
      }));
      return;
    }

    try {
      // Find ready tasks for this client type
      const availableTasks = await db.query.tasks.findMany({
        where: and(
          eq(tasks.ready, true),
          eq(tasks.status, 'todo')
        ),
        with: {
          repoAgent: true,
          project: true,
          actor: true
        },
        orderBy: [tasks.priority, tasks.createdAt] // P1 first, then by creation order
      });

      // Filter for tasks that match this client type and no active session
      const compatibleTasks = availableTasks.filter(task => 
        task.repoAgent.clientType === client.clientType && 
        this.activeSession === null
      );

      const nextTask = compatibleTasks[0]; // Get highest priority ready task

      if (nextTask) {
        client.ws.send(JSON.stringify({
          type: 'task_available',
          task: {
            id: nextTask.id,
            rawTitle: nextTask.rawTitle,
            rawDescription: nextTask.rawDescription,
            refinedTitle: nextTask.refinedTitle,
            refinedDescription: nextTask.refinedDescription,
            plan: nextTask.plan,
            priority: nextTask.priority,
            attachments: nextTask.attachments,
            repoPath: nextTask.repoAgent.repoPath,
            actor: nextTask.actor,
            projectMemory: nextTask.project.memory
          }
        }));
      } else {
        client.ws.send(JSON.stringify({
          type: 'no_tasks_available',
          reason: this.activeSession ? 'session_active' : 'no_ready_tasks'
        }));
      }
    } catch (error) {
      console.error('[WS] Error fetching tasks:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to fetch tasks'
      }));
    }
  }

  private async handleTaskAssign(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) return;

    try {
      const { taskId } = message;

      // Enforce single session rule
      if (this.activeSession !== null) {
        client.ws.send(JSON.stringify({
          type: 'task_assign_failed',
          reason: 'session_already_active',
          activeSession: this.activeSession
        }));
        return;
      }

      // Get the task and repo agent
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
        with: {
          repoAgent: true
        }
      });

      if (!task) {
        client.ws.send(JSON.stringify({
          type: 'task_assign_failed',
          reason: 'task_not_found'
        }));
        return;
      }

      // Create session
      const [session] = await db.insert(sessions)
        .values({
          taskId,
          repoAgentId: task.repoAgentId,
          status: 'starting'
        })
        .returning();

      // Update task status and repo agent status
      await db.update(tasks)
        .set({
          status: 'doing',
          stage: 'refine'
        })
        .where(eq(tasks.id, taskId));

      await db.update(repoAgents)
        .set({
          status: 'active'
        })
        .where(eq(repoAgents.id, task.repoAgentId));

      this.activeSession = session.id;

      client.ws.send(JSON.stringify({
        type: 'task_assigned',
        taskId,
        sessionId: session.id
      }));

      // Notify all clients about session start
      this.broadcastToAll({
        type: 'session_started',
        sessionId: session.id,
        taskId,
        clientType: client.clientType
      });

      console.log(`[WS] Task ${taskId} assigned to ${client.clientType} session ${session.id}`);
    } catch (error) {
      console.error('[WS] Error assigning task:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to assign task'
      }));
    }
  }

  private async handleTaskUpdate(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) return;

    try {
      const { taskId, updates } = message;

      // Update task with agent progress
      const updateData: any = {};
      
      if (updates.refinedTitle) updateData.refinedTitle = updates.refinedTitle;
      if (updates.refinedDescription) updateData.refinedDescription = updates.refinedDescription;
      if (updates.plan) updateData.plan = updates.plan;
      if (updates.stage) updateData.stage = updates.stage;

      await db.update(tasks)
        .set(updateData)
        .where(eq(tasks.id, taskId));

      // Broadcast progress to all clients
      this.broadcastToAll({
        type: 'task_updated',
        taskId,
        updates
      });

      client.ws.send(JSON.stringify({
        type: 'task_update_success',
        taskId
      }));
    } catch (error) {
      console.error('[WS] Error updating task:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to update task'
      }));
    }
  }

  private async handleSessionStart(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) return;

    const { sessionId } = message;

    if (this.activeSession === sessionId) {
      await db.update(sessions)
        .set({ status: 'active' })
        .where(eq(sessions.id, sessionId));

      this.broadcastToAll({
        type: 'session_active',
        sessionId
      });
    }
  }

  private async handleSessionEnd(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) return;

    try {
      const { sessionId, taskId, completed } = message;

      // Update session
      await db.update(sessions)
        .set({
          status: completed ? 'completed' : 'failed',
          completedAt: new Date()
        })
        .where(eq(sessions.id, sessionId));

      // Update task status
      if (completed) {
        await db.update(tasks)
          .set({
            status: 'done',
            stage: null
          })
          .where(eq(tasks.id, taskId));
      } else {
        // If failed, move back to todo
        await db.update(tasks)
          .set({
            status: 'todo',
            stage: null,
            ready: false // Require human intervention
          })
          .where(eq(tasks.id, taskId));
      }

      // Get repo agent ID and mark as idle
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId)
      });

      if (session) {
        await db.update(repoAgents)
          .set({ status: 'idle' })
          .where(eq(repoAgents.id, session.repoAgentId));
      }

      // Clear active session
      this.activeSession = null;

      // Notify all clients
      this.broadcastToAll({
        type: 'session_ended',
        sessionId,
        taskId,
        completed
      });

      console.log(`[WS] Session ${sessionId} ended (completed: ${completed})`);
    } catch (error) {
      console.error('[WS] Error ending session:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to end session'
      }));
    }
  }

  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    this.clients.delete(clientId);

    // If this was the active session client, we might need to handle cleanup
    // For now, we keep the session active until explicitly ended
    console.log(`[WS] Client ${clientId} disconnected`);
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private broadcastToAll(message: any) {
    this.clients.forEach(client => {
      if (client.authenticated) {
        try {
          client.ws.send(JSON.stringify(message));
        } catch (error) {
          console.error('[WS] Error broadcasting message:', error);
        }
      }
    });
  }

  // Public method to check if a session can be started
  public canStartSession(): boolean {
    return this.activeSession === null;
  }

  // Public method to get active session info
  public getActiveSession(): string | null {
    return this.activeSession;
  }
}