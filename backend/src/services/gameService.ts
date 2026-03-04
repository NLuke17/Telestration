import prisma from '../prisma/client';
import { logInfo, logError } from '../utils/logger';

/**
 * Start a new game for a lobby
 * - Creates a new Round
 * - Creates Flipbooks (1 per player)
 * - Sets lobby to IN_PROGRESS
 * - Assigns initial prompts to flipbooks
 * 
 * @param lobbyId - The lobby to start the game for
 * @param customPrompts - Optional array of custom prompts (1 per player). If not provided, generates random prompts.
 */
export async function startGame(lobbyId: string, customPrompts?: string[]) {
  try {
    // Get lobby with players
    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: {
        players: { select: { id: true, username: true } },
        rounds: { orderBy: { number: 'desc' }, take: 1 },
      },
    });

    if (!lobby) {
      throw new Error('LOBBY_NOT_FOUND');
    }

    if (lobby.state !== 'WAITING') {
      throw new Error('LOBBY_ALREADY_STARTED');
    }

    if (lobby.players.length < 2) {
      throw new Error('NOT_ENOUGH_PLAYERS');
    }

    // Validate custom prompts if provided
    if (customPrompts) {
      if (customPrompts.length !== lobby.players.length) {
        throw new Error('PROMPT_COUNT_MISMATCH');
      }
      
      // Check that all prompts are non-empty
      if (customPrompts.some(prompt => !prompt || prompt.trim().length === 0)) {
        throw new Error('INVALID_PROMPTS');
      }
    }

    // Calculate next round number
    const nextRoundNumber = (lobby.rounds[0]?.number ?? 0) + 1;

    // Create round and flipbooks in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the round
      const round = await tx.round.create({
        data: {
          number: nextRoundNumber,
          lobbyId,
        },
      });

      // Create flipbooks for each player with initial prompts
      const flipbooks = await Promise.all(
        lobby.players.map((player, index) =>
          tx.flipbook.create({
            data: {
              prompt: customPrompts ? customPrompts[index].trim() : generateInitialPrompt(player.username, index),
              authorId: player.id,
              roundId: round.id,
              state: 'DRAWING',
            },
            include: {
              author: { select: { id: true, username: true, profilePicture: true } },
            },
          })
        )
      );

      // Update lobby state to IN_PROGRESS
      const updatedLobby = await tx.lobby.update({
        where: { id: lobbyId },
        data: { state: 'IN_PROGRESS' },
        include: {
          host: { select: { id: true, username: true, profilePicture: true } },
          players: { select: { id: true, username: true, profilePicture: true } },
        },
      });

      return { round, flipbooks, lobby: updatedLobby };
    });

    logInfo('Game started successfully', {
      lobbyId,
      roundId: result.round.id,
      roundNumber: nextRoundNumber,
      flipbookCount: result.flipbooks.length,
    });

    return result;
  } catch (error: any) {
    logError('Failed to start game', { lobbyId, error: error.message });
    throw error;
  }
}

/**
 * Get the current round for a lobby
 */
export async function getCurrentRound(lobbyId: string) {
  const round = await prisma.round.findFirst({
    where: { lobbyId },
    orderBy: { number: 'desc' },
    include: {
      flipbooks: {
        include: {
          author: { select: { id: true, username: true, profilePicture: true } },
          drawings: {
            orderBy: { order: 'asc' },
            include: {
              author: { select: { id: true, username: true, profilePicture: true } },
            },
          },
          guesses: {
            orderBy: { order: 'asc' },
            include: {
              author: { select: { id: true, username: true, profilePicture: true } },
            },
          },
        },
      },
    },
  });

  if (!round) {
    throw new Error('ROUND_NOT_FOUND');
  }

  return round;
}

/**
 * Submit a drawing to a flipbook
 */
export async function submitDrawing(
  flipbookId: string,
  userId: string,
  drawingData: string
) {
  try {
    const flipbook = await prisma.flipbook.findUnique({
      where: { id: flipbookId },
      include: {
        drawings: { orderBy: { order: 'desc' }, take: 1 },
        guesses: { orderBy: { order: 'desc' }, take: 1 },
      },
    });

    if (!flipbook) {
      throw new Error('FLIPBOOK_NOT_FOUND');
    }

    if (flipbook.state !== 'DRAWING') {
      throw new Error('FLIPBOOK_NOT_ACCEPTING_DRAWINGS');
    }

    // IMPORTANT: Prevent drawing on your own flipbook!
    if (flipbook.authorId === userId) {
      throw new Error('CANNOT_DRAW_OWN_FLIPBOOK');
    }

    // Calculate the next order number
    const lastDrawing = flipbook.drawings[0];
    const lastGuess = flipbook.guesses[0];
    const nextOrder = Math.max(
      lastDrawing?.order ?? 0,
      lastGuess?.order ?? 0
    ) + 1;

    // Create the drawing
    const drawing = await prisma.drawing.create({
      data: {
        drawingData,
        order: nextOrder,
        flipbookId,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, username: true, profilePicture: true } },
      },
    });

    logInfo('Drawing submitted', {
      flipbookId,
      userId,
      drawingId: drawing.id,
      order: nextOrder,
    });

    return drawing;
  } catch (error: any) {
    logError('Failed to submit drawing', { flipbookId, userId, error: error.message });
    throw error;
  }
}

/**
 * Submit a guess to a flipbook
 */
