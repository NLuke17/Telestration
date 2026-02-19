/**
 * Typing for data transfer objects
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
