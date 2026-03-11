/**
 * Game API service - handles all game/round-related HTTP requests
 */

import { httpClient } from './httpClient';
import type { RoundDTO, FlipbookDTO } from '../../types/dto';

export interface CurrentRoundResponse extends RoundDTO {}

export interface AssignmentResponse {
  assigned: boolean;
  message?: string;
  flipbook?: FlipbookDTO & {
    previousContent?: {
      type: 'PROMPT' | 'DRAWING' | 'GUESS';
      content: string;
    };
  };
}

export interface SubmitDrawingRequest {
  userId: string;
  drawingData: string;
}

export interface SubmitGuessRequest {
  userId: string;
  text: string;
}

/**
 * Get current round for a lobby
 */
export async function getCurrentRound(lobbyId: string): Promise<CurrentRoundResponse> {
  return httpClient.get<CurrentRoundResponse>(`/game/lobbies/${lobbyId}/current-round`);
}

/**
 * Get assigned flipbook for a player in a specific phase
 */
export async function getAssignedFlipbook(
  roundId: string,
  userId: string,
  phase: 'DRAWING' | 'GUESSING'
): Promise<AssignmentResponse> {
  return httpClient.get<AssignmentResponse>(
    `/game/rounds/${roundId}/assignment?userId=${userId}&phase=${phase}`
  );
}

/**
 * Submit a drawing (deprecated - prefer WebSocket)
 * Kept for backward compatibility
 */
export async function submitDrawing(
  flipbookId: string,
  userId: string,
  drawingData: string
): Promise<{ id: string; flipbookId: string; userId: string; drawingData: string }> {
  return httpClient.post(`/game/flipbooks/${flipbookId}/drawings`, {
    userId,
    drawingData,
  });
}

/**
 * Submit a guess (deprecated - prefer WebSocket)
 * Kept for backward compatibility
 */
export async function submitGuess(
  flipbookId: string,
  userId: string,
  text: string
): Promise<{ id: string; flipbookId: string; userId: string; text: string }> {
  return httpClient.post(`/game/flipbooks/${flipbookId}/guesses`, {
    userId,
    text,
  });
}
