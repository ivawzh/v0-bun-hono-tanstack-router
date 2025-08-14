import { WebSocket } from 'ws';

export interface ClaudeCodeSession {
  id: string;
  taskId: string;
  repoAgentId: string;
  status: 'starting' | 'active' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
}

export interface ClaudeCodeClientOptions {
  claudeCodeUrl: string; // e.g. 'ws://localhost:8888'
  agentToken: string; // AGENT_AUTH_TOKEN
}

export interface SessionOptions {
  projectPath: string;
  cwd: string;
  sessionId?: string;
  resume?: boolean;
  toolsSettings?: any;
  permissionMode?: string;
}

export class ClaudeCodeClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private activeSessions = new Map<string, ClaudeCodeSession>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(private options: ClaudeCodeClientOptions) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.options.claudeCodeUrl}/ws/agent?token=${encodeURIComponent(this.options.agentToken)}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('🤖 Connected to Claude Code UI WebSocket');
        this.isConnected = true;
        this.reconnectAttempts = 0; // Reset counter on successful connection
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing Claude Code message:', error);
        }
      });

      this.ws.on('close', () => {
        console.log('🔌 Disconnected from Claude Code UI');
        this.isConnected = false;
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        console.error('Claude Code WebSocket error:', error);
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
        console.error(`❌ Reconnect attempt ${this.reconnectAttempts} failed:`, error.message);
        this.scheduleReconnect();
      }
    }, delay);
  }

  private handleMessage(message: any) {
    console.log('📨 Claude Code message:', message.type);

    switch (message.type) {
      case 'active_sessions':
        // Handle active sessions response
        break;
      case 'session-created':
        // Handle new session created
        this.handleSessionCreated(message);
        break;
      case 'claude-response':
        // Handle Claude response
        this.handleClaudeResponse(message);
        break;
      case 'claude-complete':
        // Handle session completion
        this.handleSessionComplete(message);
        break;
      case 'claude-error':
        // Handle errors
        this.handleError(message);
        break;
      case 'session_aborted':
        // Handle session abortion confirmation
        break;
    }
  }

  private handleSessionCreated(message: any) {
    // Update session with the actual session ID from Claude
    console.log('📝 Session created:', message.sessionId);
  }

  private handleClaudeResponse(message: any) {
    // Handle streaming response from Claude
    if (message.data?.type === 'content_block_delta') {
      const text = message.data.delta?.text;
      if (text) {
        console.log('💬 Claude response chunk:', text.substring(0, 100) + '...');
      }
    }
  }

  private handleSessionComplete(message: any) {
    console.log('✅ Session completed with exit code:', message.exitCode);
  }

  private handleError(message: any) {
    console.error('❌ Claude Code error:', message.error);
  }

  async startSession(command: string, options: SessionOptions): Promise<string> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Claude Code UI');
    }

    const sessionMessage = {
      type: 'start_session',
      sessionType: 'claude',
      command,
      options
    };

    this.ws.send(JSON.stringify(sessionMessage));
    
    // Return a temporary session ID (will be updated when session is created)
    return Date.now().toString();
  }

  async abortSession(sessionId: string): Promise<boolean> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Claude Code UI');
    }

    const abortMessage = {
      type: 'abort_session',
      sessionType: 'claude',
      sessionId
    };

    this.ws.send(JSON.stringify(abortMessage));
    return true;
  }

  async getActiveSessions(): Promise<{ claude: string[], cursor: string[] }> {
    if (!this.isConnected || !this.ws) {
      throw new Error('Not connected to Claude Code UI');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for active sessions'));
      }, 5000);

      const messageHandler = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'active_sessions') {
            clearTimeout(timeout);
            this.ws!.off('message', messageHandler);
            resolve(message.data);
          }
        } catch (error) {
          // Ignore parsing errors for other messages
        }
      };

      this.ws.on('message', messageHandler);
      
      this.ws.send(JSON.stringify({
        type: 'get_active_sessions'
      }));
    });
  }

  // Method to check if connected
  get connected(): boolean {
    return this.isConnected;
  }

  // Method to retry connection (resets attempt counter)
  async retryConnection(): Promise<boolean> {
    if (this.isConnected) {
      return true;
    }

    // Reset attempt counter to allow new connection attempts
    this.reconnectAttempts = 0;
    
    try {
      await this.connect();
      return true;
    } catch (error) {
      console.error('❌ Manual retry failed:', error.message);
      return false;
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }
}