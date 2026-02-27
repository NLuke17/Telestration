import prisma from '../prisma/client';
import { logInfo, logError } from '../utils/logger';

/**
 * Start a new game for a lobby
 * - Creates a new Round
 * - Creates Flipbooks (1 per player)
 * - Sets lobby to IN_PROGRESS
 * - Assigns initial prompts to flipbooks
 */
export async function startGame(lobbyId: string) {
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
              prompt: generateInitialPrompt(player.username, index),
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
  ];

  return prompts[index % prompts.length];
}
