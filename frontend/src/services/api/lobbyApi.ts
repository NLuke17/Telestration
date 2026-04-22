/**
 * Lobby API service - handles all lobby-related HTTP requests
 */

import { httpClient } from './httpClient';
import type { LobbyRoomStateResponse, LobbySnapshot } from '../../types/dto';

export interface CreateLobbyRequest {
  hostId: string;
}

export interface CreateLobbyResponse extends LobbySnapshot {}

export interface JoinLobbyRequest {
  userId: string;
}

export interface JoinLobbyResponse extends LobbySnapshot {}

export interface StartLobbyRequest {
  prompts?: string[];
}

export interface StartLobbyResponse {
  message: string;
  roundId: string;
  roundNumber: number;
  flipbooks: Array<{
    id: string;
    prompt: string;
    authorId: string;
    authorUsername: string;
  }>;
}

export interface LeaveLobbyRequest {
  userId: string;
}

/**
 * Create a new lobby
 */
export async function createLobby(hostId: string): Promise<CreateLobbyResponse> {
  return httpClient.post<CreateLobbyResponse>('/lobby', { hostId });
}

/**
 * Join an existing lobby
 */
export async function joinLobby(
  roomCode: string,
  userId: string
): Promise<JoinLobbyResponse> {
  return httpClient.post<JoinLobbyResponse>(`/lobby/${roomCode}/join`, { userId });
}

/**
 * Get lobby snapshot by room code
 */
export async function getLobby(roomCode: string): Promise<LobbySnapshot> {
  return httpClient.get<LobbySnapshot>(`/lobby/${roomCode}`);
}

/**
 * Get complete game state for a user
 */
export async function getGameState(
  roomCode: string,
  userId: string
): Promise<LobbyRoomStateResponse> {
  return httpClient.get<LobbyRoomStateResponse>(`/lobby/${roomCode}/state?userId=${userId}`);
}

/**
 * Start the game in a lobby
 */
export async function startLobby(
  roomCode: string,
  prompts?: string[]
): Promise<StartLobbyResponse> {
  return httpClient.post<StartLobbyResponse>(
    `/lobby/${roomCode}/start`,
    prompts ? { prompts } : undefined
  );
}

/**
 * End a lobby
 */
export async function endLobby(roomCode: string): Promise<{ message: string }> {
  return httpClient.post<{ message: string }>(`/lobby/${roomCode}/end`);
}

/**
 * Leave a lobby
 */
export interface LeaveLobbyResponse {
  message: string;
  lobbyDeleted?: boolean;
}

export async function leaveLobby(roomCode: string, userId: string): Promise<LeaveLobbyResponse> {
  return httpClient.post<LeaveLobbyResponse>(`/lobby/${roomCode}/leave`, { userId });
}

/**
 * Delete a lobby (host only — backend checks userId matches host)
 */
export async function deleteLobby(roomCode: string, userId: string): Promise<{ message: string }> {
  const q = new URLSearchParams({ userId });
  return httpClient.delete<{ message: string }>(`/lobby/${roomCode}?${q.toString()}`);
}
