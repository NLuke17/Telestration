import prisma from '../prisma/client';
import { getAssignedFlipbook, deriveExpectedPhaseFromChainWave } from './gameService';
import { logDebug, logError } from '../utils/logger';
import { resolveGameDrawingPayload } from './drawingStorageService';

function lastGuessLine(
  guesses: { order: number; text: string }[]
): string | null {
  if (!guesses.length) return null;
  const sorted = [...guesses].sort((a, b) => a.order - b.order);
  const t = sorted[sorted.length - 1]?.text?.trim();
  return t && t.length > 0 ? t : null;
}

type RoundForState = {
  chainWave: number | null;
  flipbooks: Array<{
    id: string;
    authorId: string;
    prompt: string | null;
    drawings: { authorId: string }[];
    guesses: { order: number; text: string; authorId: string }[];
  }>;
};

function computeWorkFlipbookContext(
  round: RoundForState,
  playerIds: string[],
  userId: string,
  phase: 'DRAWING' | 'GUESSING'
): { workFlipbookId: string | null; workFlipbookDrawFromText: string | null } {
  const N = playerIds.length;
  const w = round.chainWave ?? 0;

  if (phase === 'DRAWING' && w === 0) {
    return { workFlipbookId: null, workFlipbookDrawFromText: null };
  }
  if (phase === 'GUESSING' && w === 0) {
    const mine = round.flipbooks.find((fb) => fb.authorId === userId);
    return { workFlipbookId: mine?.id ?? null, workFlipbookDrawFromText: null };
  }
  if (w < 1 || w >= N) {
    return { workFlipbookId: null, workFlipbookDrawFromText: null };
  }
  const idx = playerIds.indexOf(userId);
  if (idx < 0) {
    return { workFlipbookId: null, workFlipbookDrawFromText: null };
  }
  const tid = playerIds[(idx + w) % N];
  const tb = round.flipbooks.find((fb) => fb.authorId === tid);
  if (!tb) {
    return { workFlipbookId: null, workFlipbookDrawFromText: null };
  }
  const guessLine = lastGuessLine(tb.guesses);
  const drawFrom =
    guessLine && guessLine.length > 0
      ? guessLine
      : tb.prompt && tb.prompt.trim().length > 0
        ? tb.prompt.trim()
        : null;
  return { workFlipbookId: tb.id, workFlipbookDrawFromText: drawFrom };
}

/**
 * Complete game state for a specific user in a lobby
 * Returns everything the client needs in one call
 */