export async function submitGuess(
  flipbookId: string,
  userId: string,
  text: string
) {
  try {
    const flipbook = await prisma.flipbook.findUnique({
      where: { id: flipbookId },
      include: {
        drawings: { orderBy: { order: 'desc' }, take: 1 },
        guesses: { orderBy: { order: 'desc' }, take: 1 },
      },
    });

    if (!flipbook) {
      throw new Error('FLIPBOOK_NOT_FOUND');
    }

    if (flipbook.state !== 'GUESSING') {
      throw new Error('FLIPBOOK_NOT_ACCEPTING_GUESSES');
    }

    // IMPORTANT: Prevent guessing on your own flipbook!
    if (flipbook.authorId === userId) {
      throw new Error('CANNOT_GUESS_OWN_FLIPBOOK');
    }

    // Calculate the next order number
    const lastDrawing = flipbook.drawings[0];
    const lastGuess = flipbook.guesses[0];
    const nextOrder = Math.max(
      lastDrawing?.order ?? 0,
      lastGuess?.order ?? 0
    ) + 1;

    // Create the guess
    const guess = await prisma.guess.create({
      data: {
        text,
        order: nextOrder,
        flipbookId,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, username: true, profilePicture: true } },
      },
    });

    logInfo('Guess submitted', {
      flipbookId,
      userId,
      guessId: guess.id,
      order: nextOrder,
    });

    return guess;
  } catch (error: any) {
    logError('Failed to submit guess', { flipbookId, userId, error: error.message });
    throw error;
  }
}

/**
 * Get the assigned flipbook for a player to work on
 * Players should NOT work on their own flipbook
 * 
 * @param roundId - The current round
 * @param userId - The player requesting assignment
 * @param phase - Current phase (DRAWING or GUESSING)
 * @returns The flipbook to work on, or null if player has completed all work
 */
export async function getAssignedFlipbook(
  roundId: string,
  userId: string,
  phase: 'DRAWING' | 'GUESSING'
) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      flipbooks: {
        include: {
          author: { select: { id: true, username: true, profilePicture: true } },
          drawings: {
            include: {
              author: { select: { id: true, username: true } },
            },
          },
          guesses: {
            include: {
              author: { select: { id: true, username: true } },
            },
          },
        },
      },
    },
  });

  if (!round) {
    throw new Error('ROUND_NOT_FOUND');
  }

  // Filter flipbooks to find ones this player should work on
  const availableFlipbooks = round.flipbooks.filter((flipbook) => {
    // Cannot work on your own flipbook
    if (flipbook.authorId === userId) {
      return false;
    }

    if (phase === 'DRAWING') {
      // Check if player has already drawn on this flipbook
      const hasDrawn = flipbook.drawings.some((d) => d.authorId === userId);
      return !hasDrawn;
    } else if (phase === 'GUESSING') {
      // Check if player has already guessed on this flipbook
      const hasGuessed = flipbook.guesses.some((g) => g.authorId === userId);
      return !hasGuessed;
    }

    return false;
  });

  // Return the first available flipbook (or null if none available)
  if (availableFlipbooks.length === 0) {
    return null;
  }

  // Return the first available flipbook
  return availableFlipbooks[0];
}

/**
 * Advance flipbook to the next phase
 */
export async function advanceFlipbookPhase(flipbookId: string) {
  const flipbook = await prisma.flipbook.findUnique({
    where: { id: flipbookId },
  });

  if (!flipbook) {
    throw new Error('FLIPBOOK_NOT_FOUND');
  }

  let nextState: 'DRAWING' | 'GUESSING' | 'VOTING';

  switch (flipbook.state) {
    case 'DRAWING':
      nextState = 'GUESSING';
      break;
    case 'GUESSING':
      nextState = 'VOTING';
      break;
    case 'VOTING':
      nextState = 'DRAWING';
      break;
    default:
      throw new Error('INVALID_FLIPBOOK_STATE');
  }

  return prisma.flipbook.update({
    where: { id: flipbookId },
    data: { state: nextState },
  });
}

/**
 * Check if all players have submitted for current phase
 */
export async function checkPhaseCompletion(roundId: string, phase: 'DRAWING' | 'GUESSING'): Promise<boolean> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      flipbooks: {
        include: {
          drawings: true,
          guesses: true,
        },
      },
      lobby: {
        include: {
          players: true,
        },
      },
    },
  });

  if (!round) {
    throw new Error('ROUND_NOT_FOUND');
  }

  const playerCount = round.lobby.players.length;

  // For each flipbook, check if enough submissions exist
  for (const flipbook of round.flipbooks) {
    const submissionCount =
      phase === 'DRAWING' ? flipbook.drawings.length : flipbook.guesses.length;

    // Each player should contribute once (except the original author)
    if (submissionCount < playerCount - 1) {
      return false;
    }
  }

  return true;
}

/**
 * Generate initial prompt for a flipbook
 * Used as fallback when custom prompts are not provided
 * In production, you might want to use a prompt database or API
 */
function generateInitialPrompt(username: string, index: number): string {
  const prompts = [
    'A cat wearing a top hat',
    'A robot dancing in the rain',
    'A dragon eating ice cream',
    'A wizard casting a spell',
    'A superhero flying over a city',
    'An astronaut on the moon',
    'A pirate searching for treasure',
    'A ninja in a library',
    'A detective solving a mystery',
    'A chef cooking a meal',
    'A knight fighting a dragon',
    'A surfer riding a wave',
    'A scientist in a lab',
    'A musician playing guitar',
    'A firefighter saving a cat',
    'A teacher in a classroom',
  ];

  return prompts[index % prompts.length];
}
