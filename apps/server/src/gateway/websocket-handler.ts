import { db } from '../db';
import { tasks, agentSessions, projects, agents, agentIncidents } from '../db/schema/core';
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

        case 'agent_incident':
          await handleAgentIncident(ws, client, data);
          break;

        // Claude Code UI event handlers
        case 'claude_session_created':
          await handleClaudeSessionCreated(ws, client, data);
          break;

        case 'claude_session_progress':
          await handleClaudeSessionProgress(ws, client, data);
          break;

        case 'claude_session_completed':
          await handleClaudeSessionCompleted(ws, client, data);
          break;

        case 'claude_message_sent':
          await handleClaudeMessageSent(ws, client, data);
          break;

        case 'claude_message_received':
          await handleClaudeMessageReceived(ws, client, data);
          break;

        case 'claude_tool_use':
          await handleClaudeToolUse(ws, client, data);
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

    // SAFEGUARD: Do not auto-mark Done here. Leave status as-is; a verified success flow should handle Done.
    // await db.update(tasks)
    //   .set({
    //     status: 'done'
    //   })
    //   .where(eq(tasks.id, taskId));

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

async function resolveClaudeAgentId(): Promise<string> {
  // Try to find an existing Claude Code agent
  const existing = await db
    .select()
    .from(agents)
    .where(eq(agents.modelProvider as any, 'claude-code'))
    .limit(1);

  if (existing.length > 0) {
    return (existing[0] as any).id as string;
  }

  // Create a default agent if missing (single-user MVP)
  const created = await db
    .insert(agents)
    .values({
      name: 'Local Claude Code',
      role: 'Engineer',
      character: 'Expert software engineer with access to local development environment via Claude Code',
      runtime: 'windows-runner',
      modelProvider: 'claude-code',
      modelName: 'claude-3-5-sonnet-20241022',
      config: {}
    })
    .returning();

  return created[0].id as string;
}

async function handleAgentIncident(ws: any, client: WSClient, data: any) {
  if (!client.authenticated) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
    return;
  }

  try {
    const agentId = await resolveClaudeAgentId();

    const type = data?.incident?.type || 'error';
    const message = data?.incident?.message || null;
    const providerHint = data?.incident?.providerHint || null;
    const inferredResetAt = data?.incident?.inferredResetAt ? new Date(data.incident.inferredResetAt) : null;
    const nextRetryAt = data?.incident?.nextRetryAt ? new Date(data.incident.nextRetryAt) : inferredResetAt;

    // Persist incident
    const [incident] = await db
      .insert(agentIncidents)
      .values({
        agentId,
        type,
        message,
        providerHint,
        inferredResetAt: inferredResetAt ?? undefined,
        nextRetryAt: nextRetryAt ?? undefined
      })
      .returning();

    // Update agent state
    await db
      .update(agents)
      .set({
        state: type === 'rate_limit' ? 'rate_limited' : 'error',
        nextRetryAt: nextRetryAt ?? null,
        lastIncidentAt: new Date()
      })
      .where(eq(agents.id, agentId));

    ws.send(JSON.stringify({ type: 'agent_incident_logged', incidentId: incident.id, agentId }));
  } catch (error) {
    console.error('[WS] Error logging agent incident:', error);
    ws.send(JSON.stringify({ type: 'error', message: 'Failed to log agent incident' }));
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

  const taskMessage = {
    type: 'session_started',
    sessionId: task.sessionId,           // Solo Unicorn session ID
    taskId: task.id,
    taskTitle: task.title,
    taskDescription: task.description,
    projectPath: task.localRepoPath,
    claudeProjectId: task.claudeProjectId,
    priority: task.priority,
    stage: task.stage
  };

  // Try project-specific client first
  if (task.claudeProjectId) {
    const projectWs = claudeClients.get(task.claudeProjectId);
    if (projectWs) {
      console.log('[WS] Sending session start to project-specific Claude Code:', task.claudeProjectId);
      projectWs.send(JSON.stringify(taskMessage));
      return;
    }
  }

  // Try default Claude Code client
  const defaultWs = claudeClients.get('claude-code-default');
  if (defaultWs) {
    console.log('[WS] Sending session start to default Claude Code client');
    defaultWs.send(JSON.stringify(taskMessage));
  } else {
    console.log('[WS] No Claude Code client connected to receive task notification');
  }
}

// Claude Code UI Event Handlers
// These functions handle real-time events from Claude Code UI and can be used
// to update Solo Unicorn's UI, log activity, or trigger other workflows

