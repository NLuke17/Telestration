import { randomUUID } from 'crypto';
import prisma from '../prisma/client';
import { logInfo, logError } from '../utils/logger';
import { persistLibraryDrawingPayload, resolveGameDrawingPayload } from './drawingStorageService';
import { deriveExpectedPhaseFromChainWave } from './gameService';
import { MAX_SAVED_FLIPBOOKS_PER_USER } from '../config/constants';
import { Prisma } from '../generated/prisma';

/**
 * Copy a completed game flipbook into the user's library (opt-in). Uses separate blob keys so lobby cleanup does not remove saved art.
 */
export async function saveGameFlipbookToLibrary(
  ownerId: string,
  sourceFlipbookId: string,
  title?: string | null
) {
  const flipbook = await prisma.flipbook.findUnique({
    where: { id: sourceFlipbookId },
    include: {
      drawings: {
        orderBy: { order: 'asc' },
        include: { author: { select: { id: true, username: true } } },
      },
      guesses: {
        orderBy: { order: 'asc' },
        include: { author: { select: { id: true, username: true } } },
      },
      round: {
        select: {
          id: true,
          chainWave: true,
          lobby: {
            select: {
              state: true,
              players: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!flipbook) {
    throw new Error('FLIPBOOK_NOT_FOUND');
  }

  const lobbyState = flipbook.round.lobby.state;
  const playerCount = flipbook.round.lobby.players.length;
  const chainWave = flipbook.round.chainWave ?? 0;
  const currentPhase = deriveExpectedPhaseFromChainWave(chainWave, playerCount);
  const lobbyAllowsSave =
    lobbyState === 'FINISHED' ||
    (lobbyState === 'IN_PROGRESS' && currentPhase === 'VOTING');

  if (!lobbyAllowsSave) {
    throw new Error('LOBBY_NOT_FINISHED');
  }

  const playerIds = new Set(flipbook.round.lobby.players.map((p) => p.id));
  if (!playerIds.has(ownerId)) {
    throw new Error('NOT_IN_LOBBY');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const existingCount = await tx.savedFlipbook.count({ where: { ownerId } });
      if (existingCount >= MAX_SAVED_FLIPBOOKS_PER_USER) {
        throw new Error('LIBRARY_FULL');
      }

      const saved = await tx.savedFlipbook.create({
        data: {
          ownerId,
          sourceFlipbookId,
          sourceRoundId: flipbook.round.id,
          prompt: flipbook.prompt,
          title: title?.trim() || null,
        },
      });

      for (const d of flipbook.drawings) {
        const payload = await resolveGameDrawingPayload(d);
        const newDrawingId = randomUUID();
        const persisted = await persistLibraryDrawingPayload(ownerId, saved.id, newDrawingId, payload);
        await tx.savedDrawing.create({
          data: {
            id: newDrawingId,
            savedFlipbookId: saved.id,
            order: d.order,
            authorId: d.author.id,
            authorUsername: d.author.username,
            drawingData: persisted.drawingData,
            storageKind: persisted.storageKind,
            storageKey: persisted.storageKey,
            byteLength: persisted.byteLength,
          },
        });
      }

      for (const g of flipbook.guesses) {
        await tx.savedGuess.create({
          data: {
            savedFlipbookId: saved.id,
            order: g.order,
            text: g.text,
            authorId: g.author.id,
            authorUsername: g.author.username,
          },
        });
      }

      logInfo('Flipbook saved to user library', {
        ownerId,
        savedFlipbookId: saved.id,
        sourceFlipbookId,
      });

      return saved;
    });
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new Error('FLIPBOOK_ALREADY_SAVED');
    }
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'LIBRARY_FULL') {
      throw e;
    }
    logError('saveGameFlipbookToLibrary failed', { ownerId, sourceFlipbookId, error: msg });
    throw e;
  }
}

export async function listSavedFlipbooksForUser(ownerId: string) {
  return prisma.savedFlipbook.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      prompt: true,
      sourceFlipbookId: true,
      sourceRoundId: true,
      createdAt: true,
    },
  });
}
