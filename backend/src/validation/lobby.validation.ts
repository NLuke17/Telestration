import { z } from 'zod';

/**
 * Lobby validation schemas
 */

// UUID validation helper
const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

/** Stored User.id (UUID or legacy client-generated ids) */
const participantIdSchema = z.string().min(1).max(128);

// Room code validation helper (6 uppercase alphanumeric)
const roomCodeSchema = z
  .string()
  .length(6, 'Room code must be exactly 6 characters')
  .regex(/^[A-Z0-9]+$/, 'Room code must contain only uppercase letters and numbers')
  .transform((val) => val.toUpperCase());

// POST /lobby
export const createLobbySchema = z.object({
  body: z.object({
    hostId: participantIdSchema,
  }),
});

// POST /lobby/:roomCode/join
export const joinLobbySchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  body: z.object({
    userId: participantIdSchema,
  }),
});

// GET /lobby/:roomCode
export const getLobbySchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
});

export const leaveLobbySchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  body: z.object({
    userId: participantIdSchema,
  }),
});

export const deleteLobbySchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  query: z.object({
    userId: participantIdSchema,
  }),
});

export const startLobbySchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  body: z.object({
    prompts: z
      .array(z.string().min(1, 'Prompt cannot be empty').max(100, 'Prompt too long'))
      .optional()
      .refine(
        (prompts) => !prompts || prompts.length >= 2,
        { message: 'Must provide at least 2 prompts if specifying custom prompts' }
      ),
  }).optional(),
});

export const endLobbySchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
});

export type CreateLobbyInput = z.infer<typeof createLobbySchema>;
export type JoinLobbyInput = z.infer<typeof joinLobbySchema>;
export type GetLobbyInput = z.infer<typeof getLobbySchema>;
export type LeaveLobbyInput = z.infer<typeof leaveLobbySchema>;
export type DeleteLobbyInput = z.infer<typeof deleteLobbySchema>;
export type StartLobbyInput = z.infer<typeof startLobbySchema>;
export type EndLobbyInput = z.infer<typeof endLobbySchema>;
// GET /lobby/:roomCode/state
export const getGameStateSchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  query: z.object({
    userId: participantIdSchema,
  }),
});

export type GetGameStateInput = z.infer<typeof getGameStateSchema>;
