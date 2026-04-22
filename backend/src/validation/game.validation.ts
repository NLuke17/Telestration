import { z } from 'zod';

/**
 * Game validation schemas
 */

// UUID validation helper
const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

/** Stored User.id (UUID or legacy client-generated ids); keep in sync with lobby.validation participantIdSchema */
const participantIdSchema = z.string().min(1).max(128);

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

// GET /game/rounds/:roundId/assignment
export const getAssignedFlipbookSchema = z.object({
  params: z.object({
    roundId: uuidSchema,
  }),
  query: z.object({
    userId: participantIdSchema,
    phase: z.enum(['DRAWING', 'GUESSING'], { message: 'Phase must be DRAWING or GUESSING' }),
  }),
});

// GET /game/flipbooks/:flipbookId/presentation
export const getFlipbookPresentationSchema = z.object({
  params: z.object({
    flipbookId: uuidSchema,
  }),
  query: z.object({
    userId: participantIdSchema,
  }),
});

// POST /game/flipbooks/:flipbookId/save-to-library
export const saveFlipbookToLibrarySchema = z.object({
  params: z.object({
    flipbookId: uuidSchema,
  }),
  body: z.object({
    title: z.string().trim().max(120).optional(),
  }),
});

// GET /game/saved-flipbooks/:savedId/presentation
export const getSavedFlipbookPresentationSchema = z.object({
  params: z.object({
    savedId: uuidSchema,
  }),
});

// DELETE /game/saved-flipbooks/:savedId
export const deleteSavedFlipbookSchema = z.object({
  params: z.object({
    savedId: uuidSchema,
  }),
});

export type GetCurrentRoundInput = z.infer<typeof getCurrentRoundSchema>;
export type SubmitDrawingInput = z.infer<typeof submitDrawingSchema>;
export type SubmitGuessInput = z.infer<typeof submitGuessSchema>;
export type GetAssignedFlipbookInput = z.infer<typeof getAssignedFlipbookSchema>;
