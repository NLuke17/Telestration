import ws from 'ws';
import type { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { WS_MAX_PAYLOAD_BYTES, WS_HEARTBEAT_INTERVAL_MS } from '../../config/constants';
import { logInfo, logError } from '../../utils/logger';

export interface WSServerConfig {
  server: Server;
  path?: string;
  maxPayload?: number;
}

export function createWSS(config: WSServerConfig): WebSocketServer {
  const wss = new ws.WebSocketServer({
    server: config.server,
    path: config.path || '/ws',
    maxPayload: config.maxPayload || WS_MAX_PAYLOAD_BYTES,
  });

  logInfo(`WebSocket server created on path ${config.path || '/ws'}`);
  return wss;
}

export function installHeartbeat(wss: WebSocketServer): () => void {
  const interval = setInterval(() => {
    wss.clients.forEach((socket: WebSocket & { isAlive?: boolean }) => {
      if (socket.isAlive === false) {
        return socket.terminate();
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, WS_HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(interval);
  });

  logInfo(`Heartbeat installed (interval: ${WS_HEARTBEAT_INTERVAL_MS}ms)`);

  return () => clearInterval(interval);
}

export function installConnectionGuards(wss: WebSocketServer): void {
  wss.on('connection', (client: WebSocket) => {
    client.on('error', (error: Error) => {
      logError('WebSocket error', { error: error.message });
    });
  });

  logInfo('Connection guards installed');
}
