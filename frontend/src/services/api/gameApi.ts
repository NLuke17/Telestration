/**
 * Game API service - handles all game/round-related HTTP requests
 */

import { httpClient } from './httpClient';
import { authenticatedClient } from './authenticatedClient';
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
    /** Resolved vector JSON (`exportPaths`) for the latest drawing on this flipbook (guess phase). */
    latestDrawingData?: string | null;
    drawFromText?: string;
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

export type FlipbookPresentationResponse = {
  flipbook: {
    id: string;
    prompt: string;
    author: { id: string; username: string; profilePicture?: string | null };
  };
  timeline: Array<
    | { kind: 'prompt'; text: string }
    | {
        kind: 'drawing';
        id: string;
        order: number;
        authorId: string;
        authorUsername: string;
        drawingData: string;
      }
    | {
        kind: 'guess';
        id: string;
        order: number;
        authorId: string;
        authorUsername: string;
        text: string;
      }
  >;
};

export async function getFlipbookPresentation(
  flipbookId: string,
  userId: string
): Promise<FlipbookPresentationResponse> {
  return httpClient.get<FlipbookPresentationResponse>(
    `/game/flipbooks/${flipbookId}/presentation?userId=${encodeURIComponent(userId)}`
  );
}

export type SavedFlipbookPresentationResponse = {
  savedFlipbook: {
    id: string;
    title: string | null;
    prompt: string;
    sourceFlipbookId: string | null;
    createdAt: string;
  };
  timeline: FlipbookPresentationResponse['timeline'];
};

/**
 * Full timeline for a library flipbook (JWT — owner only).
 */
export async function getSavedFlipbookPresentation(
  savedId: string
): Promise<SavedFlipbookPresentationResponse> {
  return authenticatedClient.get<SavedFlipbookPresentationResponse>(
    `/game/saved-flipbooks/${savedId}/presentation`
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

export type SavedFlipbookSummary = {
  id: string;
  title: string | null;
  prompt: string;
  sourceFlipbookId: string | null;
  sourceRoundId: string | null;
  createdAt: string;
};

export type ListSavedFlipbooksResponse = {
  savedFlipbooks: SavedFlipbookSummary[];
  maxSaved: number;
};

/**
 * List flipbooks saved to the signed-in user's library (requires JWT).
 */
export async function listSavedFlipbooks(): Promise<ListSavedFlipbooksResponse> {
  return authenticatedClient.get<ListSavedFlipbooksResponse>('/game/saved-flipbooks');
}

/**
 * Copy a game flipbook into the signed-in user's library (requires JWT). Max count enforced server-side.
 */
export async function saveFlipbookToLibrary(
  flipbookId: string,
  body?: { title?: string }
): Promise<{ savedFlipbookId: string }> {
  return authenticatedClient.post<{ savedFlipbookId: string }>(
    `/game/flipbooks/${flipbookId}/save-to-library`,
    body ?? {}
  );
}

/**
 * Remove a flipbook from the signed-in user's library (requires JWT).
 */
export async function deleteSavedFlipbook(savedId: string): Promise<void> {
  await authenticatedClient.delete<{ ok: boolean }>(`/game/saved-flipbooks/${savedId}`);
}
