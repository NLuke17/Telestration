import express from 'express';
import { validate } from '../middleware/validate';
import { 
  submitDrawingSchema, 
  submitGuessSchema, 
  getCurrentRoundSchema 
} from '../validation/game.validation';
import { submitDrawing, submitGuess, getCurrentRound } from '../services/gameService';
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
    return res.status(500).json({ error: 'Failed to submit guess' });
  }
});

export default router;
