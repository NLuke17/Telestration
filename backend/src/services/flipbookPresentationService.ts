import prisma from '../prisma/client';
import { resolveGameDrawingPayload, resolveSavedDrawingPayload } from './drawingStorageService';

export type TimelineEntry =
  | { kind: 'prompt'; text: string }
  | {
      kind: 'drawing';
      id: string;
      order: number;
      authorId: string;
      authorUsername: string;
      drawingData: string;
    }
  | {
      kind: 'guess';
      id: string;
      order: number;
      authorId: string;
      authorUsername: string;
      text: string;
    };

async function assertFlipbookVisibleToUser(flipbookId: string, userId: string): Promise<void> {
  const flipbook = await prisma.flipbook.findUnique({
    where: { id: flipbookId },
    include: {
      round: {
        include: {
          lobby: {
            include: { players: { select: { id: true } } },
          },
        },
      },
    },
  });

  if (!flipbook) {
    throw new Error('FLIPBOOK_NOT_FOUND');
  }

  const playerIds = new Set(flipbook.round.lobby.players.map((p) => p.id));
  if (!playerIds.has(userId)) {
    throw new Error('NOT_IN_LOBBY');
  }
}

/**
 * Full flipbook timeline for end-of-game replay (resolves file-backed drawing payloads).
 */
export async function getGameFlipbookPresentation(flipbookId: string, requesterUserId: string) {
  await assertFlipbookVisibleToUser(flipbookId, requesterUserId);

  const flipbook = await prisma.flipbook.findUnique({
    where: { id: flipbookId },
    include: {
      author: { select: { id: true, username: true, profilePicture: true } },
      drawings: {
        orderBy: { order: 'asc' },
        include: { author: { select: { id: true, username: true, profilePicture: true } } },
      },
      guesses: {
        orderBy: { order: 'asc' },
        include: { author: { select: { id: true, username: true, profilePicture: true } } },
      },
      round: { select: { id: true, number: true, lobbyId: true } },
    },
  });

  if (!flipbook) {
    throw new Error('FLIPBOOK_NOT_FOUND');
  }

  const timeline: TimelineEntry[] = [{ kind: 'prompt', text: flipbook.prompt }];

  const drawingByOrder = new Map(flipbook.drawings.map((d) => [d.order, d]));
  const guessByOrder = new Map(flipbook.guesses.map((g) => [g.order, g]));
  const orders = new Set<number>([...drawingByOrder.keys(), ...guessByOrder.keys()]);
  const sortedOrders = [...orders].sort((a, b) => a - b);

  for (const ord of sortedOrders) {
    const d = drawingByOrder.get(ord);
    if (d) {
      const drawingData = await resolveGameDrawingPayload(d);
      timeline.push({
        kind: 'drawing',
        id: d.id,
        order: d.order,
        authorId: d.author.id,
        authorUsername: d.author.username,
        drawingData,
      });
    }
    const g = guessByOrder.get(ord);
    if (g) {
      timeline.push({
        kind: 'guess',
        id: g.id,
        order: g.order,
        authorId: g.author.id,
        authorUsername: g.author.username,
        text: g.text,
      });
    }
  }

  return {
    flipbook: {
      id: flipbook.id,
      prompt: flipbook.prompt,
      votes: flipbook.votes,
      state: flipbook.state,
      author: flipbook.author,
      round: flipbook.round,
    },
    timeline,
  };
}

/**
 * Saved library copy — same timeline shape for consistent client rendering.
 */
export async function getSavedFlipbookPresentation(savedFlipbookId: string, ownerId: string) {
  const saved = await prisma.savedFlipbook.findFirst({
    where: { id: savedFlipbookId, ownerId },
    include: {
      drawings: {
        orderBy: { order: 'asc' },
      },
      guesses: {
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!saved) {
    throw new Error('SAVED_FLIPBOOK_NOT_FOUND');
  }

  const timeline: TimelineEntry[] = [{ kind: 'prompt', text: saved.prompt }];

  const drawingByOrder = new Map(saved.drawings.map((d) => [d.order, d]));
  const guessByOrder = new Map(saved.guesses.map((g) => [g.order, g]));
  const orders = new Set<number>([...drawingByOrder.keys(), ...guessByOrder.keys()]);
  const sortedOrders = [...orders].sort((a, b) => a - b);

  for (const ord of sortedOrders) {
    const d = drawingByOrder.get(ord);
    if (d) {
      const drawingData = await resolveSavedDrawingPayload(d);
      timeline.push({
        kind: 'drawing',
        id: d.id,
        order: d.order,
        authorId: d.authorId,
        authorUsername: d.authorUsername,
        drawingData,
      });
    }
    const g = guessByOrder.get(ord);
    if (g) {
      timeline.push({
        kind: 'guess',
        id: g.id,
        order: g.order,
        authorId: g.authorId,
        authorUsername: g.authorUsername,
        text: g.text,
      });
    }
  }

  return {
    savedFlipbook: {
      id: saved.id,
      title: saved.title,
      prompt: saved.prompt,
      sourceFlipbookId: saved.sourceFlipbookId,
      createdAt: saved.createdAt,
    },
    timeline,
  };
}
