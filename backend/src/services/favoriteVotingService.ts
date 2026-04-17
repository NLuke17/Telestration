import prisma from '../prisma/client';
import { Prisma } from '../generated/prisma';
import { logError, logInfo } from '../utils/logger';
import { VOTING_PHASE_DURATION_MS } from '../config/constants';
import { deriveExpectedPhaseFromChainWave } from './gameService';
import { resolveGameDrawingPayload } from './drawingStorageService';
import { clearRecapState, getRecapState } from '../ws/state/recapTracker';
import type { WSContext } from '../ws/context/wsContext';
import { broadcast } from '../ws/core/wsUtils';

export type VotingRankingRow = {
  rank: number;
  flipbookId: string;
  authorId: string;
  authorUsername: string;
  voteCount: number;
  prompt: string;
  finalDrawingData: string | null;
};

export type VotingResultsPayload = {
  rankings: VotingRankingRow[];
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * After the host finishes the last recap reveal, move chainWave N → N+1 and start the voting timer.
 */
export async function advanceFromRecapToFavoriteVoting(lobbyId: string): Promise<{
  advanced: boolean;
  endsAt?: number;
}> {
  const recap = getRecapState(lobbyId);
  if (!recap?.isComplete) {
    return { advanced: false };
  }

  const round = await prisma.round.findFirst({
    where: { lobbyId },
    orderBy: { number: 'desc' },
    include: {
      lobby: { include: { players: { select: { id: true }, orderBy: { createdAt: 'asc' } } } },
    },
  });

  if (!round) {
    return { advanced: false };
  }

  const N = round.lobby.players.length;
  if ((round.chainWave ?? 0) !== N) {
    return { advanced: false };
  }

  const deadline = new Date(Date.now() + VOTING_PHASE_DURATION_MS);
  const upd = await prisma.round.updateMany({
    where: { id: round.id, chainWave: N },
    data: {
      chainWave: N + 1,
      phaseDeadline: deadline,
    },
  });

  if (upd.count === 0) {
    return { advanced: false };
  }

  clearRecapState(lobbyId);
  return { advanced: true, endsAt: deadline.getTime() };
}

export async function submitFavoriteVote(
  lobbyId: string,
  voterId: string,
  flipbookId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const round = await prisma.round.findFirst({
      where: { lobbyId },
      orderBy: { number: 'desc' },
      include: {
        lobby: { include: { players: { select: { id: true }, orderBy: { createdAt: 'asc' } } } },
        flipbooks: { select: { id: true, authorId: true, votes: true } },
      },
    });

    if (!round) {
      return { ok: false, error: 'ROUND_NOT_FOUND' };
    }

    const N = round.lobby.players.length;
    const phase = deriveExpectedPhaseFromChainWave(round.chainWave ?? 0, N);
    if (phase !== 'VOTING') {
      return { ok: false, error: 'NOT_IN_VOTING_PHASE' };
    }

    const playerIds = new Set(round.lobby.players.map((p) => p.id));
    if (!playerIds.has(voterId)) {
      return { ok: false, error: 'NOT_IN_LOBBY' };
    }

    const fb = round.flipbooks.find((f) => f.id === flipbookId);
    if (!fb) {
      return { ok: false, error: 'FLIPBOOK_NOT_FOUND' };
    }
    if (fb.authorId === voterId) {
      return { ok: false, error: 'CANNOT_VOTE_OWN_FLIPBOOK' };
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.roundVote.findUnique({
        where: { roundId_voterId: { roundId: round.id, voterId } },
        select: { flipbookId: true },
      });

      if (existing) {
        if (existing.flipbookId === flipbookId) {
          return;
        }
        await tx.flipbook.update({
          where: { id: existing.flipbookId },
          data: { votes: { decrement: 1 } },
        });
        await tx.roundVote.update({
          where: { roundId_voterId: { roundId: round.id, voterId } },
          data: { flipbookId },
        });
        await tx.flipbook.update({
          where: { id: flipbookId },
          data: { votes: { increment: 1 } },
        });
      } else {
        await tx.roundVote.create({
          data: { roundId: round.id, voterId, flipbookId },
        });
        await tx.flipbook.update({
          where: { id: flipbookId },
          data: { votes: { increment: 1 } },
        });
      }
    });

    return { ok: true };
  } catch (e: any) {
    logError('submitFavoriteVote failed', { lobbyId, voterId, error: e?.message });
    return { ok: false, error: e?.message || 'VOTE_FAILED' };
  }
}

