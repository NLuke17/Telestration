import express from 'express';
import { validate } from '../middleware/validate';
import { authenticateJWT, AuthRequest } from '../middleware/authMiddleware';
import {
  submitDrawingSchema,
  submitGuessSchema,
  getCurrentRoundSchema,
  getAssignedFlipbookSchema,
  getFlipbookPresentationSchema,
  saveFlipbookToLibrarySchema,
  getSavedFlipbookPresentationSchema,
  deleteSavedFlipbookSchema,
} from '../validation/game.validation';
import {
  submitDrawing,
  submitGuess,
  getCurrentRound,
  getAssignedFlipbook,
  getLobbyIdForFlipbook,
} from '../services/gameService';
import { getGameFlipbookPresentation, getSavedFlipbookPresentation } from '../services/flipbookPresentationService';
import {
  deleteSavedFlipbookForOwner,
  listSavedFlipbooksForUser,
  saveGameFlipbookToLibrary,
} from '../services/savedFlipbookService';
import { MAX_SAVED_FLIPBOOKS_PER_USER } from '../config/constants';
import { WSGatewayHandle } from '../ws/index';

const router = express.Router();

function getWSHandle(req: express.Request): WSGatewayHandle | null {
  return req.app.get('wsHandle') || null;
}

// Get current round for a lobby
router.get('/lobbies/:lobbyId/current-round', validate(getCurrentRoundSchema), async (req, res) => {
  try {
    const lobbyId = typeof req.params.lobbyId === 'string' ? req.params.lobbyId : req.params.lobbyId[0];
    const round = await getCurrentRound(lobbyId);
    return res.json(round);
  } catch (e: any) {
    if (e.message === 'ROUND_NOT_FOUND') return res.status(404).json({ error: 'No active round found' });
    return res.status(500).json({ error: 'Failed to fetch current round' });
  }
});

// Get assigned flipbook for a player
router.get('/rounds/:roundId/assignment', validate(getAssignedFlipbookSchema), async (req, res) => {
  try {
    const roundId = typeof req.params.roundId === 'string' ? req.params.roundId : req.params.roundId[0];
    const { userId, phase } = req.query;
    
    const flipbook = await getAssignedFlipbook(
      roundId, 
      userId as string, 
      phase as 'DRAWING' | 'GUESSING'
    );
    
    if (!flipbook) {
      return res.json({ 
        assigned: false, 
        message: 'No flipbook available - you have completed all work for this phase' 
      });
    }
    
    return res.json({ 
      assigned: true, 
      flipbook 
    });
  } catch (e: any) {
    if (e.message === 'ROUND_NOT_FOUND') return res.status(404).json({ error: 'Round not found' });
    return res.status(500).json({ error: 'Failed to get assignment' });
  }
});

// Submit a drawing (deprecated - use WebSocket instead)
router.post('/flipbooks/:flipbookId/drawings', validate(submitDrawingSchema), async (req, res) => {
  try {
    const flipbookId = typeof req.params.flipbookId === 'string' ? req.params.flipbookId : req.params.flipbookId[0];
    const { userId, drawingData } = req.body;

    const drawing = await submitDrawing(flipbookId, userId, drawingData);
    
    return res.status(201).json(drawing);
  } catch (e: any) {
    if (e.message === 'FLIPBOOK_NOT_FOUND') return res.status(404).json({ error: 'Flipbook not found' });
    if (e.message === 'FLIPBOOK_NOT_ACCEPTING_DRAWINGS') return res.status(400).json({ error: 'Flipbook not accepting drawings' });
    if (e.message === 'CANNOT_DRAW_OWN_FLIPBOOK') return res.status(403).json({ error: 'Cannot draw on your own flipbook' });
    return res.status(500).json({ error: 'Failed to submit drawing' });
  }
});

// Full flipbook timeline for replay (drawing payloads resolved from DB or blob storage)
router.get('/flipbooks/:flipbookId/presentation', validate(getFlipbookPresentationSchema), async (req, res) => {
  try {
    const flipbookId = typeof req.params.flipbookId === 'string' ? req.params.flipbookId : req.params.flipbookId[0];
    const userId = req.query.userId as string;
    const data = await getGameFlipbookPresentation(flipbookId, userId);
    return res.json(data);
  } catch (e: any) {
    if (e.message === 'FLIPBOOK_NOT_FOUND') return res.status(404).json({ error: 'Flipbook not found' });
    if (e.message === 'NOT_IN_LOBBY') return res.status(403).json({ error: 'Not allowed' });
    return res.status(500).json({ error: 'Failed to load presentation' });
  }
});

