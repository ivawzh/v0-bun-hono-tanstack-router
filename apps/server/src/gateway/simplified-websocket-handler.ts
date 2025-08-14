import { db } from '../db';
import { tasks, sessions, repoAgents } from '../db/schema';
import { eq, and } from 'drizzle-orm';

interface WSClient {
  clientType?: 'claude_code' | 'opencode';
  authenticated: boolean;
}

const clients = new Map<any, WSClient>();
let activeSession: string | null = null; // Track single active session

export const simplifiedWebsocketHandler = {
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
        case 'AGENT_REGISTER':
          await handleAgentRegister(ws, client, data);
          break;

        case 'TASK_REQUEST':
          await handleTaskRequest(ws, client, data);
          break;

        case 'TASK_ASSIGN':
          await handleTaskAssign(ws, client, data);
          break;

        case 'TASK_UPDATE':
          await handleTaskUpdate(ws, client, data);
          break;

        case 'SESSION_START':
          await handleSessionStart(ws, client, data);
          break;

        case 'SESSION_END':
          await handleSessionEnd(ws, client, data);
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
    clients.delete(ws);
    console.log('[WS] Connection closed');
  },

  error(ws: any, error: Error) {
    console.error('[WS] Connection error:', error);
  }
};

async function handleAgentRegister(ws: any, client: WSClient, data: any) {
  // Verify agent auth token
  const expectedToken = process.env.AGENT_AUTH_TOKEN || 'dev-token';

  console.log('[WS] Agent register attempt:', data.clientType);

  if (data.token !== expectedToken) {
    ws.send(JSON.stringify({
      type: 'auth_failed',
      message: 'Invalid authentication token'
    }));
    return;
  }

  client.authenticated = true;
  client.clientType = data.clientType; // claude_code, opencode, etc.

  ws.send(JSON.stringify({
    type: 'registered',
    clientType: client.clientType,
    canStartSession: activeSession === null
  }));

  console.log(`[WS] Agent registered: ${client.clientType}`);
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
      activeSession === null
    );

    const nextTask = compatibleTasks[0]; // Get highest priority ready task

    if (nextTask) {
      ws.send(JSON.stringify({
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
      ws.send(JSON.stringify({
        type: 'no_tasks_available',
        reason: activeSession ? 'session_active' : 'no_ready_tasks'
      }));
    }
  } catch (error) {
    console.error('[WS] Error fetching tasks:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to fetch tasks'
    }));
  }
}

async function handleTaskAssign(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) return;

  try {
    const { taskId } = data;

    // Enforce single session rule
    if (activeSession !== null) {
      ws.send(JSON.stringify({
        type: 'task_assign_failed',
        reason: 'session_already_active',
        activeSession: activeSession
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
      ws.send(JSON.stringify({
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

    activeSession = session.id;

    ws.send(JSON.stringify({
      type: 'task_assigned',
      taskId,
      sessionId: session.id
    }));

    // Notify all clients about session start
    broadcastToAll({
      type: 'session_started',
      sessionId: session.id,
      taskId,
      clientType: client.clientType
    });

    console.log(`[WS] Task ${taskId} assigned to ${client.clientType} session ${session.id}`);
  } catch (error) {
    console.error('[WS] Error assigning task:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to assign task'
    }));
  }
}

async function handleTaskUpdate(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) return;

  try {
    const { taskId, updates } = data;

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
    broadcastToAll({
      type: 'task_updated',
      taskId,
      updates
    });

    ws.send(JSON.stringify({
      type: 'task_update_success',
      taskId
    }));
  } catch (error) {
    console.error('[WS] Error updating task:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to update task'
    }));
  }
}

async function handleSessionStart(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) return;

  const { sessionId } = data;

  if (activeSession === sessionId) {
    await db.update(sessions)
      .set({ status: 'active' })
      .where(eq(sessions.id, sessionId));

    broadcastToAll({
      type: 'session_active',
      sessionId
    });
  }
}

async function handleSessionEnd(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) return;

  try {
    const { sessionId, taskId, completed } = data;

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
    activeSession = null;

    // Notify all clients
    broadcastToAll({
      type: 'session_ended',
      sessionId,
      taskId,
      completed
    });

    console.log(`[WS] Session ${sessionId} ended (completed: ${completed})`);
  } catch (error) {
    console.error('[WS] Error ending session:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to end session'
    }));
  }
}

function broadcastToAll(message: any) {
  clients.forEach((client, ws) => {
    if (client.authenticated) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[WS] Error broadcasting message:', error);
      }
    }
  });
}

// Public function to check if a session can be started
export function canStartSession(): boolean {
  return activeSession === null;
}

// Public function to get active session info
export function getActiveSession(): string | null {
  return activeSession;
}