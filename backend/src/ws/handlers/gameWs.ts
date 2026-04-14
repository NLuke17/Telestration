import { WSContext } from '../context/wsContext';
import { ClientConn } from '../core/clientConn';
import { send, broadcast } from '../core/wsUtils';
import {
  submitDrawing,
  submitGuess,
  revokePhaseSubmission,
  getCurrentRound,
  checkPhaseCompletion,
  advanceRoundIfChainPhaseComplete,
  tryAdvanceInitialPromptsIfReady,
} from '../../services/gameService';
import { logInfo, logError } from '../../utils/logger';
import { initRecapStateFromLobby, broadcastRecapSync } from '../state/recapTracker';

/**
 * Broadcast guess_submitted + advance phase when applicable (shared by WS and HTTP submit).
 */
export async function runGuessSubmissionSideEffects(
  ctx: WSContext,
  lobbyId: string,
  flipbookId: string,
  userId: string,
  guess: unknown
): Promise<void> {
  const connections = ctx.registry.getLobbyConnections(lobbyId);
  broadcast(connections, {
    type: 'game:guess_submitted',
    flipbookId,
    userId,
  });

  const isInitialPrompt = (guess as { isInitialPrompt?: boolean }).isInitialPrompt === true;

  if (isInitialPrompt) {
    const { advanced, endsAt } = await tryAdvanceInitialPromptsIfReady(lobbyId);
    if (advanced && endsAt != null) {
      logInfo('All initial prompts submitted, advancing to DRAWING phase', {
        lobbyId,
      });
      await broadcastPhaseChange(ctx, lobbyId, 'DRAWING', { endsAt });
    }
  } else {
    const round = await getCurrentRound(lobbyId);
    const isPhaseComplete = await checkPhaseCompletion(round.id, 'GUESSING');

    if (isPhaseComplete) {
      const result = await advanceRoundIfChainPhaseComplete(lobbyId, 'GUESSING');
      if (result.advanced) {
        await broadcastPhaseChange(ctx, result.lobbyId, result.newPhase, { endsAt: result.endsAt });
      }
    }

    logInfo('Guess submitted', {
      lobbyId,
      flipbookId,
      userId,
      guessId: (guess as { id?: string }).id,
      isPhaseComplete,
    });
  }
}


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

  // Snapshot: `leaveLobby` / lobby delete can clear `conn.lobbyId` while we await DB work below.
  const lobbyId = conn.lobbyId;
  const userId = conn.userId;

  try {
    const drawing = await submitDrawing(msg.flipbookId, userId, msg.drawingData);

    // Notify the lobby that a drawing was submitted
    const connections = ctx.registry.getLobbyConnections(lobbyId);
    broadcast(connections, {
      type: 'game:drawing_submitted',
      flipbookId: msg.flipbookId,
      userId,
    });

    const round = await getCurrentRound(lobbyId);
    const isPhaseComplete = await checkPhaseCompletion(round.id, 'DRAWING');

    if (isPhaseComplete) {
      const result = await advanceRoundIfChainPhaseComplete(lobbyId, 'DRAWING');
      if (result.advanced) {
        await broadcastPhaseChange(ctx, result.lobbyId, result.newPhase, { endsAt: result.endsAt });
      }
    }

    logInfo('Drawing submitted', {
      lobbyId,
      flipbookId: msg.flipbookId,
      userId,
      drawingId: drawing.id,
      isPhaseComplete,
    });
  } catch (error: any) {
    logError('Failed to submit drawing', {
      lobbyId,
      flipbookId: msg.flipbookId,
      userId,
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

  // Snapshot: `leaveLobby` / lobby delete can clear `conn.lobbyId` while we await `submitGuess`.
  const lobbyId = conn.lobbyId;
  const userId = conn.userId;

  try {
    const guess = await submitGuess(msg.flipbookId, userId, msg.text);
    await runGuessSubmissionSideEffects(ctx, lobbyId, msg.flipbookId, userId, guess);
  } catch (error: any) {
    logError('Failed to submit guess', {
      lobbyId,
      flipbookId: msg.flipbookId,
      userId,
      error: error.message,
    });

    const errCode =
      error.message === 'INITIAL_PROMPT_ALREADY_SUBMITTED'
        ? 'INITIAL_PROMPT_ALREADY_SUBMITTED'
        : 'GUESS_SUBMISSION_FAILED';

    send(conn, {
      type: 'error',
      error: errCode,
      message: error.message || 'Failed to submit guess',
    });
  }
}

/**
 * Let a player pull back their submission so they can edit (and so phase completion excludes them until they resubmit).
 */
export async function handleRevokeSubmission(
  ctx: WSContext,
  conn: ClientConn,
  msg: { type: 'game:revoke_submission'; flipbookId: string }
): Promise<void> {
  if (!conn.lobbyId || !conn.userId) {
    send(conn, { type: 'error', error: 'NOT_AUTHENTICATED', message: 'Not authenticated' });
    return;
  }

  const lobbyId = conn.lobbyId;
  const userId = conn.userId;

  try {
    await revokePhaseSubmission(msg.flipbookId, userId);
    const connections = ctx.registry.getLobbyConnections(lobbyId);
    broadcast(connections, {
      type: 'game:submission_revoked',
      flipbookId: msg.flipbookId,
      userId,
    });
  } catch (error: any) {
    logError('Failed to revoke submission', {
      lobbyId,
      flipbookId: msg.flipbookId,
      userId,
      error: error.message,
    });
    send(conn, {
      type: 'error',
      error: 'REVOKE_SUBMISSION_FAILED',
      message: error.message || 'Failed to revoke submission',
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
 * Broadcast phase change with timer. Persists `phaseDeadline` on the current round when present.
 */
export async function broadcastPhaseChange(
  ctx: WSContext,
  lobbyId: string,
  phase: 'DRAWING' | 'GUESSING' | 'VOTING',
  opts?: { endsAt?: number }
): Promise<void> {
  const connections = ctx.registry.getLobbyConnections(lobbyId);

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

  const endsAt = opts?.endsAt ?? Date.now() + duration;

  const prisma = (await import('../../prisma/client')).default;
  const round = await prisma.round.findFirst({
    where: { lobbyId },
    orderBy: { number: 'desc' },
    select: { id: true },
  });
  if (round) {
    await prisma.round.update({
      where: { id: round.id },
      data: { phaseDeadline: new Date(endsAt) },
    });
  }

  if (phase === 'VOTING') {
    await initRecapStateFromLobby(lobbyId);
  }

  broadcast(connections, {
    type: 'game:phase_changed',
    phase,
    endsAt,
  });

  if (phase === 'VOTING') {
    broadcastRecapSync(lobbyId);
  }

  logInfo('Broadcasted phase change', { lobbyId, phase, endsAt, connectionCount: connections.length });
}
