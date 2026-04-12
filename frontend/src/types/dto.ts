/**
 * Data Transfer Objects - shared types between frontend and backend
 */

export interface UserDTO {
  id: string;
  username: string;
  profilePicture: string | null;
}

export interface LobbyPlayerDTO extends UserDTO {
  order?: number;
}

export interface FlipbookDTO {
  id: string;
  prompt: string;
  votes: number;
  state: 'DRAWING' | 'GUESSING' | 'VOTING';
  author: UserDTO;
}

export interface RoundDTO {
  id: string;
  number: number;
  flipbooks: FlipbookDTO[];
}

export interface LobbySnapshot {
  id: string;
  roomCode: string;
  state: 'WAITING' | 'STARTING' | 'IN_PROGRESS' | 'FINISHED';
  host: UserDTO;
  players: LobbyPlayerDTO[];
  currentRound?: RoundDTO;
  createdAt: Date;
}

export interface GameStateDTO {
  lobby: LobbySnapshot;
  round?: RoundDTO;
  assignment?: {
    flipbookId: string;
    phase: 'DRAWING' | 'GUESSING';
  };
}

/** Flat shape returned by GET /lobby/:roomCode/state (backend gameStateService) */
export interface LobbyRoomStateResponse {
  lobbyId: string;
  roomCode: string;
  state: LobbySnapshot['state'];
  phase: 'WAITING' | 'FINISHED' | 'DRAWING' | 'GUESSING' | 'VOTING';
  roundId: string | null;
  roundNumber?: number;
  /** Unix ms from server `Round.phaseDeadline` (countdown sync). */
  endsAt?: number | null;
  chainWave?: number;
  /** Gameplay chain length is N-1 (not counting recap sentinel wave N). */
  maxChainWave?: number;
  hasSubmitted?: boolean;
  assignedFlipbookId?: string | null;
  assignedPrompt?: string | null;
  counts?: {
    submittedDrawings: number;
    expectedDrawings: number;
    submittedGuesses: number;
    expectedGuesses: number;
    totalPlayers: number;
  };
  flipbooks?: Array<{
    id: string;
    prompt: string;
    authorId: string;
    authorUsername: string;
    state: 'DRAWING' | 'GUESSING' | 'VOTING';
    drawingCount: number;
    guessCount: number;
    votes: number;
  }>;
  host: UserDTO;
  players: LobbyPlayerDTO[];
  createdAt: string | Date;
}
