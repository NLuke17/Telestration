/**
 * Lobby snapshot service
 * Single source of truth for building lobby snapshots
 */

import { getPrisma } from '../prisma/client';
import { LobbySnapshot, UserDTO, FlipbookDTO, RoundDTO } from '../types/dto';

const prisma = getPrisma();

/**
 * Build a complete lobby snapshot by lobby ID
 */
export async function buildLobbySnapshot(lobbyId: string): Promise<LobbySnapshot> {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: {
      host: { select: { id: true, username: true, profilePicture: true } },
      players: { select: { id: true, username: true, profilePicture: true } },
      rounds: {
        orderBy: { number: 'desc' },
        take: 1,
        include: {
          flipbooks: {
            include: {
              author: { select: { id: true, username: true, profilePicture: true } },
            },
          },
        },
      },
    },
  });

  if (!lobby) {
    throw new Error('LOBBY_NOT_FOUND');
  }

  return formatLobbySnapshot(lobby);
}

/**
 * Build a complete lobby snapshot by room code
 */
export async function buildLobbySnapshotByRoomCode(roomCode: string): Promise<LobbySnapshot> {
  const lobby = await prisma.lobby.findUnique({
    where: { roomCode: roomCode.toUpperCase() },
    include: {
      host: { select: { id: true, username: true, profilePicture: true } },
      players: { select: { id: true, username: true, profilePicture: true } },
      rounds: {
        orderBy: { number: 'desc' },
        take: 1,
        include: {
          flipbooks: {
            include: {
              author: { select: { id: true, username: true, profilePicture: true } },
            },
          },
        },
      },
    },
  });

  if (!lobby) {
    throw new Error('LOBBY_NOT_FOUND');
  }

  return formatLobbySnapshot(lobby);
}

/**
 * Format raw Prisma data into LobbySnapshot DTO
 */
function formatLobbySnapshot(lobby: any): LobbySnapshot {
  const currentRound = lobby.rounds && lobby.rounds.length > 0 ? lobby.rounds[0] : null;

  return {
    id: lobby.id,
    roomCode: lobby.roomCode,
    state: lobby.state,
    host: lobby.host,
    players: lobby.players,
    currentRound: currentRound
      ? {
          id: currentRound.id,
          number: currentRound.number,
          flipbooks: currentRound.flipbooks.map((fb: any) => ({
            id: fb.id,
            prompt: fb.prompt,
            votes: fb.votes,
            state: fb.state,
            author: fb.author,
          })),
        }
      : undefined,
    createdAt: lobby.createdAt,
  };
}
