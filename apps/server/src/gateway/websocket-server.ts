import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from '../db';
import { tasks, agentSessions, projects, agents } from '../db/schema/core';
import { eq, and, isNull } from 'drizzle-orm';

interface WSClient {
  ws: WebSocket;
  agentId?: string;
  claudeProjectId?: string;
  authenticated: boolean;
}

export class AgentWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WSClient> = new Map();
  private claudeClients: Map<string, WSClient> = new Map(); // Track Claude Code connections

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
      case 'auth':
        await this.handleAuth(clientId, message);
        break;
      
      case 'claude_register':
        await this.handleClaudeRegister(clientId, message);
        break;
      
      case 'task_request':
        await this.handleTaskRequest(clientId, message);
        break;
      
      case 'task_claim':
        await this.handleTaskClaim(clientId, message);
        break;
      
      case 'task_progress':
        await this.handleTaskProgress(clientId, message);
        break;
      
      case 'task_complete':
        await this.handleTaskComplete(clientId, message);
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

  private async handleAuth(clientId: string, message: any) {
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
    client.agentId = message.agentId;

    client.ws.send(JSON.stringify({
      type: 'auth_success',
      agentId: client.agentId
    }));

    console.log(`[WS] Client authenticated: ${clientId} as agent ${client.agentId}`);
  }

  private async handleClaudeRegister(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Register Claude Code UI connection
    client.claudeProjectId = message.claudeProjectId;
    this.claudeClients.set(message.claudeProjectId, client);

    client.ws.send(JSON.stringify({
      type: 'claude_registered',
      claudeProjectId: message.claudeProjectId
    }));

    console.log(`[WS] Claude Code registered: ${clientId} for project ${message.claudeProjectId}`);
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
      // Find tasks assigned to this agent that are ready to work on
      const availableTasks = await db.query.tasks.findMany({
        where: and(
          eq(tasks.assignedAgentId, client.agentId!),
          eq(tasks.assignedActorType, 'agent'),
          eq(tasks.status, 'todo')
        ),
        with: {
          board: {
            with: {
              project: true
            }
          }
        }
      });

      // Filter for tasks in projects with local repos and Claude project IDs
      const tasksWithRepos = availableTasks.filter(task => 
        task.board?.project?.localRepoPath && 
        task.board?.project?.claudeProjectId
      );

      client.ws.send(JSON.stringify({
        type: 'tasks_available',
        tasks: tasksWithRepos.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          stage: task.stage,
          projectName: task.board?.project?.name,
          localRepoPath: task.board?.project?.localRepoPath,
          claudeProjectId: task.board?.project?.claudeProjectId
        }))
      }));
    } catch (error) {
      console.error('[WS] Error fetching tasks:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to fetch tasks'
      }));
    }
  }

  private async handleTaskClaim(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) {
      client?.ws.send(JSON.stringify({
        type: 'error',
        message: 'Not authenticated'
      }));
      return;
    }

    try {
      const { taskId } = message;
      
      // Create agent session
      const [session] = await db.insert(agentSessions)
        .values({
          agentId: client.agentId!,
          taskId,
          state: 'running'
        })
        .returning();

      // Update task status
      await db.update(tasks)
        .set({ 
          status: 'in_progress',
          activeSessionId: session.id
        })
        .where(eq(tasks.id, taskId));

      client.ws.send(JSON.stringify({
        type: 'task_claimed',
        taskId,
        sessionId: session.id
      }));

      // Notify Claude Code UI if connected
      const task = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
        with: {
          board: {
            with: {
              project: true
            }
          }
        }
      });

      if (task?.board?.project?.claudeProjectId) {
        const claudeClient = this.claudeClients.get(task.board.project.claudeProjectId);
        if (claudeClient) {
          claudeClient.ws.send(JSON.stringify({
            type: 'task_started',
            task: {
              id: task.id,
              title: task.title,
              description: task.description,
              localRepoPath: task.board.project.localRepoPath
            }
          }));
        }
      }
    } catch (error) {
      console.error('[WS] Error claiming task:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to claim task'
      }));
    }
  }

  private async handleTaskProgress(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) return;

    const { sessionId, progress, message: progressMessage } = message;

    // Broadcast progress to relevant clients
    this.broadcastToSession(sessionId, {
      type: 'task_progress',
      sessionId,
      progress,
      message: progressMessage,
      timestamp: new Date().toISOString()
    });
  }

  private async handleTaskComplete(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client || !client.authenticated) return;

    try {
      const { sessionId, taskId, result } = message;

      // Update session state
      await db.update(agentSessions)
        .set({ 
          state: 'completed',
          completedAt: new Date()
        })
        .where(eq(agentSessions.id, sessionId));

      // Update task status
      await db.update(tasks)
        .set({ 
          status: 'done',
          activeSessionId: null
        })
        .where(eq(tasks.id, taskId));

      client.ws.send(JSON.stringify({
        type: 'task_completed',
        taskId,
        sessionId
      }));

      // Notify all connected clients
      this.broadcastToAll({
        type: 'task_completed',
        taskId,
        sessionId,
        agentId: client.agentId
      });
    } catch (error) {
      console.error('[WS] Error completing task:', error);
      client.ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to complete task'
      }));
    }
  }

  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (client?.claudeProjectId) {
      this.claudeClients.delete(client.claudeProjectId);
    }
    this.clients.delete(clientId);
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private broadcastToSession(sessionId: string, message: any) {
    // Send to all clients interested in this session
    this.clients.forEach(client => {
      if (client.authenticated) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  private broadcastToAll(message: any) {
    this.clients.forEach(client => {
      if (client.authenticated) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Method to notify Claude Code about new tasks
  public notifyClaudeProject(claudeProjectId: string, task: any) {
    const client = this.claudeClients.get(claudeProjectId);
    if (client) {
      client.ws.send(JSON.stringify({
        type: 'new_task',
        task
      }));
    }
  }
}