export async function revokeFavoriteVote(lobbyId: string, voterId: string): Promise<void> {
  const round = await prisma.round.findFirst({
    where: { lobbyId },
    orderBy: { number: 'desc' },
    include: {
      lobby: { include: { players: { select: { id: true }, orderBy: { createdAt: 'asc' } } } },
    },
  });

  if (!round) {
    throw new Error('ROUND_NOT_FOUND');
  }

  const N = round.lobby.players.length;
  const phase = deriveExpectedPhaseFromChainWave(round.chainWave ?? 0, N);
  if (phase !== 'VOTING') {
    throw new Error('REVOKE_NOT_ALLOWED');
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.roundVote.findUnique({
      where: { roundId_voterId: { roundId: round.id, voterId } },
      select: { flipbookId: true },
    });
    if (!existing) {
      return;
    }
    await tx.roundVote.delete({
      where: { roundId_voterId: { roundId: round.id, voterId } },
    });
    await tx.flipbook.update({
      where: { id: existing.flipbookId },
      data: { votes: { decrement: 1 } },
    });
  });
}

export async function ensureFavoriteVotesForDeadline(lobbyId: string): Promise<void> {
  const round = await prisma.round.findFirst({
    where: { lobbyId },
    orderBy: { number: 'desc' },
    include: {
      lobby: { include: { players: { select: { id: true }, orderBy: { createdAt: 'asc' } } } },
      flipbooks: { select: { id: true, authorId: true } },
    },
  });

  if (!round) {
    return;
  }

  const N = round.lobby.players.length;
  if (deriveExpectedPhaseFromChainWave(round.chainWave ?? 0, N) !== 'VOTING') {
    return;
  }

  const playerIds = round.lobby.players.map((p) => p.id);
  for (const userId of playerIds) {
    const has = await prisma.roundVote.findUnique({
      where: { roundId_voterId: { roundId: round.id, voterId: userId } },
      select: { id: true },
    });
    if (has) continue;

    const choices = round.flipbooks.filter((f) => f.authorId !== userId).map((f) => f.id);
    if (!choices.length) continue;

    const pick = pickRandom(choices);
    const res = await submitFavoriteVote(lobbyId, userId, pick);
    if (!res.ok) {
      logError('auto favorite vote failed', { lobbyId, userId, error: res.error });
    }
  }
}

function competitionRank(sortedByVotesDesc: { flipbookId: string; voteCount: number }[]): number[] {
  const ranks: number[] = [];
  let currentRank = 1;
  for (let i = 0; i < sortedByVotesDesc.length; i++) {
    if (i > 0 && sortedByVotesDesc[i]!.voteCount < sortedByVotesDesc[i - 1]!.voteCount) {
      currentRank = i + 1;
    }
    ranks.push(currentRank);
  }
  return ranks;
}

