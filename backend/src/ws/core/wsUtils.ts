/**
 * WebSocket utility functions for sending and broadcasting
 */

import { WebSocket } from 'ws';
import { WSServerMessage } from '../../types/ws';
import { ClientConn } from './clientConn';
import { logWarn } from '../../utils/logger';

/**
 * Send a message to a single client connection
 */
export function send(conn: ClientConn, msg: WSServerMessage): void {
  if (conn.ws.readyState !== WebSocket.OPEN) {
    logWarn('Attempted to send to closed connection', { connId: conn.connId });
    return;
  }
  try {
    conn.ws.send(JSON.stringify(msg));
  } catch (error) {
    logWarn('Failed to send message', { connId: conn.connId, error });
  }
}

/**
 * Broadcast a message to multiple connections
 */
export function broadcast(conns: Iterable<ClientConn>, msg: WSServerMessage): void {
  const payload = JSON.stringify(msg);
  for (const conn of conns) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      try {
        conn.ws.send(payload);
      } catch (error) {
        logWarn('Failed to broadcast to connection', { connId: conn.connId, error });
      }
    }
  }
}

/**
 * Send JSON to raw WebSocket (legacy support)
 */
export function sendJson<T>(socket: WebSocket, payload: T): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}
