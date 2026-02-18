import { logInfo } from '../../utils/logger';
import { WS_RECONNECT_GRACE_MS } from '../../config/constants';

interface PresenceEntry {
  userId: string;
  lobbyId: string;
  connectedAt: number;
  disconnectedAt?: number;
}

class PresenceTracker {
  // Map: lobbyId -> Set of connected userIds
  private lobbyPresence: Map<string, Set<string>> = new Map();
  
  // Map: userId:lobbyId -> PresenceEntry
  private presenceEntries: Map<string, PresenceEntry> = new Map();

  private getKey(lobbyId: string, userId: string): string {
    return `${userId}:${lobbyId}`;
  }

  markConnected(lobbyId: string, userId: string): void {
    const key = this.getKey(lobbyId, userId);
    const now = Date.now();

    // Add to lobby presence set
    if (!this.lobbyPresence.has(lobbyId)) {
      this.lobbyPresence.set(lobbyId, new Set());
    }
    this.lobbyPresence.get(lobbyId)!.add(userId);

    // Update or create presence entry
    const existing = this.presenceEntries.get(key);
    if (existing) {
      existing.connectedAt = now;
      delete existing.disconnectedAt;
      logInfo('User reconnected', { userId, lobbyId });
    } else {
      this.presenceEntries.set(key, {
        userId,
        lobbyId,
        connectedAt: now,
      });
      logInfo('User connected', { userId, lobbyId });
    }
  }

  markDisconnected(lobbyId: string, userId: string): void {
    const key = this.getKey(lobbyId, userId);
    const entry = this.presenceEntries.get(key);

    if (entry) {
      entry.disconnectedAt = Date.now();
      logInfo('User disconnected (grace period active)', { userId, lobbyId });
    }
  }

  getPresence(lobbyId: string): { connectedUserIds: string[] } {
    const userIds = this.lobbyPresence.get(lobbyId);
    if (!userIds) {
      return { connectedUserIds: [] };
    }

    const now = Date.now();
    const connected: string[] = [];

    for (const userId of userIds) {
      const key = this.getKey(lobbyId, userId);
      const entry = this.presenceEntries.get(key);

      if (!entry) {
        continue;
      }

      // Check if still in grace period or fully connected
      if (!entry.disconnectedAt) {
        connected.push(userId);
      } else if (now - entry.disconnectedAt < WS_RECONNECT_GRACE_MS) {
        // Still in grace period, consider as connected
        connected.push(userId);
      }
    }

    return { connectedUserIds: connected };
  }

  /**
   * Clean up stale disconnections (past grace period)
   */
  cleanup(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, entry] of this.presenceEntries.entries()) {
      if (entry.disconnectedAt && now - entry.disconnectedAt > WS_RECONNECT_GRACE_MS) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      const entry = this.presenceEntries.get(key);
      if (entry) {
        const userSet = this.lobbyPresence.get(entry.lobbyId);
        if (userSet) {
          userSet.delete(entry.userId);
          if (userSet.size === 0) {
            this.lobbyPresence.delete(entry.lobbyId);
          }
        }
        this.presenceEntries.delete(key);
        logInfo('User presence expired', { userId: entry.userId, lobbyId: entry.lobbyId });
      }
    }
  }

  shouldGraceKeep(userId: string, lobbyId: string): boolean {
    const key = this.getKey(lobbyId, userId);
    const entry = this.presenceEntries.get(key);

    if (!entry || !entry.disconnectedAt) {
      return false;
    }

    const now = Date.now();
    return now - entry.disconnectedAt < WS_RECONNECT_GRACE_MS;
  }

  remove(lobbyId: string, userId: string): void {
    const key = this.getKey(lobbyId, userId);
    this.presenceEntries.delete(key);

    const userSet = this.lobbyPresence.get(lobbyId);
    if (userSet) {
      userSet.delete(userId);
      if (userSet.size === 0) {
        this.lobbyPresence.delete(lobbyId);
      }
    }

    logInfo('User presence removed', { userId, lobbyId });
  }
}

const tracker = new PresenceTracker();

setInterval(() => {
  tracker.cleanup();
}, WS_RECONNECT_GRACE_MS);

export function getPresenceTracker(): PresenceTracker {
  return tracker;
}
