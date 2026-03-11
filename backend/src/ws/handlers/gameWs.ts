import { WSContext } from '../context/wsContext';
import { ClientConn } from '../core/clientConn';
import { send, broadcast } from '../core/wsUtils';
import { submitDrawing, submitGuess, getCurrentRound, checkPhaseCompletion } from '../../services/gameService';
import { logInfo, logError } from '../../utils/logger';

/**
 * Handle drawing submission
 */
export async function handleDrawingSubmission(
  ctx: WSContext,
  conn: ClientConn,
  msg: { type: 'game:submit_drawing'; flipbookId: string; drawingData: string }
): Promise<void> {
  if (!conn.lobbyId || !conn.userId) {
    send(conn, { type: 'error', error: 'NOT_AUTHENTICATED', message: 'Not authenticated' });
    return;
  }

  try {
    const drawing = await submitDrawing(msg.flipbookId, conn.userId, msg.drawingData);

    // Notify the lobby that a drawing was submitted
    const connections = ctx.registry.getLobbyConnections(conn.lobbyId);
    broadcast(connections, {
      type: 'game:drawing_submitted',
      flipbookId: msg.flipbookId,
      userId: conn.userId,
    });

    // Check if all players have finished this phase
    const round = await getCurrentRound(conn.lobbyId);
    const isPhaseComplete = await checkPhaseCompletion(round.id, 'DRAWING');

    if (isPhaseComplete) {
      broadcast(connections, {
        type: 'game:phase_complete',
        phase: 'DRAWING',
      });
    }

    logInfo('Drawing submitted', {
      lobbyId: conn.lobbyId,
      flipbookId: msg.flipbookId,
      userId: conn.userId,
      drawingId: drawing.id,
      isPhaseComplete,
    });
  } catch (error: any) {
    logError('Failed to submit drawing', {
      lobbyId: conn.lobbyId,
      flipbookId: msg.flipbookId,
      userId: conn.userId,
      error: error.message,
    });

    send(conn, {
      type: 'error',
      error: 'DRAWING_SUBMISSION_FAILED',
      message: error.message || 'Failed to submit drawing',
    });
  }
}

/**
 * Handle guess submission
 */
export async function handleGuessSubmission(
  ctx: WSContext,
  conn: ClientConn,
  msg: { type: 'game:submit_guess'; flipbookId: string; text: string }
): Promise<void> {
  if (!conn.lobbyId || !conn.userId) {
    send(conn, { type: 'error', error: 'NOT_AUTHENTICATED', message: 'Not authenticated' });
    return;
  }

  try {
    const guess = await submitGuess(msg.flipbookId, conn.userId, msg.text);

    // Notify the lobby that a guess was submitted
    const connections = ctx.registry.getLobbyConnections(conn.lobbyId);
    broadcast(connections, {
      type: 'game:guess_submitted',
      flipbookId: msg.flipbookId,
      userId: conn.userId,
    });

    // Check if this was an initial prompt submission
    const isInitialPrompt = (guess as any).isInitialPrompt === true;

    if (isInitialPrompt) {
      // Check if all players have submitted their initial prompts
      const prisma = (await import('../../prisma/client')).default;
      const round = await getCurrentRound(conn.lobbyId);
      const flipbooks = await prisma.flipbook.findMany({
        where: { roundId: round.id },
        select: { prompt: true },
      });

      // All flipbooks should have non-empty prompts
      const allPromptsSubmitted = flipbooks.every(
        (fb) => fb.prompt && fb.prompt.trim().length > 0
      );

      if (allPromptsSubmitted) {
        logInfo('All initial prompts submitted, advancing to DRAWING phase', {
          lobbyId: conn.lobbyId,
          roundId: round.id,
        });

        // Advance all flipbooks to DRAWING state
        await prisma.flipbook.updateMany({
          where: { roundId: round.id },
          data: { state: 'DRAWING' },
        });

        // Broadcast phase change to DRAWING
        await broadcastPhaseChange(ctx, conn.lobbyId, 'DRAWING');
      }
    } else {
      // Normal guess submission - check if all players have finished this phase
      const round = await getCurrentRound(conn.lobbyId);
      const isPhaseComplete = await checkPhaseCompletion(round.id, 'GUESSING');

      if (isPhaseComplete) {
        broadcast(connections, {
          type: 'game:phase_complete',
          phase: 'GUESSING',
        });
      }

      logInfo('Guess submitted', {
        lobbyId: conn.lobbyId,
        flipbookId: msg.flipbookId,
        userId: conn.userId,
        guessId: (guess as any).id,
        isPhaseComplete,
      });
    }
  } catch (error: any) {
    logError('Failed to submit guess', {
      lobbyId: conn.lobbyId,
      flipbookId: msg.flipbookId,
      userId: conn.userId,
      error: error.message,
    });

    send(conn, {
      type: 'error',
      error: 'GUESS_SUBMISSION_FAILED',
      message: error.message || 'Failed to submit guess',
    });
  }
}

/**
 * Broadcast game started message with initial phase
 */
export async function broadcastGameStarted(
  ctx: WSContext,
  lobbyId: string,
  roundId: string,
  roundNumber: number
): Promise<void> {
  const connections = ctx.registry.getLobbyConnections(lobbyId);

  // Notify that game has started
  broadcast(connections, {
    type: 'game:started',
    roundId,
    roundNumber,
  });

  // Get the round to check flipbook states
  const prisma = (await import('../../prisma/client')).default;
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      flipbooks: {
        select: { state: true, prompt: true },
        take: 1, // Just need one to check the state
      },
    },
  });

  // Determine initial phase based on flipbook state
  // If flipbooks have no prompts, start in GUESSING (initial prompt writing)
  // Otherwise start in DRAWING
  const hasPrompts = round?.flipbooks[0]?.prompt && round.flipbooks[0].prompt.trim().length > 0;
  const initialPhase = hasPrompts ? 'DRAWING' : 'GUESSING';

  await broadcastPhaseChange(ctx, lobbyId, initialPhase);

  logInfo('Broadcasted game started', { 
    lobbyId, 
    roundId, 
    roundNumber, 
    initialPhase,
    connectionCount: connections.length 
  });
}

/**
 * Broadcast phase change with timer
 */
export async function broadcastPhaseChange(
  ctx: WSContext,
  lobbyId: string,
  phase: 'DRAWING' | 'GUESSING' | 'VOTING'
): Promise<void> {
  const connections = ctx.registry.getLobbyConnections(lobbyId);

  // Calculate phase duration based on constants
  const { DRAWING_PHASE_DURATION_MS, GUESSING_PHASE_DURATION_MS, VOTING_PHASE_DURATION_MS } = 
    await import('../../config/constants');

  let duration: number;
  switch (phase) {
    case 'DRAWING':
      duration = DRAWING_PHASE_DURATION_MS;
      break;
    case 'GUESSING':
      duration = GUESSING_PHASE_DURATION_MS;
      break;
    case 'VOTING':
      duration = VOTING_PHASE_DURATION_MS;
      break;
  }

  const endsAt = Date.now() + duration;

  broadcast(connections, {
    type: 'game:phase_changed',
    phase,
    endsAt,
  });

  logInfo('Broadcasted phase change', { lobbyId, phase, endsAt, connectionCount: connections.length });
}
