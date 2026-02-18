import { WebSocketServer } from 'ws';
import { getLobbyRegistry } from '../state/lobbyRegistry';
import { getPresenceTracker } from '../state/presenceTracker';
import { getPrisma } from '../../prisma/client';
import * as lobbySnapshotService from '../../services/lobbySnapshotService';

export interface WSContext {
  wss: WebSocketServer;
  registry: ReturnType<typeof getLobbyRegistry>;
  presence: ReturnType<typeof getPresenceTracker>;
  prisma: ReturnType<typeof getPrisma>;
  lobbySnapshotService: typeof lobbySnapshotService;
}

export function buildWSContext(wss: WebSocketServer): WSContext {
  return {
    wss,
    registry: getLobbyRegistry(),
    presence: getPresenceTracker(),
    prisma: getPrisma(),
    lobbySnapshotService,
  };
}
