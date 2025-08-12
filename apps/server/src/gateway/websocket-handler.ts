import { db } from '../db';
import { tasks, agentSessions, projects } from '../db/schema/core';
import { eq, and } from 'drizzle-orm';

interface WSClient {
  agentId?: string;
  claudeProjectId?: string;
  authenticated: boolean;
}

const clients = new Map<any, WSClient>();
const claudeClients = new Map<string, any>(); // Track Claude Code connections by project ID

export const websocketHandler = {
  async message(ws: any, message: string | Buffer) {
    let client = clients.get(ws);
    if (!client) {
      client = { authenticated: false };
      clients.set(ws, client);
    }

    try {
      const data = JSON.parse(message.toString());
      console.log('[WS] Received message:', data.type);

      switch (data.type) {
        case 'auth':
          await handleAuth(ws, client, data);
          break;
        
        case 'claude_register':
          await handleClaudeRegister(ws, client, data);
          break;
        
        case 'task_request':
          await handleTaskRequest(ws, client, data);
          break;
        
        case 'task_claim':
          await handleTaskClaim(ws, client, data);
          break;
        
        case 'task_progress':
          await handleTaskProgress(ws, client, data);
          break;
        
        case 'task_complete':
          await handleTaskComplete(ws, client, data);
          break;
        
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        
        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`
          }));
      }
    } catch (error) {
      console.error('[WS] Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  },

  open(ws: any) {
    console.log('[WS] New connection');
    const client: WSClient = { authenticated: false };
    clients.set(ws, client);
    
    ws.send(JSON.stringify({
      type: 'connected',
      timestamp: new Date().toISOString()
    }));
  },

  close(ws: any) {
    const client = clients.get(ws);
    if (client?.claudeProjectId) {
      claudeClients.delete(client.claudeProjectId);
    }
    clients.delete(ws);
    console.log('[WS] Connection closed');
  },

  error(ws: any, error: Error) {
    console.error('[WS] Connection error:', error);
  }
};

async function handleAuth(ws: any, client: WSClient, data: any) {
  // Verify agent auth token
  const expectedToken = process.env.AGENT_AUTH_TOKEN || 'dev-token';
  
  console.log('[WS] Auth attempt with token:', data.token ? 'provided' : 'missing');
  console.log('[WS] Expected token:', expectedToken ? 'configured' : 'using default');
  
  if (data.token !== expectedToken) {
    ws.send(JSON.stringify({
      type: 'auth_failed',
      message: 'Invalid authentication token'
    }));
    return;
  }

  client.authenticated = true;
  client.agentId = data.agentId;

  // Store this as a Claude Code client if it identifies as such
  if (data.agentId === 'claude-code') {
    claudeClients.set('claude-code-default', ws);
    console.log('[WS] Claude Code UI connected and registered');
  }

  ws.send(JSON.stringify({
    type: 'auth_success',
    agentId: client.agentId
  }));

  console.log(`[WS] Client authenticated as agent ${client.agentId}`);
}

async function handleClaudeRegister(ws: any, client: WSClient, data: any) {
  // Register Claude Code UI connection
  client.claudeProjectId = data.claudeProjectId;
  claudeClients.set(data.claudeProjectId, ws);

  ws.send(JSON.stringify({
    type: 'claude_registered',
    claudeProjectId: data.claudeProjectId
  }));

  console.log(`[WS] Claude Code registered for project ${data.claudeProjectId}`);
}

async function handleTaskRequest(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) {
    ws.send(JSON.stringify({
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

    ws.send(JSON.stringify({
      type: 'tasks_available',
      tasks: tasksWithRepos.map(task => ({
        id: task.id,
        title: task.title,
        description: task.bodyMd,
        priority: task.priority,
        stage: task.stage,
        projectName: task.board?.project?.name,
        localRepoPath: task.board?.project?.localRepoPath,
        claudeProjectId: task.board?.project?.claudeProjectId
      }))
    }));
  } catch (error) {
    console.error('[WS] Error fetching tasks:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to fetch tasks'
    }));
  }
}

async function handleTaskClaim(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Not authenticated'
    }));
    return;
  }

  try {
    const { taskId } = data;
    
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
        status: 'in_progress'
      })
      .where(eq(tasks.id, taskId));

    ws.send(JSON.stringify({
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
      const claudeWs = claudeClients.get(task.board.project.claudeProjectId);
      if (claudeWs) {
        claudeWs.send(JSON.stringify({
          type: 'task_started',
          task: {
            id: task.id,
            title: task.title,
            description: task.bodyMd,
            localRepoPath: task.board.project.localRepoPath
          }
        }));
      }
    }
  } catch (error) {
    console.error('[WS] Error claiming task:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to claim task'
    }));
  }
}

async function handleTaskProgress(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) return;

  const { sessionId, progress, message: progressMessage } = data;

  // Broadcast progress to all authenticated clients
  clients.forEach((c, clientWs) => {
    if (c.authenticated) {
      clientWs.send(JSON.stringify({
        type: 'task_progress',
        sessionId,
        progress,
        message: progressMessage,
        timestamp: new Date().toISOString()
      }));
    }
  });
}

async function handleTaskComplete(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) return;

  try {
    const { sessionId, taskId, result } = data;

    // Update session state
    await db.update(agentSessions)
      .set({ 
        state: 'completed',
        endedAt: new Date()
      })
      .where(eq(agentSessions.id, sessionId));

    // Update task status
    await db.update(tasks)
      .set({ 
        status: 'done'
      })
      .where(eq(tasks.id, taskId));

    ws.send(JSON.stringify({
      type: 'task_completed',
      taskId,
      sessionId
    }));

    // Notify all connected clients
    clients.forEach((c, clientWs) => {
      if (c.authenticated) {
        clientWs.send(JSON.stringify({
          type: 'task_completed',
          taskId,
          sessionId,
          agentId: client.agentId
        }));
      }
    });
  } catch (error) {
    console.error('[WS] Error completing task:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to complete task'
    }));
  }
}

// Method to notify Claude Code about new tasks
export function notifyClaudeProject(claudeProjectId: string, task: any) {
  const ws = claudeClients.get(claudeProjectId);
  if (ws) {
    ws.send(JSON.stringify({
      type: 'new_task',
      task
    }));
  }
}

// Method to notify Claude Code UI when a task is started
export function notifyClaudeCodeAboutTask(task: any) {
  console.log('[WS] Notifying Claude Code about task:', task.title);
  
  // Try project-specific client first
  if (task.claudeProjectId) {
    const projectWs = claudeClients.get(task.claudeProjectId);
    if (projectWs) {
      console.log('[WS] Sending to project-specific Claude Code:', task.claudeProjectId);
      projectWs.send(JSON.stringify({
        type: 'new_task',
        task
      }));
      return;
    }
  }
  
  // Try default Claude Code client
  const defaultWs = claudeClients.get('claude-code-default');
  if (defaultWs) {
    console.log('[WS] Sending to default Claude Code client');
    defaultWs.send(JSON.stringify({
      type: 'new_task',
      task
    }));
  } else {
    console.log('[WS] No Claude Code client connected to receive task notification');
  }
}