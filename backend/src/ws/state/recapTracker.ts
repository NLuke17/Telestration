import prisma from '../../prisma/client';
import { getGameFlipbookPresentation } from '../../services/flipbookPresentationService';
import { getLobbyRegistry } from './lobbyRegistry';
import { broadcast } from '../core/wsUtils';

export type RecapState = {
  hostId: string;
  flipbookIds: string[];
  flipbookIndex: number;
  /** How many timeline entries are visible for the current flipbook (0 = none yet). */
  entryCount: number;
  isComplete: boolean;
};

const byLobby = new Map<string, RecapState>();

export function clearRecapState(lobbyId: string): void {
  byLobby.delete(lobbyId);
}

export function getRecapState(lobbyId: string): RecapState | undefined {
  const s = byLobby.get(lobbyId);
  return s ? { ...s } : undefined;
}

/**
 * Build ordered flipbook ids for recap and reset cursor (call when entering VOTING).
 */
export async function initRecapStateFromLobby(lobbyId: string): Promise<void> {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: {
      host: { select: { id: true } },
      players: { select: { id: true }, orderBy: { createdAt: 'asc' } },
      rounds: {
        orderBy: { number: 'desc' },
        take: 1,
        include: { flipbooks: { select: { id: true, authorId: true } } },
      },
    },
  });

  if (!lobby?.rounds[0]) {
    clearRecapState(lobbyId);
    return;
  }

  const order = lobby.players.map((p) => p.id);
  const fbs = [...lobby.rounds[0].flipbooks].sort((a, b) => {
    const ai = order.indexOf(a.authorId);
    const bi = order.indexOf(b.authorId);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  const flipbookIds = fbs.map((f) => f.id);

  byLobby.set(lobbyId, {
    hostId: lobby.host.id,
    flipbookIds,
    flipbookIndex: 0,
    entryCount: 0,
    isComplete: false,
  });
}

/**
 * Host advances recap by one timeline slot (or first card of the next flipbook).
 */
export async function recapRevealNext(lobbyId: string): Promise<RecapState | null> {
  const st = byLobby.get(lobbyId);
  if (!st || st.isComplete || st.flipbookIds.length === 0) {
    return st ? { ...st } : null;
  }

  const fbId = st.flipbookIds[st.flipbookIndex];
  const pres = await getGameFlipbookPresentation(fbId, st.hostId);
  const len = pres.timeline.length;

  if (st.entryCount < len) {
    st.entryCount += 1;
  } else if (st.flipbookIndex + 1 < st.flipbookIds.length) {
    st.flipbookIndex += 1;
    st.entryCount = 1;
  } else {
    st.isComplete = true;
  }

  return { ...st };
}

export function buildRecapSyncMessage(lobbyId: string): {
  type: 'recap:sync';
  flipbookIds: string[];
  flipbookIndex: number;
  entryCount: number;
  isComplete: boolean;
} | null {
  const st = byLobby.get(lobbyId);
  if (!st) {
    return null;
  }
  return {
    type: 'recap:sync',
    flipbookIds: [...st.flipbookIds],
    flipbookIndex: st.flipbookIndex,
    entryCount: st.entryCount,
    isComplete: st.isComplete,
  };
}

export function broadcastRecapSync(lobbyId: string): void {
  const msg = buildRecapSyncMessage(lobbyId);
  if (!msg) {
    return;
  }
  const conns = getLobbyRegistry().getLobbyConnections(lobbyId);
  broadcast(conns, msg as any);
}