// Persist flipbook into the signed-in user's library (recap / finished lobby; max count enforced in service)
router.post(
  '/flipbooks/:flipbookId/save-to-library',
  authenticateJWT,
  validate(saveFlipbookToLibrarySchema),
  async (req: AuthRequest, res) => {
    try {
      const flipbookId = typeof req.params.flipbookId === 'string' ? req.params.flipbookId : req.params.flipbookId[0];
      const ownerId = req.user?.userId as string;
      const title = (req.body as { title?: string }).title;
      const saved = await saveGameFlipbookToLibrary(ownerId, flipbookId, title);
      return res.status(201).json({ savedFlipbookId: saved.id });
    } catch (e: any) {
      if (e.message === 'FLIPBOOK_NOT_FOUND') return res.status(404).json({ error: 'Flipbook not found' });
      if (e.message === 'LOBBY_NOT_FINISHED') return res.status(409).json({ error: 'Game not finished yet' });
      if (e.message === 'NOT_IN_LOBBY') return res.status(403).json({ error: 'Not allowed' });
      if (e.message === 'FLIPBOOK_ALREADY_SAVED') return res.status(409).json({ error: 'Already saved to your library' });
      if (e.message === 'LIBRARY_FULL') {
        return res.status(403).json({
          error: 'LIBRARY_FULL',
          message: `You can save at most ${MAX_SAVED_FLIPBOOKS_PER_USER} flipbooks to your library.`,
        });
      }
      return res.status(500).json({ error: 'Failed to save flipbook' });
    }
  }
);

router.get('/saved-flipbooks', authenticateJWT, async (req: AuthRequest, res) => {
  try {
    const ownerId = req.user?.userId as string;
    const list = await listSavedFlipbooksForUser(ownerId);
    return res.json({
      savedFlipbooks: list,
      maxSaved: MAX_SAVED_FLIPBOOKS_PER_USER,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to list saved flipbooks' });
  }
});

router.get(
  '/saved-flipbooks/:savedId/presentation',
  authenticateJWT,
  validate(getSavedFlipbookPresentationSchema),
  async (req: AuthRequest, res) => {
    try {
      const savedId = typeof req.params.savedId === 'string' ? req.params.savedId : req.params.savedId[0];
      const ownerId = req.user?.userId as string;
      const data = await getSavedFlipbookPresentation(savedId, ownerId);
      return res.json(data);
    } catch (e: any) {
      if (e.message === 'SAVED_FLIPBOOK_NOT_FOUND') return res.status(404).json({ error: 'Not found' });
      return res.status(500).json({ error: 'Failed to load saved flipbook' });
    }
  }
);

router.delete(
  '/saved-flipbooks/:savedId',
  authenticateJWT,
  validate(deleteSavedFlipbookSchema),
  async (req: AuthRequest, res) => {
    try {
      const savedId = typeof req.params.savedId === 'string' ? req.params.savedId : req.params.savedId[0];
      const ownerId = req.user?.userId as string;
      await deleteSavedFlipbookForOwner(ownerId, savedId);
      return res.json({ ok: true });
    } catch (e: any) {
      if (e.message === 'SAVED_FLIPBOOK_NOT_FOUND') return res.status(404).json({ error: 'Not found' });
      return res.status(500).json({ error: 'Failed to delete saved flipbook' });
    }
  }
);

// Submit a guess (deprecated - use WebSocket instead)
router.post('/flipbooks/:flipbookId/guesses', validate(submitGuessSchema), async (req, res) => {
  try {
    const flipbookId = typeof req.params.flipbookId === 'string' ? req.params.flipbookId : req.params.flipbookId[0];
    const { userId, text } = req.body;

    const guess = await submitGuess(flipbookId, userId, text);

    const lobbyId = await getLobbyIdForFlipbook(flipbookId);
    const wsHandle = getWSHandle(req);
    if (lobbyId && wsHandle) {
      await wsHandle.notifyGuessSubmittedEffects(lobbyId, flipbookId, userId, guess);
    }

    return res.status(201).json(guess);
  } catch (e: any) {
    if (e.message === 'FLIPBOOK_NOT_FOUND') return res.status(404).json({ error: 'Flipbook not found' });
    if (e.message === 'FLIPBOOK_NOT_ACCEPTING_GUESSES') return res.status(400).json({ error: 'Flipbook not accepting guesses' });
    if (e.message === 'CANNOT_GUESS_OWN_FLIPBOOK') return res.status(403).json({ error: 'Cannot guess on your own flipbook' });
    return res.status(500).json({ error: 'Failed to submit guess' });
  }
});

export default router;
