import { WebSocket } from 'ws';
import { db } from '../db';
import { agentClients } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface ClaudeCodeClientOptions {
  claudeCodeUrl: string;
  agentToken: string;
}

export interface SessionOptions {
  projectPath: string;
  cwd: string;
  sessionId?: string;
  resume?: boolean;
  toolsSettings?: any;
  permissionMode?: string;
  soloUnicornTaskId?: string;
}

export class ClaudeCodeClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private options: ClaudeCodeClientOptions) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.options.claudeCodeUrl}/ws/agent?token=${encodeURIComponent(this.options.agentToken)}`;
      console.log('🤖 Connecting to Claude Code UI WebSocket:', wsUrl);

      // Clean up existing connection if any
      if (this.ws) {
        this.ws.removeAllListeners();
        this.ws.close();
        this.ws = null;
      }

      this.ws = new WebSocket(wsUrl);

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000); // 10 second timeout

      this.ws.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('🤖 Connected to Claude Code UI WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0; // Reset counter on successful connection
        resolve();
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing Claude Code message:', error);
        }
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(connectionTimeout);
        console.log(`🔌 Disconnected from Claude Code UI (code: ${code}, reason: ${reason.toString()})`);
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(connectionTimeout);
        console.error('Claude Code WebSocket error:', error);
        this.isConnected = false;
        reject(error);
      });
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Stop trying after max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log(`🛑 Max reconnection attempts (${this.maxReconnectAttempts}) reached. Stopping reconnection attempts.`);
      console.log("ℹ️  Claude Code UI may not be running. Please start it and restart Solo Unicorn server.");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(5000 * this.reconnectAttempts, 30000); // Exponential backoff, max 30s

    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay/1000}s`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error(`❌ Reconnect attempt ${this.reconnectAttempts} failed:`, error instanceof Error ? error.message : String(error));
        this.scheduleReconnect();
      }
    }, delay);
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'session-created':
        this.handleSessionCreated(message);
        break;
      case 'claude-response':
        this.handleClaudeResponse(message);
        break;
      case 'claude-complete':
        this.handleSessionComplete(message);
        break;
      case 'claude-error':
        this.handleError(message);
        break;
      case 'session_aborted':
        break;
    }
  }

  private async handleSessionCreated(message: any) {
    console.log('📝 Session created:', message.sessionId);
    
    // Create or update session in database if soloUnicornTaskId is provided
    if (message.soloUnicornTaskId) {
      try {
        const { db } = await import('../db/index');
        const { sessions, repoAgents } = await import('../db/schema');
        const { eq } = await import('drizzle-orm');
        
        // Check if session already exists (for resume case)
        const existingSession = await db.query.sessions.findFirst({
          where: eq(sessions.taskId, message.soloUnicornTaskId)
        });
        
        if (existingSession) {
          // Update existing session with real session ID
          await db
            .update(sessions)
            .set({
              agentSessionId: message.sessionId,
              status: 'active'
            })
            .where(eq(sessions.taskId, message.soloUnicornTaskId));
          console.log('📝 Session ID updated for task:', message.soloUnicornTaskId, '→', message.sessionId);
        } else {
          // Create new session record
          // First get the task to find the repo agent
          const { tasks } = await import('../db/schema');
          const task = await db.query.tasks.findFirst({
            where: eq(tasks.id, message.soloUnicornTaskId),
            with: { repoAgent: true }
          });
          
          if (task?.repoAgent) {
            await db.insert(sessions).values({
              agentSessionId: message.sessionId,
              taskId: message.soloUnicornTaskId,
              repoAgentId: task.repoAgent.id,
              status: 'active',
              startedAt: new Date()
            });
            console.log('📝 New session created for task:', message.soloUnicornTaskId, '→', message.sessionId);
          } else {
            console.error('❌ Could not find task or repo agent for:', message.soloUnicornTaskId);
          }
        }
      } catch (error) {
        console.error('❌ Failed to handle session creation:', error);
      }
    }
    
    await this.updateAgentState({
      lastSessionCreatedAt: new Date().toISOString(),
      lastMessagedAt: new Date().toISOString()
    });
  }

  private async handleClaudeResponse(message: any) {
    if (Array.isArray(message.data?.content)) {
      for (const part of message.data.content) {
        if (part.type === 'text' && part.text?.trim()) {
          await this.checkForRateLimit(part.text);
        }
      }
    }

    await this.updateAgentState({ lastMessagedAt: new Date().toISOString() });
  }

  private async checkForRateLimit(text: string) {
    try {
      if (typeof text !== 'string') return;

      const rateLimitMatch = text.match(/Claude AI usage limit reached\|(\d{10,13})/);
      if (rateLimitMatch) {
        const resetTimestamp = parseInt(rateLimitMatch[1], 10);
        const resetDate = resetTimestamp < 1e12
          ? new Date(resetTimestamp * 1000)
          : new Date(resetTimestamp);

        console.log('🚫 Rate limit detected. Reset time:', resetDate.toISOString());

        await this.updateAgentState({
          lastMessagedAt: new Date().toISOString(),
          rateLimitResetAt: resetDate.toISOString()
        });
      }
    } catch (error) {
      console.error('Error checking for rate limit:', error);
    }
  }

  private async handleSessionComplete(message: any) {
    console.log('✅ Session completed with exit code:', message.exitCode);
    await this.updateAgentState({
      lastSessionCompletedAt: new Date().toISOString(),
      lastMessagedAt: new Date().toISOString()
    });
  }

  private handleError(message: any) {
    console.error('❌ Claude Code error:', message.error);
  }

  private async updateAgentState(stateUpdate: {
    lastMessagedAt?: string;
    lastSessionCreatedAt?: string;
    lastSessionCompletedAt?: string;
    rateLimitResetAt?: string;
  }) {
    try {
      const existingAgent = await db.select().from(agentClients).where(eq(agentClients.type, 'CLAUDE_CODE')).limit(1);

      if (existingAgent.length > 0) {
        const currentState = existingAgent[0].state || {};
        const newState = { ...currentState, ...stateUpdate };

        await db.update(agentClients)
          .set({
            state: newState,
            updatedAt: new Date()
          })
          .where(eq(agentClients.id, existingAgent[0].id));
      } else {
        await db.insert(agentClients).values({
          type: 'CLAUDE_CODE',
          state: stateUpdate
        });
        console.log('➕ Created new agent with state:', stateUpdate);
      }
    } catch (error) {
      console.error('❌ Error updating agent state:', error);
    }
  }

  async startSession(command: string, options: SessionOptions): Promise<void> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Claude Code UI');
    }

    this.ws.send(JSON.stringify({
      type: 'start_session',
      sessionType: 'claude',
      command,
      options
    }));

    // Session creation will be handled via session-created message
  }

  async abortSession(sessionId: string): Promise<boolean> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Claude Code UI');
    }

    this.ws.send(JSON.stringify({
      type: 'abort_session',
      sessionType: 'claude',
      sessionId
    }));
    return true;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  async retryConnection(): Promise<boolean> {
    if (this.isConnected) {
      return true;
    }

    this.reconnectAttempts = 0;

    try {
      await this.connect();
      return true;
    } catch (error) {
      console.error('❌ Manual retry failed:', error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Client disconnect');
      }
      this.ws = null;
    }

    this.isConnected = false;
  }
}
