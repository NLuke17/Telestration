import { z } from 'zod';

/**
 * Game validation schemas
 */

// UUID validation helper
const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

// GET /game/lobbies/:lobbyId/current-round
export const getCurrentRoundSchema = z.object({
  params: z.object({
    lobbyId: uuidSchema,
  }),
});

// POST /game/flipbooks/:flipbookId/drawings
export const submitDrawingSchema = z.object({
  params: z.object({
    flipbookId: uuidSchema,
  }),
  body: z.object({
    userId: uuidSchema,
    drawingData: z.string().min(1, 'Drawing data is required'),
  }),
});

// POST /game/flipbooks/:flipbookId/guesses
export const submitGuessSchema = z.object({
  params: z.object({
    flipbookId: uuidSchema,
  }),
  body: z.object({
    userId: uuidSchema,
    text: z.string().min(1, 'Guess text is required').max(200, 'Guess text too long'),
  }),
});

export type GetCurrentRoundInput = z.infer<typeof getCurrentRoundSchema>;
export type SubmitDrawingInput = z.infer<typeof submitDrawingSchema>;
export type SubmitGuessInput = z.infer<typeof submitGuessSchema>;
