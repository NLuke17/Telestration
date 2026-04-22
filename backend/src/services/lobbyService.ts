import crypto, { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../prisma/client';
import { generateRoomCode } from '../utils/roomCode';
import { startGame as startGameService } from './gameService';

const lobbyInclude = {
    host: { select: { id: true, username: true, profilePicture: true } },
    players: { select: { id: true, username: true, profilePicture: true } },
};

/** Guests use random UUIDs from the client; ensure a User row exists before FK connects. */
async function ensureLobbyParticipantUser(userId: string): Promise<void> {
    const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
    await prisma.user.upsert({
        where: { id: userId },
        create: {
            id: userId,
            username: `guest_${userId}`,
            password,
        },
        update: {},
    });
}

export async function createLobby(hostId: string) {
    await ensureLobbyParticipantUser(hostId);

    let roomCode = generateRoomCode();
    while (await prisma.lobby.findUnique({ where: { roomCode } })) {
        roomCode = generateRoomCode();
    }

    return prisma.lobby.create({
        data: {
            roomCode,
            hostId,
            players: { connect: { id: hostId } },
        },
        include: lobbyInclude,
    });
}

export async function joinLobby(roomCodeRaw: string, userId: string) {
    await ensureLobbyParticipantUser(userId);

    const roomCode = roomCodeRaw.toUpperCase();

    const lobby = await prisma.lobby.findUnique({
        where: { roomCode },
        include: { players: true },
    });

    if (!lobby) throw new Error("LOBBY_NOT_FOUND");
    if (lobby.state !== "WAITING" && lobby.state !== "FINISHED") throw new Error("LOBBY_NOT_ACCEPTING");
    if (lobby.players.some(p => p.id === userId)) throw new Error("ALREADY_IN_LOBBY");

    return prisma.lobby.update({
        where: { roomCode },
        data: { players: { connect: { id: userId } } },
        include: lobbyInclude,
    });
}


export async function getLobbySnapshot(roomCodeRaw: string) {
    const roomCode = roomCodeRaw.toUpperCase();

    const lobby = await prisma.lobby.findUnique({
        where: { roomCode },
        include: {
            ...lobbyInclude,
            rounds: {
                orderBy: { number: "desc" },
                take: 1,
                include: {
                    flipbooks: {
                        include: {
                            author: { select: { id: true, username: true } },
                        },
                    },
                },
            },
        },
    });

    if (!lobby) throw new Error("LOBBY_NOT_FOUND");
    return lobby;
}

export type LeaveLobbyResult =
    | { kind: 'deleted'; lobbyId: string }
    | { kind: 'updated'; lobbyId: string };

/**
 * Remove a player from the lobby. Host is reassigned to a random remaining player.
 * If the leaving player was the last one, the lobby is deleted.
 * Leaving is not allowed while a game is in progress (same constraint as joining).
 */
export async function leaveLobby(roomCodeRaw: string, userId: string): Promise<LeaveLobbyResult> {
    const roomCode = roomCodeRaw.toUpperCase();

    return prisma.$transaction(async (tx) => {
        const lobby = await tx.lobby.findUnique({
            where: { roomCode },
            include: { players: true },
        });

        if (!lobby) {
            throw new Error('LOBBY_NOT_FOUND');
        }

        const inLobby = lobby.players.some((p) => p.id === userId);
        if (!inLobby) {
            throw new Error('NOT_IN_LOBBY');
        }

        if (lobby.state === 'IN_PROGRESS') {
            throw new Error('LOBBY_GAME_IN_PROGRESS');
        }

        const remainingPlayers = lobby.players.filter((p) => p.id !== userId);

        if (remainingPlayers.length === 0) {
            await tx.lobby.delete({ where: { roomCode } });
            return { kind: 'deleted', lobbyId: lobby.id };
        }

        let newHostId = lobby.hostId;
        if (lobby.hostId === userId) {
            const ids = remainingPlayers.map((p) => p.id);
            newHostId = ids[randomInt(ids.length)];
        }

        await tx.lobby.update({
            where: { roomCode },
            data: {
                players: { disconnect: { id: userId } },
                hostId: newHostId,
            },
        });

        return { kind: 'updated', lobbyId: lobby.id };
    });
}

export async function deleteLobby(roomCodeRaw: string, actingUserId: string) {
  const roomCode = roomCodeRaw.toUpperCase();
  const lobby = await prisma.lobby.findUnique({
    where: { roomCode },
    select: { id: true, hostId: true },
  });
  if (!lobby) {
    throw new Error('LOBBY_NOT_FOUND');
  }
  if (lobby.hostId !== actingUserId) {
    throw new Error('FORBIDDEN_NOT_HOST');
  }
  try {
    const deleted = await prisma.lobby.delete({ where: { roomCode } });
    return deleted.id;
  } catch (error: any) {
    if (error.code === 'P2025') {
      throw new Error('LOBBY_NOT_FOUND');
    }
    throw error;
  }
}

export async function startLobby(roomCodeRaw: string, customPrompts?: string[]) {
    const roomCode = roomCodeRaw.toUpperCase();
    
    // Find lobby by room code first
    const lobby = await prisma.lobby.findUnique({
        where: { roomCode },
        include: { players: true },
    });

    if (!lobby) {
        throw new Error("LOBBY_NOT_FOUND");
    }

    // Start the game using game service with optional custom prompts
    const result = await startGameService(lobby.id, customPrompts);
    
    return result;
}

export async function endLobby(roomCodeRaw: string) {
    const roomCode = roomCodeRaw.toUpperCase();
    return await prisma.lobby.update({ where: { roomCode }, data: { state: "FINISHED" } });
}