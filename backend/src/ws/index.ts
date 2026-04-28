import type { Server } from 'http';
import { createWSS, installHeartbeat, installConnectionGuards } from './core/wsServer';
import { buildWSContext } from './context/wsContext';
import { registerLobbyHandlers, broadcastLobbySnapshot, broadcastPresence } from './handlers/lobbyWs';
import { broadcastGameStarted, broadcastPhaseChange, runGuessSubmissionSideEffects } from './handlers/gameWs';
import { broadcast } from './core/wsUtils';
import { logInfo } from '../utils/logger';
import { clearRecapState } from './state/recapTracker';
import { processExpiredPhaseDeadlines } from '../services/phaseDeadlineService';
import { logError } from '../utils/logger';

export interface WSGatewayHandle {
  notifyLobbyUpdated(lobbyId: string): Promise<void>;
  notifyLobbyCreated(lobbyId: string): Promise<void>;
  notifyLobbyDeleted(lobbyId: string): Promise<void>;
  notifyPlayerJoined(lobbyId: string, userId: string): Promise<void>;
  notifyPlayerLeft(lobbyId: string, userId: string): Promise<void>;
  notifyGameStarted(lobbyId: string, roundId: string, roundNumber: number): Promise<void>;
  notifyPhaseChange(
    lobbyId: string,
    phase: 'DRAWING' | 'GUESSING' | 'RECAP' | 'VOTING',
    opts?: { endsAt?: number | null }
  ): Promise<void>;
  getPromptsForLobby(lobbyId: string, playerIds: string[]): string[];
  clearPromptsForLobby(lobbyId: string): void;
  /** Apply timed-out phases (auto-submit gaps + advance). Safe to call often. */
  processPhaseDeadlines(): Promise<void>;
  /** After HTTP guess submit: WS broadcast + phase advance (same as game:submit_guess). */
  notifyGuessSubmittedEffects(
    lobbyId: string,
    flipbookId: string,
    userId: string,
    guess: unknown
  ): Promise<void>;
}


export function setupWebSocket(server: Server): WSGatewayHandle {
  logInfo('Setting up WebSocket server...');

  const wss = createWSS({ server, path: '/ws' });

  installHeartbeat(wss);
  installConnectionGuards(wss);

  const ctx = buildWSContext(wss);

  // Register handlers
  registerLobbyHandlers(ctx);

  const PHASE_DEADLINE_TICK_MS = 1000;
  setInterval(() => {
    void processExpiredPhaseDeadlines(ctx).catch((e) =>
      logError('phase deadline tick failed', { error: (e as Error)?.message })
    );
  }, PHASE_DEADLINE_TICK_MS);

  logInfo('WebSocket server setup complete');

  return {
    async notifyLobbyUpdated(lobbyId: string): Promise<void> {
      await broadcastLobbySnapshot(ctx, lobbyId);
    },

    async notifyLobbyCreated(lobbyId: string): Promise<void> {
      await broadcastLobbySnapshot(ctx, lobbyId);
    },

    async notifyLobbyDeleted(lobbyId: string): Promise<void> {
      ctx.prompts.clearPrompts(lobbyId);
      clearRecapState(lobbyId);

      // Get all connections before removing them
      const connections = ctx.registry.getLobbyConnections(lobbyId);
      
      // Notify each client that the lobby was deleted
      broadcast(connections, {
        type: 'lobby:deleted',
        lobbyId,
      });
      
      // Remove connections from lobby registry
      for (const conn of connections) {
        ctx.registry.leaveLobby(lobbyId, conn.connId);
        
        // Clear presence tracking
        if (conn.userId) {
          ctx.presence.remove(lobbyId, conn.userId);
        }
      }
      
      logInfo('Lobby deleted, all connections removed', { lobbyId, connectionCount: connections.length });
    },

    async notifyPlayerJoined(lobbyId: string, _userId: string): Promise<void> {
      await broadcastLobbySnapshot(ctx, lobbyId);
      await broadcastPresence(ctx, lobbyId);
    },

    async notifyPlayerLeft(lobbyId: string, _userId: string): Promise<void> {
      await broadcastLobbySnapshot(ctx, lobbyId);
      await broadcastPresence(ctx, lobbyId);
    },

    async notifyGameStarted(lobbyId: string, roundId: string, roundNumber: number): Promise<void> {
      await broadcastGameStarted(ctx, lobbyId, roundId, roundNumber);
      await broadcastLobbySnapshot(ctx, lobbyId);
      // Clear prompts after game starts
      ctx.prompts.clearPrompts(lobbyId);
    },

    async notifyPhaseChange(
      lobbyId: string,
      phase: 'DRAWING' | 'GUESSING' | 'VOTING',
      opts?: { endsAt?: number }
    ): Promise<void> {
      await broadcastPhaseChange(ctx, lobbyId, phase, opts);
    },

    getPromptsForLobby(lobbyId: string, playerIds: string[]): string[] {
      return ctx.prompts.getPromptsArray(lobbyId, playerIds);
    },

    clearPromptsForLobby(lobbyId: string): void {
      ctx.prompts.clearPrompts(lobbyId);
    },

    async processPhaseDeadlines(): Promise<void> {
      await processExpiredPhaseDeadlines(ctx);
    },

    async notifyGuessSubmittedEffects(
      lobbyId: string,
      flipbookId: string,
      userId: string,
      guess: unknown
    ): Promise<void> {
      await runGuessSubmissionSideEffects(ctx, lobbyId, flipbookId, userId, guess);
    },
  };
}
