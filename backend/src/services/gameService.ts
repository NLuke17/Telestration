import { randomUUID } from 'crypto';
import prisma from '../prisma/client';
import { logInfo, logError, logDebug } from '../utils/logger';
import { persistGameDrawingPayload, resolveGameDrawingPayload } from './drawingStorageService';
import {
  DRAWING_PHASE_DURATION_MS,
  GUESSING_PHASE_DURATION_MS,
} from '../config/constants';

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

    // FINISHED = previous game ended (e.g. host returned from recap); same room can start again.
    if (lobby.state !== 'WAITING' && lobby.state !== 'FINISHED') {
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
          chainWave: customPrompts ? 1 : 0,
        },
      });

      // Create flipbooks for each player with initial prompts
      const flipbooks = await Promise.all(
        lobby.players.map((player, index) =>
          tx.flipbook.create({
            data: {
              prompt: customPrompts ? customPrompts[index].trim() : '', // Empty prompt if no custom prompts
              authorId: player.id,
              roundId: round.id,
              state: customPrompts ? 'DRAWING' : 'GUESSING', // Start in GUESSING if no prompts (players write their own)
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

export async function getLobbyIdForFlipbook(flipbookId: string): Promise<string | null> {
  const row = await prisma.flipbook.findUnique({
    where: { id: flipbookId },
    select: { round: { select: { lobbyId: true } } },
  });
  return row?.round?.lobbyId ?? null;
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
            select: {
              id: true,
              order: true,
              createdAt: true,
              authorId: true,
              storageKind: true,
              storageKey: true,
              byteLength: true,
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

    const existing = await prisma.drawing.findFirst({
      where: { flipbookId, authorId: userId },
      orderBy: { order: 'desc' },
    });

    if (existing) {
      const persisted = await persistGameDrawingPayload(flipbookId, existing.id, drawingData);
      const drawing = await prisma.drawing.update({
        where: { id: existing.id },
        data: {
          drawingData: persisted.drawingData,
          storageKind: persisted.storageKind,
          storageKey: persisted.storageKey,
          byteLength: persisted.byteLength,
        },
        include: {
          author: { select: { id: true, username: true, profilePicture: true } },
        },
      });

      logInfo('Drawing updated (resubmit)', {
        flipbookId,
        userId,
        drawingId: drawing.id,
        order: existing.order,
      });

      return drawing;
    }

    // Calculate the next order number
    const lastDrawing = flipbook.drawings[0];
    const lastGuess = flipbook.guesses[0];
    const nextOrder = Math.max(
      lastDrawing?.order ?? 0,
      lastGuess?.order ?? 0
    ) + 1;

    const drawingId = randomUUID();
    const persisted = await persistGameDrawingPayload(flipbookId, drawingId, drawingData);

    const drawing = await prisma.drawing.create({
      data: {
        id: drawingId,
        drawingData: persisted.drawingData,
        storageKind: persisted.storageKind,
        storageKey: persisted.storageKey,
        byteLength: persisted.byteLength,
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
        round: { select: { chainWave: true } },
      },
    });

    if (!flipbook) {
      throw new Error('FLIPBOOK_NOT_FOUND');
    }

    if (flipbook.state !== 'GUESSING') {
      throw new Error('FLIPBOOK_NOT_ACCEPTING_GUESSES');
    }

    const isInitialPrompt = !flipbook.prompt || flipbook.prompt.trim().length === 0;
    const chainWave = flipbook.round?.chainWave ?? 0;

    if (flipbook.authorId === userId && !isInitialPrompt) {
      if (chainWave !== 0) {
        throw new Error('INITIAL_PROMPT_ALREADY_SUBMITTED');
      }
      await prisma.flipbook.update({
        where: { id: flipbookId },
        data: { prompt: text.trim() },
      });
      logInfo('Initial prompt updated (resubmit)', {
        flipbookId,
        userId,
        prompt: text.trim(),
      });
      return { id: flipbookId, text: text.trim(), isInitialPrompt: true };
    }

    // Special case: If flipbook has no prompt, this is the initial prompt submission (player writes on their own)
    if (isInitialPrompt) {
      // Allow writing initial prompt on own flipbook
      if (flipbook.authorId !== userId) {
        throw new Error('CAN_ONLY_WRITE_OWN_INITIAL_PROMPT');
      }
      
      // Update the flipbook's prompt instead of creating a guess
      await prisma.flipbook.update({
        where: { id: flipbookId },
        data: { prompt: text.trim() },
      });

      logInfo('Initial prompt submitted', {
        flipbookId,
        userId,
        prompt: text.trim(),
      });
      
      return { id: flipbookId, text: text.trim(), isInitialPrompt: true };
    }

    // Normal guessing: Prevent guessing on your own flipbook
    if (flipbook.authorId === userId) {
      throw new Error('CANNOT_GUESS_OWN_FLIPBOOK');
    }

    const existingGuess = await prisma.guess.findFirst({
      where: { flipbookId, authorId: userId },
      orderBy: { order: 'desc' },
    });

    if (existingGuess) {
      const guess = await prisma.guess.update({
        where: { id: existingGuess.id },
        data: { text },
        include: {
          author: { select: { id: true, username: true, profilePicture: true } },
        },
      });
      logInfo('Guess updated (resubmit)', {
        flipbookId,
        userId,
        guessId: guess.id,
        order: existingGuess.order,
      });
      return guess;
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

export type GameplayPhase = 'DRAWING' | 'GUESSING' | 'RECAP' | 'VOTING';

/**
 * Derive the active play phase from `chainWave` and player count `N`.
 * wave 0: everyone writes their prompt on their own book (GUESSING in UI).
 * waves 1..N-1: odd = DRAWING, even = GUESSING (telephone chain).
 * wave N: host-driven recap.
 * wave N+1: favorite voting (not your own flipbook).
 */
export function deriveExpectedPhaseFromChainWave(
  chainWave: number,
  playerCount: number
): GameplayPhase {
  const N = playerCount;
  if (N < 1) return 'GUESSING';
  if (chainWave <= 0) return 'GUESSING';
  if (chainWave > N) return 'VOTING';
  if (chainWave === N) return 'RECAP';
  return chainWave % 2 === 1 ? 'DRAWING' : 'GUESSING';
}

/**
 * Remove this user's submission on the given flipbook so they can edit again.
 * Initial prompts (wave 0, own book) are not cleared here — the client edits locally and resubmits an update.
 */
export async function revokePhaseSubmission(flipbookId: string, userId: string): Promise<void> {
  const flipbook = await prisma.flipbook.findUnique({
    where: { id: flipbookId },
    include: {
      round: {
        include: {
          lobby: {
            include: {
              players: { select: { id: true }, orderBy: { createdAt: 'asc' } },
            },
          },
        },
      },
    },
  });

  if (!flipbook) {
    throw new Error('FLIPBOOK_NOT_FOUND');
  }

  const N = flipbook.round.lobby.players.length;
  const w = flipbook.round.chainWave ?? 0;
  const phase = deriveExpectedPhaseFromChainWave(w, N);

  if (phase === 'RECAP' || phase === 'VOTING') {
    throw new Error('REVOKE_NOT_ALLOWED');
  }

  if (phase === 'DRAWING') {
    if (flipbook.state !== 'DRAWING') {
      throw new Error('REVOKE_NOT_ALLOWED');
    }
    await prisma.drawing.deleteMany({ where: { flipbookId, authorId: userId } });
    logInfo('Drawing submission revoked', { flipbookId, userId });
    return;
  }

  if (phase === 'GUESSING') {
    if (flipbook.state !== 'GUESSING') {
      throw new Error('REVOKE_NOT_ALLOWED');
    }
    if (w === 0 && flipbook.authorId === userId) {
      return;
    }
    await prisma.guess.deleteMany({ where: { flipbookId, authorId: userId } });
    logInfo('Guess submission revoked', { flipbookId, userId });
  }
}

function lastGuessText(flipbook: { guesses: { order: number; text: string }[] }): string | null {
  if (!flipbook.guesses.length) return null;
  const sorted = [...flipbook.guesses].sort((a, b) => a.order - b.order);
  return sorted[sorted.length - 1]?.text ?? null;
}

/**
 * Get the assigned flipbook for a player to work on
 * Players should NOT work on their own flipbook (except initial prompt on own book).
 */
export async function getAssignedFlipbook(
  roundId: string,
  userId: string,
  phase: 'DRAWING' | 'GUESSING'
) {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      lobby: {
        include: {
          players: { select: { id: true, username: true, profilePicture: true }, orderBy: { createdAt: 'asc' } },
        },
      },
      flipbooks: {
        include: {
          author: { select: { id: true, username: true, profilePicture: true } },
          drawings: {
            select: {
              id: true,
              authorId: true,
              order: true,
              createdAt: true,
            },
          },
          guesses: {
            select: {
              id: true,
              authorId: true,
              order: true,
              text: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!round) {
    throw new Error('ROUND_NOT_FOUND');
  }

  const playerIds = round.lobby.players.map((p) => p.id);
  const N = playerIds.length;
  const w = round.chainWave;
  const expected = deriveExpectedPhaseFromChainWave(w, N);

  if (expected === 'RECAP' || expected === 'VOTING' || expected !== phase) {
    return null;
  }

  // Initial prompts: chainWave 0 — only your own flipbook while its prompt is still empty.
  // Do not surface other players' books here: initial text lives on `prompt`, not in `guesses`,
  // so the old "non-empty book + !hasGuessed" branch wrongly matched peers' books and made
  // `getGameState` report hasSubmitted=false for players who had already submitted (3+ players).
  if (w === 0) {
    if (phase === 'DRAWING') {
      return null;
    }
    const mine = round.flipbooks.find(
      (fb) =>
        fb.authorId === userId &&
        (!fb.prompt || fb.prompt.trim().length === 0)
    );
    return mine ?? null;
  }

  // Telephone chain: at wave w, player index i works on author (i + w) mod N
  const idx = playerIds.indexOf(userId);
  if (idx < 0) {
    return null;
  }

  const targetAuthorId = playerIds[(idx + w) % N];
  const flipbook = round.flipbooks.find((fb) => fb.authorId === targetAuthorId);
  if (!flipbook) {
    return null;
  }

  if (phase === 'DRAWING') {
    const hasDrawn = flipbook.drawings.some((d) => d.authorId === userId);
    if (hasDrawn) return null;
    const guessLine = lastGuessText(flipbook);
    return {
      ...flipbook,
      drawFromText: guessLine && guessLine.trim().length > 0 ? guessLine : flipbook.prompt,
    };
  }

  const hasGuessed = flipbook.guesses.some((g) => g.authorId === userId);
  if (hasGuessed) return null;

  const guessLine = lastGuessText(flipbook);
  const latestDrawingRow = await prisma.drawing.findFirst({
    where: { flipbookId: flipbook.id },
    orderBy: { order: 'desc' },
  });
  let latestDrawingData: string | null = null;
  if (latestDrawingRow) {
    try {
      latestDrawingData = await resolveGameDrawingPayload(latestDrawingRow);
    } catch {
      latestDrawingData = null;
    }
  }

  return {
    ...flipbook,
    drawFromText: guessLine && guessLine.trim().length > 0 ? guessLine : flipbook.prompt,
    latestDrawingData,
  };
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
 * Check if all players have submitted for the current chain wave / phase.
 */
export async function checkPhaseCompletion(roundId: string, phase: 'DRAWING' | 'GUESSING'): Promise<boolean> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      flipbooks: {
        include: {
          _count: { select: { drawings: true, guesses: true } },
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

  const N = round.lobby.players.length;
  const w = round.chainWave;

  if (w < 1 || w > N - 1) {
    return false;
  }

  const expected = deriveExpectedPhaseFromChainWave(w, N);
  if (expected !== phase) {
    return false;
  }

  if (phase === 'DRAWING') {
    const needPerBook = (w + 1) / 2;
    return round.flipbooks.every((fb) => fb._count.drawings >= needPerBook);
  }

  const needGuessesPerBook = w / 2;
  return round.flipbooks.every((fb) => fb._count.guesses >= needGuessesPerBook);
}

export type AdvanceRoundResult =
  | { advanced: false }
  | {
      advanced: true;
      newPhase: 'DRAWING' | 'GUESSING' | 'RECAP' | 'VOTING';
      lobbyId: string;
      roundId: string;
      endsAt: number | null;
    };

/**
 * When every flipbook has the submissions required for the current wave, advance chainWave
 * (or enter VOTING for recap). Uses optimistic locking on `chainWave` to avoid double advance.
 */
export async function advanceRoundIfChainPhaseComplete(
  lobbyId: string,
  completedPhase: 'DRAWING' | 'GUESSING'
): Promise<AdvanceRoundResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const round = await tx.round.findFirst({
        where: { lobbyId },
        orderBy: { number: 'desc' },
        include: {
          lobby: { include: { players: { select: { id: true }, orderBy: { createdAt: 'asc' } } } },
          flipbooks: {
            include: {
              _count: { select: { drawings: true, guesses: true } },
            },
          },
        },
      });

      if (!round) {
        return { advanced: false };
      }

      const N = round.lobby.players.length;
      const w = round.chainWave;

      if (w < 1 || w > N - 1) {
        return { advanced: false };
      }

      const expected = deriveExpectedPhaseFromChainWave(w, N);
      if (expected !== completedPhase) {
        return { advanced: false };
      }

      if (completedPhase === 'DRAWING') {
        const need = (w + 1) / 2;
        if (!round.flipbooks.every((fb) => fb._count.drawings >= need)) {
          return { advanced: false };
        }
      } else {
        const need = w / 2;
        if (!round.flipbooks.every((fb) => fb._count.guesses >= need)) {
          return { advanced: false };
        }
      }

      const nextWave = w + 1;
      const nextDeadlineDraw = new Date(Date.now() + DRAWING_PHASE_DURATION_MS);
      const nextDeadlineGuess = new Date(Date.now() + GUESSING_PHASE_DURATION_MS);

      if (nextWave > N - 1) {
        const upd = await tx.round.updateMany({
          where: { id: round.id, chainWave: w },
          data: {
            chainWave: N,
            phaseDeadline: null,
          },
        });
        if (upd.count === 0) {
          return { advanced: false };
        }

        await tx.flipbook.updateMany({
          where: { roundId: round.id },
          data: { state: 'VOTING' },
        });

        return {
          advanced: true,
          newPhase: 'RECAP',
          lobbyId,
          roundId: round.id,
          endsAt: null,
        };
      }

      const nextPhase = deriveExpectedPhaseFromChainWave(nextWave, N) as 'DRAWING' | 'GUESSING';
      const deadline = nextPhase === 'DRAWING' ? nextDeadlineDraw : nextDeadlineGuess;

      const upd = await tx.round.updateMany({
        where: { id: round.id, chainWave: w },
        data: {
          chainWave: nextWave,
          phaseDeadline: deadline,
        },
      });
      if (upd.count === 0) {
        return { advanced: false };
      }

      await tx.flipbook.updateMany({
        where: { roundId: round.id },
        data: { state: nextPhase },
      });

      return {
        advanced: true,
        newPhase: nextPhase,
        lobbyId,
        roundId: round.id,
        endsAt: deadline.getTime(),
      };
    });
  } catch (error: any) {
    logError('advanceRoundIfChainPhaseComplete failed', { lobbyId, error: error.message });
    return { advanced: false };
  }
}

/**
 * If chainWave is 0 and every flipbook has a non-empty prompt (count matches lobby player count),
 * advance to wave 1 (DRAWING). Idempotent — safe from HTTP polling and WS handlers.
 */
export async function tryAdvanceInitialPromptsIfReady(
  lobbyId: string
): Promise<{ advanced: boolean; endsAt?: number; skipReason?: string }> {
  if (!lobbyId || typeof lobbyId !== 'string') {
    logDebug('tryAdvanceInitialPromptsIfReady: invalid lobbyId', { lobbyId });
    return { advanced: false, skipReason: 'no_lobby_id' };
  }

  const endsAt = Date.now() + DRAWING_PHASE_DURATION_MS;
  try {
    type TxOutcome =
      | { advanced: true }
      | { advanced: false; skipReason: string; meta?: Record<string, number | string> };

    const outcome = await prisma.$transaction(
      async (tx): Promise<TxOutcome> => {
      const round = await tx.round.findFirst({
        where: { lobbyId },
        orderBy: { number: 'desc' },
        select: { id: true, chainWave: true },
      });
      if (!round) {
        return { advanced: false, skipReason: 'no_round' };
      }
      if (round.chainWave !== 0) {
        return {
          advanced: false,
          skipReason: 'chain_wave_not_zero',
          meta: { chainWave: round.chainWave },
        };
      }

      const lobbyRow = await tx.lobby.findUnique({
        where: { id: lobbyId },
        select: { _count: { select: { players: true } } },
      });
      const playerCount = lobbyRow?._count.players ?? 0;

      const flipbooks = await tx.flipbook.findMany({
        where: { roundId: round.id },
        select: { prompt: true },
      });

      if (playerCount < 2 || flipbooks.length !== playerCount) {
        return {
          advanced: false,
          skipReason: 'player_or_flipbook_count_mismatch',
          meta: { playerCount, flipbookCount: flipbooks.length },
        };
      }

      const allPromptsSubmitted = flipbooks.every(
        (fb) => fb.prompt && fb.prompt.trim().length > 0
      );
      if (!allPromptsSubmitted) {
        const emptyCount = flipbooks.filter((fb) => !fb.prompt?.trim()).length;
        return {
          advanced: false,
          skipReason: 'prompts_incomplete',
          meta: { emptyFlipbooks: emptyCount },
        };
      }

      const roundUpdated = await tx.round.updateMany({
        where: { id: round.id, chainWave: 0 },
        data: {
          chainWave: 1,
          phaseDeadline: new Date(endsAt),
        },
      });
      if (roundUpdated.count === 0) {
        return { advanced: false, skipReason: 'round_update_race_lost' };
      }

      await tx.flipbook.updateMany({
        where: { roundId: round.id },
        data: { state: 'DRAWING' },
      });

      return { advanced: true };
    },
      {
        maxWait: 10_000,
        timeout: 15_000,
      }
    );

    if (outcome.advanced) {
      logInfo('tryAdvanceInitialPromptsIfReady: advanced to DRAWING (wave 1)', {
        lobbyId,
        endsAt,
      });
      return { advanced: true, endsAt };
    }

    logDebug('tryAdvanceInitialPromptsIfReady: skipped', {
      lobbyId,
      skipReason: outcome.skipReason,
      ...(outcome.meta ?? {}),
    });
    return { advanced: false, skipReason: outcome.skipReason };
  } catch (error: any) {
    logError('tryAdvanceInitialPromptsIfReady failed', { lobbyId, error: error.message });
    return { advanced: false };
  }
}

export async function tryAdvanceInitialPromptsIfReadyByRoomCode(roomCodeRaw: string): Promise<{
  advanced: boolean;
  endsAt?: number;
  lobbyId?: string;
}> {
  const roomCode = roomCodeRaw.toUpperCase();
  const lobby = await prisma.lobby.findUnique({
    where: { roomCode },
    select: { id: true, state: true },
  });
  if (!lobby || lobby.state !== 'IN_PROGRESS') {
    return { advanced: false };
  }
  const result = await tryAdvanceInitialPromptsIfReady(lobby.id);
  return { ...result, lobbyId: lobby.id };
}