async function handleClaudeSessionCreated(ws: any, client: WSClient, data: any) {
  console.log('[WS] Claude session created:', {
    soloUnicornSessionId: data.soloUnicornSessionId,
    claudeSessionId: data.claudeSessionId
  });

  // Here we could update a session mapping in the database or notify web UI
  // For now, just acknowledge the event
  ws.send(JSON.stringify({
    type: 'claude_session_created_ack',
    soloUnicornSessionId: data.soloUnicornSessionId,
    claudeSessionId: data.claudeSessionId
  }));

  // Broadcast to all authenticated clients (like Solo Unicorn web UI)
  clients.forEach((c, clientWs) => {
    if (c.authenticated && clientWs !== ws) {
      clientWs.send(JSON.stringify({
        type: 'claude_session_created',
        soloUnicornSessionId: data.soloUnicornSessionId,
        claudeSessionId: data.claudeSessionId,
        timestamp: data.timestamp
      }));
    }
  });
}

async function handleClaudeSessionProgress(ws: any, client: WSClient, data: any) {
  console.log('[WS] Claude session progress:', {
    soloUnicornSessionId: data.soloUnicornSessionId,
    progress: data.progress,
    message: data.message
  });

  // Broadcast progress to all authenticated clients
  clients.forEach((c, clientWs) => {
    if (c.authenticated && clientWs !== ws) {
      clientWs.send(JSON.stringify({
        type: 'claude_session_progress',
        soloUnicornSessionId: data.soloUnicornSessionId,
        claudeSessionId: data.claudeSessionId,
        progress: data.progress,
        message: data.message,
        timestamp: data.timestamp
      }));
    }
  });
}

async function handleClaudeSessionCompleted(ws: any, client: WSClient, data: any) {
  console.log('[WS] Claude session completed:', {
    soloUnicornSessionId: data.soloUnicornSessionId,
    result: data.result
  });

  // Here we could update task status in the database or trigger notifications
  // For now, just broadcast to other clients
  clients.forEach((c, clientWs) => {
    if (c.authenticated && clientWs !== ws) {
      clientWs.send(JSON.stringify({
        type: 'claude_session_completed',
        soloUnicornSessionId: data.soloUnicornSessionId,
        claudeSessionId: data.claudeSessionId,
        result: data.result,
        timestamp: data.timestamp
      }));
    }
  });
}

async function handleClaudeMessageSent(ws: any, client: WSClient, data: any) {
  console.log('[WS] Claude message sent:', {
    soloUnicornSessionId: data.soloUnicornSessionId,
    messagePreview: data.message?.content?.substring(0, 100) + '...'
  });

  // Broadcast to other clients for real-time activity monitoring
  clients.forEach((c, clientWs) => {
    if (c.authenticated && clientWs !== ws) {
      clientWs.send(JSON.stringify({
        type: 'claude_message_sent',
        soloUnicornSessionId: data.soloUnicornSessionId,
        claudeSessionId: data.claudeSessionId,
        message: data.message,
        timestamp: data.timestamp
      }));
    }
  });
}

async function handleClaudeMessageReceived(ws: any, client: WSClient, data: any) {
  console.log('[WS] Claude message received:', {
    soloUnicornSessionId: data.soloUnicornSessionId,
    responsePreview: data.response?.content?.substring(0, 100) + '...'
  });

  // Broadcast to other clients for real-time activity monitoring
  clients.forEach((c, clientWs) => {
    if (c.authenticated && clientWs !== ws) {
      clientWs.send(JSON.stringify({
        type: 'claude_message_received',
        soloUnicornSessionId: data.soloUnicornSessionId,
        claudeSessionId: data.claudeSessionId,
        response: data.response,
        timestamp: data.timestamp
      }));
    }
  });
}

async function handleClaudeToolUse(ws: any, client: WSClient, data: any) {
  console.log('[WS] Claude tool use:', {
    soloUnicornSessionId: data.soloUnicornSessionId,
    toolName: data.toolName,
    hasOutput: !!data.toolOutput
  });

  // Broadcast tool usage for real-time monitoring and logging
  clients.forEach((c, clientWs) => {
    if (c.authenticated && clientWs !== ws) {
      clientWs.send(JSON.stringify({
        type: 'claude_tool_use',
        soloUnicornSessionId: data.soloUnicornSessionId,
        claudeSessionId: data.claudeSessionId,
        toolName: data.toolName,
        toolInput: data.toolInput,
        toolOutput: data.toolOutput,
        timestamp: data.timestamp
      }));
    }
  });
}
