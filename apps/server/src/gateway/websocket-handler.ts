import { db } from '../db';
import { tasks, sessions, projects, repoAgents } from '../db/schema/simplified';
import { eq, and } from 'drizzle-orm';

interface WSClient {
  clientType?: string; // claude_code, opencode, etc.
  clientId?: string;
  authenticated: boolean;
}

const clients = new Map<any, WSClient>();

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
        case 'agent_register':
          await handleAgentRegister(ws, client, data);
          break;

        case 'task_request':
          await handleTaskRequest(ws, client, data);
          break;

        case 'task_assign':
          await handleTaskAssign(ws, client, data);
          break;

        case 'task_update':
          await handleTaskUpdate(ws, client, data);
          break;

        case 'session_start':
          await handleSessionStart(ws, client, data);
          break;

        case 'session_end':
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
  const { clientType, clientId, capabilities } = data;
  
  // Simple authentication for simplified architecture
  client.authenticated = true;
  client.clientType = clientType;
  client.clientId = clientId;

  console.log(`[WS] Agent registered: ${clientType}:${clientId}`);

  ws.send(JSON.stringify({
    type: 'agent_registered',
    clientType,
    clientId,
    capabilities: capabilities || []
  }));

  // Send any available tasks for this client type
  await sendAvailableTasks(ws, client);
}

async function handleTaskRequest(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Not authenticated'
    }));
    return;
  }

  await sendAvailableTasks(ws, client);
}

async function sendAvailableTasks(ws: any, client: WSClient) {
  try {
    // Find ready tasks that match this client type
    const availableTasks = await db.query.tasks.findMany({
      where: and(
        eq(tasks.status, 'todo'),
        eq(tasks.ready, true)
      ),
      with: {
        project: true,
        repoAgent: true,
        actor: true
      }
    });

    // Filter tasks by client type
    const matchingTasks = availableTasks.filter(task => 
      task.repoAgent.clientType === client.clientType
    );

    // Sort by priority (P1 > P2 > P3 > P4 > P5)
    const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };
    matchingTasks.sort((a, b) => 
      priorityOrder[a.priority as keyof typeof priorityOrder] - 
      priorityOrder[b.priority as keyof typeof priorityOrder]
    );

    ws.send(JSON.stringify({
      type: 'tasks_available',
      tasks: matchingTasks.map(task => ({
        id: task.id,
        projectId: task.projectId,
        rawTitle: task.rawTitle,
        rawDescription: task.rawDescription,
        refinedTitle: task.refinedTitle,
        refinedDescription: task.refinedDescription,
        plan: task.plan,
        priority: task.priority,
        repoPath: task.repoAgent.repoPath,
        actorDescription: task.actor?.description,
        projectMemory: task.project.memory
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

async function handleTaskAssign(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) return;

  try {
    const { taskId } = data;

    // Create session
    const [session] = await db.insert(sessions)
      .values({
        taskId,
        repoAgentId: (await db.query.tasks.findFirst({
          where: eq(tasks.id, taskId)
        }))!.repoAgentId,
        status: 'starting'
      })
      .returning();

    // Update task status
    await db.update(tasks)
      .set({
        status: 'doing',
        stage: 'refine',
        updatedAt: new Date()
      })
      .where(eq(tasks.id, taskId));

    ws.send(JSON.stringify({
      type: 'task_assigned',
      taskId,
      sessionId: session.id
    }));

    // Broadcast to all clients
    broadcastToAll({
      type: 'task_status_changed',
      taskId,
      status: 'doing',
      stage: 'refine'
    });

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
    
    // Update task with provided fields
    await db.update(tasks)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(tasks.id, taskId));

    ws.send(JSON.stringify({
      type: 'task_updated',
      taskId,
      updates
    }));

    // Broadcast to all clients
    broadcastToAll({
      type: 'task_updated',
      taskId,
      updates
    });

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

  try {
    const { sessionId } = data;

    await db.update(sessions)
      .set({
        status: 'active',
        startedAt: new Date()
      })
      .where(eq(sessions.id, sessionId));

    ws.send(JSON.stringify({
      type: 'session_started',
      sessionId
    }));

  } catch (error) {
    console.error('[WS] Error starting session:', error);
  }
}

async function handleSessionEnd(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) return;

  try {
    const { sessionId, status: endStatus } = data;

    await db.update(sessions)
      .set({
        status: endStatus || 'completed',
        completedAt: new Date()
      })
      .where(eq(sessions.id, sessionId));

    // If session completed successfully, move task to done
    if (endStatus === 'completed') {
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId)
      });

      if (session) {
        await db.update(tasks)
          .set({
            status: 'done',
            stage: null,
            updatedAt: new Date()
          })
          .where(eq(tasks.id, session.taskId));

        broadcastToAll({
          type: 'task_status_changed',
          taskId: session.taskId,
          status: 'done',
          stage: null
        });
      }
    }

    ws.send(JSON.stringify({
      type: 'session_ended',
      sessionId,
      status: endStatus
    }));

  } catch (error) {
    console.error('[WS] Error ending session:', error);
  }
}

function broadcastToAll(message: any) {
  clients.forEach((client, ws) => {
    if (client.authenticated) {
      ws.send(JSON.stringify(message));
    }
  });
}

// Method to notify agents about new ready tasks
export function notifyAgentsOfNewTask(task: any) {
  broadcastToAll({
    type: 'new_task_available',
    task: {
      id: task.id,
      rawTitle: task.rawTitle,
      priority: task.priority,
      clientType: task.repoAgent?.clientType
    }
  });
}