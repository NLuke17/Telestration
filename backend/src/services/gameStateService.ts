import prisma from '../prisma/client';
import { getAssignedFlipbook, deriveExpectedPhaseFromChainWave } from './gameService';
import { logDebug, logError } from '../utils/logger';

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
                    createdAt: true 
                  },
                },
                guesses: {
                  select: { 
                    id: true, 
                    authorId: true,
                    order: true,
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

    if (currentPhase === 'DRAWING' || currentPhase === 'GUESSING') {
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
          const ids = lobby.players.map((p) => p.id);
          const idx = ids.indexOf(userId);
          if (idx < 0) {
            hasSubmitted = true;
          } else if (currentPhase === 'DRAWING' && chainWave >= 1 && chainWave < playerCount) {
            const tid = ids[(idx + chainWave) % playerCount];
            const tb = currentRound.flipbooks.find((fb) => fb.authorId === tid);
            hasSubmitted = tb ? tb.drawings.some((d: { authorId: string }) => d.authorId === userId) : true;
          } else if (currentPhase === 'GUESSING' && chainWave >= 1 && chainWave < playerCount) {
            const tid = ids[(idx + chainWave) % playerCount];
            const tb = currentRound.flipbooks.find((fb) => fb.authorId === tid);
            hasSubmitted = tb ? tb.guesses.some((g: { authorId: string }) => g.authorId === userId) : true;
          } else {
            hasSubmitted = true;
          }
        }
      } catch (error) {
        myRole = null;
        hasSubmitted = false;
      }
    } else if (currentPhase === 'VOTING') {
      myRole = 'recap';
      hasSubmitted = true;
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
      assignedFlipbookId: assignedFlipbook?.id ?? null,
    });

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
      assignedFlipbookId: assignedFlipbook?.id || null,
      assignedPrompt: assignedFlipbook?.prompt || null,
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