export async function getGameState(roomCode: string, userId: string) {
  try {
    const lobby = await prisma.lobby.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      include: {
        host: { select: { id: true, username: true, profilePicture: true } },
        players: { 
          select: { id: true, username: true, profilePicture: true },
          orderBy: { createdAt: 'asc' } // Consistent player ordering
        },
        rounds: {
          orderBy: { number: 'desc' },
          take: 1,
          include: {
            flipbooks: {
              include: {
                author: { select: { id: true, username: true, profilePicture: true } },
                drawings: {
                  select: { 
                    id: true, 
                    authorId: true,
                    order: true,
                    createdAt: true,
                    drawingData: true,
                    storageKind: true,
                    storageKey: true,
                    byteLength: true,
                  },
                },
                guesses: {
                  select: { 
                    id: true, 
                    authorId: true,
                    order: true,
                    text: true,
                    createdAt: true 
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lobby) {
      throw new Error('LOBBY_NOT_FOUND');
    }

    const currentRound = lobby.rounds[0];

    // Base state (always available)
    const baseState = {
      lobbyId: lobby.id,
      roomCode: lobby.roomCode,
      state: lobby.state,
      host: lobby.host,
      players: lobby.players,
      createdAt: lobby.createdAt,
    };

    // If game hasn't started yet
    if (lobby.state === 'WAITING') {
      return {
        ...baseState,
        phase: 'WAITING' as const,
        roundId: null,
        myFlipbookId: null,
        myRole: null,
        hasSubmitted: false,
        endsAt: null,
        assignedFlipbookId: null,
        assignedPrompt: null,
        counts: {
          submittedDrawings: 0,
          submittedGuesses: 0,
          totalPlayers: lobby.players.length,
        },
      };
    }

    // If game finished
    if (lobby.state === 'FINISHED') {
      return {
        ...baseState,
        phase: 'FINISHED' as const,
        roundId: currentRound?.id || null,
        myFlipbookId: null,
        myRole: null,
        hasSubmitted: false,
        endsAt: null,
        assignedFlipbookId: null,
        assignedPrompt: null,
        votingResults: currentRound?.votingResults ?? null,
        counts: {
          submittedDrawings: 0,
          submittedGuesses: 0,
          totalPlayers: lobby.players.length,
        },
      };
    }

    // Game is IN_PROGRESS
    if (!currentRound) {
      throw new Error('ROUND_NOT_FOUND');
    }

    const playerCount = lobby.players.length;
    const chainWave = currentRound.chainWave ?? 0;
    const currentPhase = deriveExpectedPhaseFromChainWave(chainWave, playerCount);

    // Get user's own flipbook
    const myFlipbook = currentRound.flipbooks.find(fb => fb.authorId === userId);
    const myFlipbookId = myFlipbook?.id || null;

    // Get assigned flipbook for current phase
    let assignedFlipbook: any = null;
    let myRole: string | null = null;
    let hasSubmitted = false;
    let workFlipbookId: string | null = null;
    let workFlipbookDrawFromText: string | null = null;

    if (currentPhase === 'DRAWING' || currentPhase === 'GUESSING') {
      const playerIds = lobby.players.map((p) => p.id);
      const workCtx = computeWorkFlipbookContext(
        currentRound as RoundForState,
        playerIds,
        userId,
        currentPhase
      );
      workFlipbookId = workCtx.workFlipbookId;
      workFlipbookDrawFromText = workCtx.workFlipbookDrawFromText;

      const fallbackHasSubmitted = (): boolean => {
        const idx = playerIds.indexOf(userId);
        if (idx < 0) return true;
        if (!workFlipbookId) {
          return currentPhase === 'GUESSING' && chainWave === 0 ? false : true;
        }
        const tb = currentRound.flipbooks.find((fb) => fb.id === workFlipbookId);
        if (!tb) return true;
        if (currentPhase === 'DRAWING') {
          return tb.drawings.some((d: { authorId: string }) => d.authorId === userId);
        }
        if (chainWave === 0) {
          return !!(tb.prompt && tb.prompt.trim().length > 0);
        }
        return tb.guesses.some((g: { authorId: string }) => g.authorId === userId);
      };

      try {
        assignedFlipbook = await getAssignedFlipbook(
          currentRound.id,
          userId,
          currentPhase as 'DRAWING' | 'GUESSING'
        );

        if (assignedFlipbook) {
          myRole = currentPhase.toLowerCase();

          if (currentPhase === 'DRAWING') {
            hasSubmitted = assignedFlipbook.drawings.some((d: any) => d.authorId === userId);
          } else {
            hasSubmitted = assignedFlipbook.guesses.some((g: any) => g.authorId === userId);
          }
        } else {
          myRole = currentPhase.toLowerCase();
          hasSubmitted = fallbackHasSubmitted();
        }
      } catch (error) {
        myRole = currentPhase.toLowerCase();
        hasSubmitted = fallbackHasSubmitted();
      }
    } else if (currentPhase === 'RECAP') {
      myRole = 'recap';
      hasSubmitted = true;
    } else if (currentPhase === 'VOTING') {
      myRole = 'vote';
      const rv = await prisma.roundVote.findUnique({
        where: { roundId_voterId: { roundId: currentRound.id, voterId: userId } },
        select: { id: true },
      });
      hasSubmitted = Boolean(rv);
    }

    // Calculate submission counts
    const totalDrawings = currentRound.flipbooks.reduce(
      (sum, fb) => sum + fb.drawings.length,
      0
    );
    const totalGuesses = currentRound.flipbooks.reduce(
      (sum, fb) => sum + fb.guesses.length,
      0
    );

    const flipbookCount = currentRound.flipbooks.length;
    const expectedDrawings = flipbookCount * Math.max(0, playerCount - 1);
    const expectedGuesses = flipbookCount * Math.max(0, playerCount - 1);

    const endsAtMs = currentRound.phaseDeadline
      ? new Date(currentRound.phaseDeadline).getTime()
      : null;

    logDebug('game_state', {
      roomCode: lobby.roomCode,
      lobbyId: lobby.id,
      userId,
      roundId: currentRound.id,
      chainWave,
      phase: currentPhase,
      myRole,
      hasSubmitted,
      assignedFlipbookId: assignedFlipbook?.id ?? workFlipbookId,
      workFlipbookId,
    });

    const workFb = workFlipbookId
      ? currentRound.flipbooks.find((fb) => fb.id === workFlipbookId)
      : null;

    let voteFlipbooks:
      | Array<{
          id: string;
          authorId: string;
          authorUsername: string;
          prompt: string;
          finalDrawingData: string | null;
          votes: number;
        }>
      | undefined;

    if (currentPhase === 'VOTING') {
      const order = lobby.players.map((p) => p.id);
      const sorted = [...currentRound.flipbooks].sort((a, b) => {
        const ai = order.indexOf(a.authorId);
        const bi = order.indexOf(b.authorId);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      voteFlipbooks = [];
      for (const fb of sorted) {
        const drawingsSorted = [...fb.drawings].sort((d1, d2) => d2.order - d1.order);
        const lastDrawing = drawingsSorted[0];
        let finalDrawingData: string | null = null;
        if (lastDrawing) {
          try {
            finalDrawingData = await resolveGameDrawingPayload(lastDrawing);
          } catch {
            finalDrawingData = null;
          }
        }
        voteFlipbooks.push({
          id: fb.id,
          authorId: fb.author.id,
          authorUsername: fb.author.username,
          prompt: fb.prompt,
          finalDrawingData,
          votes: fb.votes,
        });
      }
    }

    return {
      ...baseState,
      roundId: currentRound.id,
      roundNumber: currentRound.number,
      phase: currentPhase,
      endsAt: endsAtMs,
      chainWave,
      maxChainWave: Math.max(0, playerCount - 1),
      myFlipbookId,
      myRole,
      hasSubmitted,
      assignedFlipbookId: assignedFlipbook?.id || workFlipbookId || null,
      assignedPrompt: assignedFlipbook?.prompt || workFb?.prompt || null,
      workFlipbookId,
      workFlipbookDrawFromText,
      voteFlipbooks,
      counts: {
        submittedDrawings: totalDrawings,
        expectedDrawings,
        submittedGuesses: totalGuesses,
        expectedGuesses,
        totalPlayers: playerCount,
      },
      flipbooks: currentRound.flipbooks.map(fb => ({
        id: fb.id,
        prompt: fb.prompt,
        authorId: fb.author.id,
        authorUsername: fb.author.username,
        state: fb.state,
        drawingCount: fb.drawings.length,
        guessCount: fb.guesses.length,
        votes: fb.votes,
      })),
    };
  } catch (error: any) {
    logError('Failed to get game state', { roomCode, userId, error: error.message });
    throw error;
  }
}
