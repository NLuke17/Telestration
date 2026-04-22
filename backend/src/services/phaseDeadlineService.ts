import prisma from '../prisma/client';
import { logDebug, logError, logInfo, logWarn } from '../utils/logger';
import { PHASE_DEADLINE_SUBMISSION_GRACE_MS } from '../config/constants';
import { pickRandomFallbackPrompt } from '../config/prompts';
import type { WSContext } from '../ws/context/wsContext';
import { broadcastPhaseChange } from '../ws/handlers/gameWs';
import {
  advanceRoundIfChainPhaseComplete,
  deriveExpectedPhaseFromChainWave,
  submitDrawing,
  submitGuess,
  tryAdvanceInitialPromptsIfReady,
} from './gameService';
import { ensureFavoriteVotesForDeadline, finalizeFavoriteVoting } from './favoriteVotingService';

const EMPTY_DRAWING_JSON = '[]';

/**
 * When `phaseDeadline` plus {@link PHASE_DEADLINE_SUBMISSION_GRACE_MS} has passed, fill any missing
 * submissions and advance the round once. Idempotent with respect to already-submitted players.
 */
export async function processExpiredPhaseDeadlines(ctx: WSContext): Promise<void> {
  const lobbies = await prisma.lobby.findMany({
    where: { state: 'IN_PROGRESS' },
    select: { id: true },
  });

  for (const { id: lobbyId } of lobbies) {
    try {
      await processLobbyPhaseDeadlineIfStale(ctx, lobbyId);
    } catch (e: any) {
      logError('processExpiredPhaseDeadlines lobby tick failed', {
        lobbyId,
        error: e?.message,
      });
    }
  }
}

async function processLobbyPhaseDeadlineIfStale(ctx: WSContext, lobbyId: string): Promise<void> {
  const round = await prisma.round.findFirst({
    where: { lobbyId },
    orderBy: { number: 'desc' },
    include: {
      lobby: {
        include: {
          players: { select: { id: true }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });

  if (!round?.phaseDeadline) {
    return;
  }

  const deadlineMs = round.phaseDeadline.getTime();
  const now = Date.now();
  if (now < deadlineMs) {
    return;
  }
  // Do not inject placeholders or advance until grace elapses — late WS submits may still be in flight.
  if (now < deadlineMs + PHASE_DEADLINE_SUBMISSION_GRACE_MS) {
    return;
  }

  const N = round.lobby.players.length;
  const w = round.chainWave ?? 0;
  const phase = deriveExpectedPhaseFromChainWave(w, N);

  if (phase === 'VOTING') {
    await ensureFavoriteVotesForDeadline(lobbyId);
    const fin = await finalizeFavoriteVoting(ctx, lobbyId);
    if (fin.success) {
      const { broadcastLobbySnapshot } = await import('../ws/handlers/lobbyWs');
      await broadcastLobbySnapshot(ctx, lobbyId);
    }
    logDebug('phase_deadline_favorite_voting', { lobbyId, roundId: round.id, finalized: fin.success });
    return;
  }

  if (w === 0 && phase === 'GUESSING') {
    const flipbooks = await prisma.flipbook.findMany({
      where: { roundId: round.id },
      select: { id: true, prompt: true },
    });
    for (const fb of flipbooks) {
      if (!fb.prompt?.trim()) {
        await prisma.flipbook.update({
          where: { id: fb.id },
          data: { prompt: pickRandomFallbackPrompt() },
        });
      }
    }
    const init = await tryAdvanceInitialPromptsIfReady(lobbyId);
    if (init.advanced && init.endsAt != null) {
      await broadcastPhaseChange(ctx, lobbyId, 'DRAWING', { endsAt: init.endsAt });
      logInfo('Phase deadline: initial prompts filled, advanced to DRAWING', { lobbyId });
    }
    return;
  }

  if (w < 1 || w > N - 1) {
    return;
  }

  const playerIds = round.lobby.players.map((p) => p.id);
  const flipbooks = await prisma.flipbook.findMany({
    where: { roundId: round.id },
    select: { id: true, authorId: true },
  });

  if (phase === 'DRAWING') {
    for (let i = 0; i < playerIds.length; i++) {
      const userId = playerIds[i];
      const targetAuthorId = playerIds[(i + w) % N];
      const targetFb = flipbooks.find((f) => f.authorId === targetAuthorId);
      if (!targetFb) continue;

      const existing = await prisma.drawing.count({
        where: { flipbookId: targetFb.id, authorId: userId },
      });
      if (existing > 0) continue;

      try {
        await submitDrawing(targetFb.id, userId, EMPTY_DRAWING_JSON);
      } catch (e: any) {
        logWarn('Phase deadline auto-drawing failed', {
          lobbyId,
          flipbookId: targetFb.id,
          userId,
          error: e?.message,
        });
      }
    }
  } else if (phase === 'GUESSING') {
    for (let i = 0; i < playerIds.length; i++) {
      const userId = playerIds[i];
      const targetAuthorId = playerIds[(i + w) % N];
      const targetFb = flipbooks.find((f) => f.authorId === targetAuthorId);
      if (!targetFb) continue;

      const existing = await prisma.guess.count({
        where: { flipbookId: targetFb.id, authorId: userId },
      });
      if (existing > 0) continue;

      try {
        await submitGuess(targetFb.id, userId, pickRandomFallbackPrompt());
      } catch (e: any) {
        logWarn('Phase deadline auto-guess failed', {
          lobbyId,
          flipbookId: targetFb.id,
          userId,
          error: e?.message,
        });
      }
    }
  }

  const result = await advanceRoundIfChainPhaseComplete(lobbyId, phase);
  if (result.advanced) {
    await broadcastPhaseChange(ctx, result.lobbyId, result.newPhase, { endsAt: result.endsAt });
    logInfo('Phase deadline: chain advanced', {
      lobbyId,
      fromPhase: phase,
      newPhase: result.newPhase,
    });
  }
}
