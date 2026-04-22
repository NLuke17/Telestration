import type { WebSocketServer } from 'ws';
import { getLobbyRegistry } from '../state/lobbyRegistry';
import { getPresenceTracker } from '../state/presenceTracker';
import { PromptTracker } from '../state/promptTracker';
import prisma from '../../prisma/client';
import * as lobbySnapshotService from '../../services/lobbySnapshotService';

export interface WSContext {
  wss: WebSocketServer;
  registry: ReturnType<typeof getLobbyRegistry>;
  presence: ReturnType<typeof getPresenceTracker>;
  prompts: PromptTracker;
  prisma: typeof prisma;
  lobbySnapshotService: typeof lobbySnapshotService;
}

export function buildWSContext(wss: WebSocketServer): WSContext {
  return {
    wss,
    registry: getLobbyRegistry(),
    presence: getPresenceTracker(),
    prompts: new PromptTracker(),
    prisma,
    lobbySnapshotService,
  };
}
