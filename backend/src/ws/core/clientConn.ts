import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';

export interface ClientConn {
  connId: string;
  ws: WebSocket;
  userId?: string;
  lobbyId?: string;
  isAlive: boolean;
}

/**
 * Create a new client connection wrapper
 */
export function createClientConn(ws: WebSocket): ClientConn {
  return {
    connId: randomUUID(),
    ws,
    isAlive: true,
  };
}

/**
 * Bind authentication info to connection
 */
export function bindAuth(conn: ClientConn, userId: string): void {
  conn.userId = userId;
}

/**
 * Set or clear lobby membership
 */
export function setLobby(conn: ClientConn, lobbyId: string | null): void {
  conn.lobbyId = lobbyId ?? undefined;
}

/**
 * Mark connection as alive (for heartbeat)
 */
export function markAlive(conn: ClientConn): void {
  conn.isAlive = true;
}

/**
 * Mark connection as dead (for heartbeat)
 */
export function markDead(conn: ClientConn): void {
  conn.isAlive = false;
}
