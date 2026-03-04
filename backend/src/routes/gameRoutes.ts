import express from 'express';
import { validate } from '../middleware/validate';
import { 
  submitDrawingSchema, 
  submitGuessSchema, 
  getCurrentRoundSchema,
  getAssignedFlipbookSchema
} from '../validation/game.validation';
import { submitDrawing, submitGuess, getCurrentRound, getAssignedFlipbook } from '../services/gameService';
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

// Submit a guess (deprecated - use WebSocket instead)
router.post('/flipbooks/:flipbookId/guesses', validate(submitGuessSchema), async (req, res) => {
  try {
    const flipbookId = typeof req.params.flipbookId === 'string' ? req.params.flipbookId : req.params.flipbookId[0];
    const { userId, text } = req.body;

    const guess = await submitGuess(flipbookId, userId, text);
    
    return res.status(201).json(guess);
  } catch (e: any) {
    if (e.message === 'FLIPBOOK_NOT_FOUND') return res.status(404).json({ error: 'Flipbook not found' });
    if (e.message === 'FLIPBOOK_NOT_ACCEPTING_GUESSES') return res.status(400).json({ error: 'Flipbook not accepting guesses' });
    if (e.message === 'CANNOT_GUESS_OWN_FLIPBOOK') return res.status(403).json({ error: 'Cannot guess on your own flipbook' });
    return res.status(500).json({ error: 'Failed to submit guess' });
  }
});

export default router;
