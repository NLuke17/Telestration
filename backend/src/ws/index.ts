import type { Server } from 'http';
import { createWSS, installHeartbeat, installConnectionGuards } from './core/wsServer';
import { buildWSContext } from './context/wsContext';
import { registerLobbyHandlers, broadcastLobbySnapshot, broadcastPresence } from './handlers/lobbyWs';
import { logInfo } from '../utils/logger';

export interface WSGatewayHandle {
  notifyLobbyUpdated(lobbyId: string): Promise<void>;
  notifyLobbyCreated(lobbyId: string): Promise<void>;
  notifyLobbyDeleted(lobbyId: string): Promise<void>;
  notifyPlayerJoined(lobbyId: string, userId: string): Promise<void>;
  notifyPlayerLeft(lobbyId: string, userId: string): Promise<void>;
}


export function setupWebSocket(server: Server): WSGatewayHandle {
  logInfo('Setting up WebSocket server...');

  const wss = createWSS({ server, path: '/ws' });

  installHeartbeat(wss);
  installConnectionGuards(wss);

  const ctx = buildWSContext(wss);

  // Register handlers
  registerLobbyHandlers(ctx);

  logInfo('WebSocket server setup complete');

  return {
    async notifyLobbyUpdated(lobbyId: string): Promise<void> {
      await broadcastLobbySnapshot(ctx, lobbyId);
    },

    async notifyLobbyCreated(lobbyId: string): Promise<void> {
      await broadcastLobbySnapshot(ctx, lobbyId);
    },

    async notifyLobbyDeleted(lobbyId: string): Promise<void> {
      // Broadcast final snapshot or disconnect message
      const connections = ctx.registry.getLobbyConnections(lobbyId);
      for (const conn of connections) {
        ctx.registry.leaveLobby(lobbyId, conn.connId);
      }
      logInfo('Lobby deleted, all connections removed', { lobbyId });
    },

    async notifyPlayerJoined(lobbyId: string, userId: string): Promise<void> {
      await broadcastLobbySnapshot(ctx, lobbyId);
      await broadcastPresence(ctx, lobbyId);
    },

    async notifyPlayerLeft(lobbyId: string, userId: string): Promise<void> {
      await broadcastLobbySnapshot(ctx, lobbyId);
      await broadcastPresence(ctx, lobbyId);
    },
  };
}
