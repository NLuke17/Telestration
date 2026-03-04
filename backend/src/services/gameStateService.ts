import prisma from '../prisma/client';
import { getCurrentRound, getAssignedFlipbook } from './gameService';
import { logInfo, logError } from '../utils/logger';

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

    // Determine current phase from flipbooks
    const flipbookStates = currentRound.flipbooks.map(fb => fb.state);
    const majorityState = getMajorityState(flipbookStates);
    const currentPhase = majorityState || 'DRAWING';

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
          
          // Check if user has already submitted to this flipbook
          if (currentPhase === 'DRAWING') {
            hasSubmitted = assignedFlipbook.drawings.some((d: any) => d.authorId === userId);
          } else {
            hasSubmitted = assignedFlipbook.guesses.some((g: any) => g.authorId === userId);
          }
        } else {
          // No assignment means user has completed all work for this phase
          myRole = currentPhase.toLowerCase();
          hasSubmitted = true;
        }
      } catch (error) {
        // If assignment fails, user might not be in the game
        myRole = null;
        hasSubmitted = false;
      }
    } else if (currentPhase === 'VOTING') {
      myRole = 'voting';
      // TODO: Check if user has voted
      hasSubmitted = false;
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

    // Calculate expected counts
    const playerCount = lobby.players.length;
    const flipbookCount = currentRound.flipbooks.length;
    const expectedDrawings = flipbookCount * (playerCount - 1); // Each flipbook gets (n-1) drawings
    const expectedGuesses = flipbookCount * (playerCount - 1); // Each flipbook gets (n-1) guesses

    // Calculate phase timer (would need to be stored or calculated)
    // For now, return null - this should be managed by phase start timestamps
    const endsAt = null;

    logInfo('Game state retrieved', {
      lobbyId: lobby.id,
      userId,
      roundId: currentRound.id,
      phase: currentPhase,
      myRole,
      hasSubmitted,
    });

    return {
      ...baseState,
      roundId: currentRound.id,
      roundNumber: currentRound.number,
      phase: currentPhase,
      endsAt,
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

/**
 * Helper to determine the majority state of flipbooks
 * (in case flipbooks are in different states during transition)
 */
function getMajorityState(states: string[]): 'DRAWING' | 'GUESSING' | 'VOTING' {
  if (states.length === 0) return 'DRAWING';

  const counts: Record<string, number> = {};
  states.forEach(state => {
    counts[state] = (counts[state] || 0) + 1;
  });

  let maxCount = 0;
  let majorityState: 'DRAWING' | 'GUESSING' | 'VOTING' = 'DRAWING';
  
  for (const [state, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      majorityState = state as 'DRAWING' | 'GUESSING' | 'VOTING';
    }
  }

  return majorityState;
}
