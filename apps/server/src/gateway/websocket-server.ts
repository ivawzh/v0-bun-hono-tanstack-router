import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { websocketHandler } from './websocket-handler';

export class SoloUnicornWebSocketServer {
  private wss: WebSocketServer;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/agent'
    });

    this.setupWebSocketServer();
    console.log('[WS] Solo Unicorn WebSocket Server initialized on /ws/agent');
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('[WS] New connection from:', req.socket.remoteAddress);

      // Delegate to the websocket handler
      websocketHandler.open(ws);

      ws.on('message', async (data: Buffer) => {
        await websocketHandler.message(ws, data);
      });

      ws.on('close', () => {
        websocketHandler.close(ws);
      });

      ws.on('error', (error) => {
        websocketHandler.error(ws, error);
      });
    });

    this.wss.on('error', (error) => {
      console.error('[WS] WebSocket Server error:', error);
    });
  }

  public getConnectedClients(): number {
    return this.wss.clients.size;
  }

  public close() {
    this.wss.close(() => {
      console.log('[WS] WebSocket Server closed');
    });
  }
}