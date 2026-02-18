/**
 * Lobby WebSocket handlers
 * Handles all lobby-related WebSocket events
 */

import { WebSocket } from 'ws';
import { WSContext } from '../context/wsContext';
import { ClientConn, createClientConn, setLobby } from '../core/clientConn';
import { send, broadcast } from '../core/wsUtils';
import { parseEnvelope, routeMessage, MessageHandler } from '../core/wsRouter';
import { WSClientMessage } from '../../types/ws';
import { logInfo, logError, logWarn } from '../../utils/logger';
import { normalizeRoomCode } from '../../utils/roomCode';

/**
 * Register all lobby-related WebSocket handlers
 */
export function registerLobbyHandlers(ctx: WSContext) {
  ctx.wss.on('connection', (ws: WebSocket) => {
    const conn = createClientConn(ws);
    ctx.registry.setConnection(conn.connId, conn);

    // Send welcome message
    send(conn, { type: 'welcome', message: 'Welcome to Telestration server' });

    // Setup heartbeat
    ws.on('pong', () => {
      conn.isAlive = true;
    });

    // Handle incoming messages
    ws.on('message', async (raw: Buffer) => {
      const msg = parseEnvelope(raw);
      if (!msg) {
        send(conn, { type: 'error', error: 'INVALID_MESSAGE', message: 'Invalid message format' });
        return;
      }

      // Route to handlers
      const handlers = createHandlerMap(ctx, conn);
      routeMessage(msg, handlers);
    });

    // Handle disconnection
    ws.on('close', () => {
      handleDisconnect(ctx, conn);
    });

    ws.on('error', (error) => {
      logError('WebSocket error', { connId: conn.connId, error: error.message });
    });
  });
}

/**
 * Create message handler map
 */
function createHandlerMap(ctx: WSContext, conn: ClientConn): Map<string, MessageHandler> {
  const handlers = new Map<string, MessageHandler>();

  handlers.set('ping', () => handlePing(conn));
  handlers.set('lobby:connect', (msg) => handleLobbyConnect(ctx, conn, msg as any));
  handlers.set('lobby:ready', (msg) => handleLobbyReady(ctx, conn, msg as any));
  handlers.set('lobby:disconnect', () => handleLobbyDisconnect(ctx, conn));

  return handlers;
}

/**
 * Handle ping message
 */
function handlePing(conn: ClientConn): void {
  send(conn, { type: 'pong' });
}

/**
 * Handle lobby connect request
 */
async function handleLobbyConnect(
  ctx: WSContext,
  conn: ClientConn,
  msg: { type: 'lobby:connect'; roomCode: string; userId?: string }
): Promise<void> {
  try {
    const roomCode = normalizeRoomCode(msg.roomCode);

    // Validate lobby exists
    const snapshot = await ctx.lobbySnapshotService.buildLobbySnapshotByRoomCode(roomCode);

    // Join lobby in registry
    ctx.registry.joinLobby(snapshot.id, conn.connId);
    setLobby(conn, snapshot.id);

    // Track presence if userId provided
    if (msg.userId) {
      conn.userId = msg.userId;
      ctx.presence.markConnected(snapshot.id, msg.userId);
    }

    // Confirm connection
    send(conn, {
      type: 'lobby:connected',
      roomCode: snapshot.roomCode,
      lobbyId: snapshot.id,
    });

    // Send lobby snapshot to this connection
    send(conn, {
      type: 'lobby:snapshot',
      snapshot,
    });

    // Broadcast presence to all in lobby
    await broadcastPresence(ctx, snapshot.id);

    logInfo('Client connected to lobby', {
      connId: conn.connId,
      userId: msg.userId,
      roomCode,
      lobbyId: snapshot.id,
    });
  } catch (error: any) {
    logError('Failed to connect to lobby', { error: error.message, roomCode: msg.roomCode });
    send(conn, {
      type: 'error',
      error: 'LOBBY_CONNECT_FAILED',
      message: error.message === 'LOBBY_NOT_FOUND' ? 'Lobby not found' : 'Failed to connect to lobby',
    });
  }
}

/**
 * Handle lobby ready status
 */
async function handleLobbyReady(
  ctx: WSContext,
  conn: ClientConn,
  msg: { type: 'lobby:ready'; ready: boolean }
): Promise<void> {
  if (!conn.lobbyId) {
    send(conn, { type: 'error', error: 'NOT_IN_LOBBY', message: 'Not connected to a lobby' });
    return;
  }

  // This is a placeholder for future ready-state tracking
  logInfo('Client ready status', { connId: conn.connId, ready: msg.ready, lobbyId: conn.lobbyId });
}

/**
 * Handle lobby disconnect
 */
async function handleLobbyDisconnect(ctx: WSContext, conn: ClientConn): Promise<void> {
  if (!conn.lobbyId) {
    return;
  }

  const lobbyId = conn.lobbyId;

  // Leave lobby in registry
  ctx.registry.leaveLobby(lobbyId, conn.connId);
  setLobby(conn, null);

  // Mark disconnected in presence
  if (conn.userId) {
    ctx.presence.markDisconnected(lobbyId, conn.userId);
  }

  // Broadcast updated presence
  await broadcastPresence(ctx, lobbyId);

  send(conn, { type: 'lobby:connected', roomCode: '', lobbyId: '' });

  logInfo('Client disconnected from lobby', { connId: conn.connId, lobbyId });
}

/**
 * Handle WebSocket connection close
 */
function handleDisconnect(ctx: WSContext, conn: ClientConn): void {
  if (conn.lobbyId) {
    const lobbyId = conn.lobbyId;

    // Mark disconnected in presence (will be in grace period)
    if (conn.userId) {
      ctx.presence.markDisconnected(lobbyId, conn.userId);
    }

    // Broadcast updated presence
    broadcastPresence(ctx, lobbyId).catch((error) => {
      logError('Failed to broadcast presence on disconnect', { error: error.message });
    });
  }

  ctx.registry.removeConnection(conn.connId);
  logInfo('Client disconnected', { connId: conn.connId });
}

/**
 * Broadcast lobby snapshot to all members
 */
export async function broadcastLobbySnapshot(ctx: WSContext, lobbyId: string): Promise<void> {
  try {
    const snapshot = await ctx.lobbySnapshotService.buildLobbySnapshot(lobbyId);
    const connections = ctx.registry.getLobbyConnections(lobbyId);

    broadcast(connections, {
      type: 'lobby:snapshot',
      snapshot,
    });

    logInfo('Broadcasted lobby snapshot', { lobbyId, connectionCount: connections.length });
  } catch (error: any) {
    logError('Failed to broadcast lobby snapshot', { lobbyId, error: error.message });
  }
}

/**
 * Broadcast presence info to all members
 */
export async function broadcastPresence(ctx: WSContext, lobbyId: string): Promise<void> {
  const presence = ctx.presence.getPresence(lobbyId);
  const connections = ctx.registry.getLobbyConnections(lobbyId);

  broadcast(connections, {
    type: 'lobby:presence',
    connectedUserIds: presence.connectedUserIds,
  });

  logInfo('Broadcasted presence', { lobbyId, connectedUsers: presence.connectedUserIds.length });
}