export async function finalizeFavoriteVoting(
  ctx: WSContext,
  lobbyId: string
): Promise<{ success: true; results: VotingResultsPayload } | { success: false }> {
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const lobby = await tx.lobby.findUnique({
        where: { id: lobbyId },
        select: { state: true },
      });
      if (lobby?.state !== 'IN_PROGRESS') {
        return { done: false as const, payload: null as VotingResultsPayload | null };
      }

      const round = await tx.round.findFirst({
        where: { lobbyId },
        orderBy: { number: 'desc' },
        include: {
          lobby: { include: { players: { select: { id: true, username: true }, orderBy: { createdAt: 'asc' } } } },
          flipbooks: {
            include: {
              author: { select: { id: true, username: true } },
              drawings: {
                orderBy: { order: 'desc' },
                take: 1,
                select: {
                  id: true,
                  drawingData: true,
                  storageKind: true,
                  storageKey: true,
                  byteLength: true,
                },
              },
            },
          },
          roundVotes: { select: { flipbookId: true, voterId: true } },
        },
      });

      if (!round) {
        return { done: false as const, payload: null as VotingResultsPayload | null };
      }

      const N = round.lobby.players.length;
      if (deriveExpectedPhaseFromChainWave(round.chainWave ?? 0, N) !== 'VOTING') {
        return { done: false as const, payload: null as VotingResultsPayload | null };
      }

      const playerIds = round.lobby.players.map((p) => p.id);
      const voteCountByFlipbook = new Map<string, number>();
      for (const fb of round.flipbooks) {
        voteCountByFlipbook.set(fb.id, 0);
      }
      for (const v of round.roundVotes) {
        voteCountByFlipbook.set(v.flipbookId, (voteCountByFlipbook.get(v.flipbookId) ?? 0) + 1);
      }

      const tallies = round.flipbooks.map((fb) => ({
        flipbookId: fb.id,
        authorId: fb.author.id,
        authorUsername: fb.author.username,
        voteCount: voteCountByFlipbook.get(fb.id) ?? 0,
        prompt: fb.prompt,
      }));

      tallies.sort((a, b) => b.voteCount - a.voteCount || a.authorUsername.localeCompare(b.authorUsername));

      const ranks = competitionRank(tallies);

      const rankingsFull: VotingRankingRow[] = [];
      for (let i = 0; i < tallies.length; i++) {
        const t = tallies[i]!;
        const fbRow = round.flipbooks.find((f) => f.id === t.flipbookId)!;
        const lastDrawing = fbRow.drawings[0] ?? null;
        let finalDrawingData: string | null = null;
        if (lastDrawing) {
          try {
            finalDrawingData = await resolveGameDrawingPayload(lastDrawing);
          } catch {
            finalDrawingData = null;
          }
        }
        rankingsFull.push({
          rank: ranks[i]!,
          flipbookId: t.flipbookId,
          authorId: t.authorId,
          authorUsername: t.authorUsername,
          voteCount: t.voteCount,
          prompt: t.prompt,
          finalDrawingData,
        });
      }

      const payload: VotingResultsPayload = { rankings: rankingsFull };

      await tx.round.update({
        where: { id: round.id },
        data: {
          votingResults: payload as unknown as Prisma.InputJsonValue,
          phaseDeadline: null,
        },
      });

      const firstRank = rankingsFull.length ? Math.min(...rankingsFull.map((r) => r.rank)) : null;
      const winnerAuthorIds = new Set(
        firstRank != null ? rankingsFull.filter((r) => r.rank === firstRank).map((r) => r.authorId) : []
      );

      for (const uid of playerIds) {
        await tx.user.update({
          where: { id: uid },
          data: { gamesPlayed: { increment: 1 } },
        });
      }

      for (const row of tallies) {
        if (row.voteCount > 0) {
          await tx.user.update({
            where: { id: row.authorId },
            data: { totalVotesReceived: { increment: row.voteCount } },
          });
        }
      }

      for (const wid of winnerAuthorIds) {
        await tx.user.update({
          where: { id: wid },
          data: { wins: { increment: 1 } },
        });
      }

      await tx.lobby.update({
        where: { id: lobbyId },
        data: { state: 'FINISHED' },
      });

      return { done: true as const, payload };
    });

    if (!outcome.done || !outcome.payload) {
      return { success: false };
    }

    clearRecapState(lobbyId);

    const connections = ctx.registry.getLobbyConnections(lobbyId);
    broadcast(connections, {
      type: 'game:voting_finished',
      results: outcome.payload,
    });

    logInfo('Favorite voting finalized', { lobbyId });
    return { success: true, results: outcome.payload };
  } catch (e: any) {
    logError('finalizeFavoriteVoting failed', { lobbyId, error: e?.message });
    return { success: false };
  }
}

export async function tryFinalizeFavoriteVotingIfAllVoted(
  ctx: WSContext,
  lobbyId: string
): Promise<void> {
  const round = await prisma.round.findFirst({
    where: { lobbyId },
    orderBy: { number: 'desc' },
    include: {
      lobby: { include: { players: { select: { id: true }, orderBy: { createdAt: 'asc' } } } },
      _count: { select: { roundVotes: true } },
    },
  });

  if (!round) {
    return;
  }

  const N = round.lobby.players.length;
  if (deriveExpectedPhaseFromChainWave(round.chainWave ?? 0, N) !== 'VOTING') {
    return;
  }

  if (round._count.roundVotes >= N) {
    const fin = await finalizeFavoriteVoting(ctx, lobbyId);
    if (fin.success) {
      const { broadcastLobbySnapshot } = await import('../ws/handlers/lobbyWs');
      await broadcastLobbySnapshot(ctx, lobbyId);
    }
  }
}
