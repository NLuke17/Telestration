import { LobbySnapshot } from './dto';

/**
 * Generic envelope for WebSocket messages
 */
export interface WSEnvelope<T = unknown> {
  type: string;
  payload?: T;
  error?: string;
}

/**
 * Client-to-Server Messages
 */
export type WSClientMessage =
  | { type: 'ping' }
  | { type: 'lobby:connect'; roomCode: string; userId?: string; token?: string }
  | { type: 'lobby:ready'; ready: boolean }
  | { type: 'lobby:disconnect' }
  | { type: 'game:submit_drawing'; flipbookId: string; drawingData: string }
  | { type: 'game:submit_guess'; flipbookId: string; text: string };

/**
 * Server-to-Client Messages
 */
export type WSServerMessage =
  | { type: 'pong' }
  | { type: 'welcome'; message: string }
  | { type: 'error'; error: string; message?: string }
  | { type: 'lobby:connected'; roomCode: string; lobbyId: string }
  | { type: 'lobby:snapshot'; snapshot: LobbySnapshot }
  | { type: 'lobby:presence'; connectedUserIds: string[] }
  | { type: 'lobby:player_joined'; userId: string; username: string }
  | { type: 'lobby:player_left'; userId: string }
  | { type: 'lobby:state_changed'; state: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED' }
  | { type: 'lobby:deleted'; lobbyId: string }
  | { type: 'game:started'; roundId: string; roundNumber: number }
  | { type: 'game:phase_changed'; phase: 'DRAWING' | 'GUESSING' | 'VOTING'; endsAt: number }
  | { type: 'game:phase_complete'; phase: 'DRAWING' | 'GUESSING' }
  | { type: 'game:drawing_submitted'; flipbookId: string; userId: string }
  | { type: 'game:guess_submitted'; flipbookId: string; userId: string }
  | { type: 'game:round_complete'; roundId: string };

/**
 * Type guards
 */
export function isWSClientMessage(msg: unknown): msg is WSClientMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    typeof msg.type === 'string'
  );
}
