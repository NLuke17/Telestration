import { z } from 'zod';

/**
 * Lobby validation schemas
 */

// UUID validation helper
const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

// Room code validation helper (6 uppercase alphanumeric)
const roomCodeSchema = z
  .string()
  .length(6, 'Room code must be exactly 6 characters')
  .regex(/^[A-Z0-9]+$/, 'Room code must contain only uppercase letters and numbers')
  .transform((val) => val.toUpperCase());

// POST /lobby
export const createLobbySchema = z.object({
  body: z.object({
    hostId: uuidSchema,
  }),
});

// POST /lobby/:roomCode/join
export const joinLobbySchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
  body: z.object({
    userId: uuidSchema,
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
    userId: uuidSchema,
  }),
});

export const deleteLobbySchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
});

export const startLobbySchema = z.object({
  params: z.object({
    roomCode: roomCodeSchema,
  }),
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