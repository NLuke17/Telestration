import { ClientConn } from '../core/clientConn';
import { logInfo, logWarn } from '../../utils/logger';

/**
 * Lobby membership registry
 * Maps lobbyId -> Set of connection IDs
 * Maps connId -> ClientConn
 */
class LobbyRegistry {
  private lobbyToConns: Map<string, Set<string>> = new Map();
  private connIdToConn: Map<string, ClientConn> = new Map();
  private connIdToLobby: Map<string, string> = new Map();

  setConnection(connId: string, conn: ClientConn): void {
    this.connIdToConn.set(connId, conn);
    logInfo('Connection registered', { connId });
  }

  getConnection(connId: string): ClientConn | null {
    return this.connIdToConn.get(connId) || null;
  }

  removeConnection(connId: string): void {
    const lobby = this.connIdToLobby.get(connId);
    if (lobby) {
      this.leaveLobby(lobby, connId);
    }
    this.connIdToConn.delete(connId);
    logInfo('Connection removed', { connId });
  }

  joinLobby(lobbyId: string, connId: string): void {
    const currentLobby = this.connIdToLobby.get(connId);
    if (currentLobby) {
      this.leaveLobby(currentLobby, connId);
    }

    if (!this.lobbyToConns.has(lobbyId)) {
      this.lobbyToConns.set(lobbyId, new Set());
    }
    this.lobbyToConns.get(lobbyId)!.add(connId);
    this.connIdToLobby.set(connId, lobbyId);

    const conn = this.connIdToConn.get(connId);
    if (conn) {
      conn.lobbyId = lobbyId;
    }

    logInfo('Connection joined lobby', { connId, lobbyId });
  }

  /**
   * Leave a lobby
   */
  leaveLobby(lobbyId: string, connId: string): void {
    const conns = this.lobbyToConns.get(lobbyId);
    if (conns) {
      conns.delete(connId);
      if (conns.size === 0) {
        this.lobbyToConns.delete(lobbyId);
        logInfo('Lobby is now empty', { lobbyId });
      }
    }
    this.connIdToLobby.delete(connId);

    const conn = this.connIdToConn.get(connId);
    if (conn) {
      conn.lobbyId = undefined;
    }

    logInfo('Connection left lobby', { connId, lobbyId });
  }

  /**
   * Get all connections in a lobby
   */
  getLobbyConnections(lobbyId: string): ClientConn[] {
    const connIds = this.lobbyToConns.get(lobbyId);
    if (!connIds) {
      return [];
    }

    const conns: ClientConn[] = [];
    for (const connId of connIds) {
      const conn = this.connIdToConn.get(connId);
      if (conn) {
        conns.push(conn);
      } else {
        logWarn('Connection ID in lobby but not in registry', { connId, lobbyId });
      }
    }
    return conns;
  }

  getLobbyForConnection(connId: string): string | null {
    return this.connIdToLobby.get(connId) || null;
  }

  getAllConnections(): ClientConn[] {
    return Array.from(this.connIdToConn.values());
  }

  getLobbyConnectionCount(lobbyId: string): number {
    return this.lobbyToConns.get(lobbyId)?.size || 0;
  }
}

const registry = new LobbyRegistry();

export function getLobbyRegistry(): LobbyRegistry {
  return registry;
}
