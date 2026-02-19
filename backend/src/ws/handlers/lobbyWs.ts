import { WebSocket } from 'ws';
import { WSContext } from '../context/wsContext';
import { ClientConn, createClientConn, setLobby } from '../core/clientConn';
import { send, broadcast } from '../core/wsUtils';
import { parseEnvelope, routeMessage, MessageHandler } from '../core/wsRouter';
import { WSClientMessage } from '../../types/ws';
import { logInfo, logError, logWarn } from '../../utils/logger';
import { normalizeRoomCode } from '../../utils/roomCode';

export function registerLobbyHandlers(ctx: WSContext) {
  ctx.wss.on('connection', (ws: WebSocket & { isAlive?: boolean }) => {
    const conn = createClientConn(ws);
    ctx.registry.setConnection(conn.connId, conn);

    // Initialize heartbeat on raw WebSocket (used by installHeartbeat)
    ws.isAlive = true;

    // Send welcome message
    send(conn, { type: 'welcome', message: 'Welcome to Telestration server' });

    // Setup heartbeat - must set isAlive on raw WebSocket, not just on wrapper
    ws.on('pong', () => {
      ws.isAlive = true;
      conn.isAlive = true; // Also update wrapper for consistency
    });

    ws.on('message', async (raw: Buffer) => {
      const msg = parseEnvelope(raw);
      if (!msg) {
        send(conn, { type: 'error', error: 'INVALID_MESSAGE', message: 'Invalid message format' });
        return;
      }

      const handlers = createHandlerMap(ctx, conn);
      routeMessage(msg, handlers);
    });

    ws.on('close', () => {
      handleDisconnect(ctx, conn);
    });

    ws.on('error', (error) => {
      logError('WebSocket error', { connId: conn.connId, error: error.message });
    });
  });
}

function createHandlerMap(ctx: WSContext, conn: ClientConn): Map<string, MessageHandler> {
  const handlers = new Map<string, MessageHandler>();

  handlers.set('ping', () => handlePing(conn));
  handlers.set('lobby:connect', (msg) => handleLobbyConnect(ctx, conn, msg as any));
  handlers.set('lobby:ready', (msg) => handleLobbyReady(ctx, conn, msg as any));
  handlers.set('lobby:disconnect', () => handleLobbyDisconnect(ctx, conn));

  return handlers;
}

function handlePing(conn: ClientConn): void {
  send(conn, { type: 'pong' });
}

async function handleLobbyConnect(
  ctx: WSContext,
  conn: ClientConn,
  msg: { type: 'lobby:connect'; roomCode: string; userId?: string }
): Promise<void> {
  try {
    const roomCode = normalizeRoomCode(msg.roomCode);

    const snapshot = await ctx.lobbySnapshotService.buildLobbySnapshotByRoomCode(roomCode);

    ctx.registry.joinLobby(snapshot.id, conn.connId);
    setLobby(conn, snapshot.id);

    // Handle user authentication
    // TODO: Replace this with proper JWT/session validation
    if (msg.userId) {
      conn.userId = msg.userId;
      ctx.presence.markConnected(snapshot.id, msg.userId);
    }

    send(conn, {
      type: 'lobby:connected',
      roomCode: snapshot.roomCode,
      lobbyId: snapshot.id,
    });

    send(conn, {
      type: 'lobby:snapshot',
      snapshot,
    });

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

async function handleLobbyReady(
  ctx: WSContext,
  conn: ClientConn,
  msg: { type: 'lobby:ready'; ready: boolean }
): Promise<void> {
  if (!conn.lobbyId) {
    send(conn, { type: 'error', error: 'NOT_IN_LOBBY', message: 'Not connected to a lobby' });
    return;
  }

  logInfo('Client ready status', { connId: conn.connId, ready: msg.ready, lobbyId: conn.lobbyId });
}

async function handleLobbyDisconnect(ctx: WSContext, conn: ClientConn): Promise<void> {
  if (!conn.lobbyId) {
    return;
  }

  const lobbyId = conn.lobbyId;

  ctx.registry.leaveLobby(lobbyId, conn.connId);
  setLobby(conn, null);

  if (conn.userId) {
    ctx.presence.markDisconnected(lobbyId, conn.userId);
  }

  await broadcastPresence(ctx, lobbyId);

  send(conn, { type: 'lobby:connected', roomCode: '', lobbyId: '' });

  logInfo('Client disconnected from lobby', { connId: conn.connId, lobbyId });
}

function handleDisconnect(ctx: WSContext, conn: ClientConn): void {
  if (conn.lobbyId) {
    const lobbyId = conn.lobbyId;

    if (conn.userId) {
      ctx.presence.markDisconnected(lobbyId, conn.userId);
    }

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
