import crypto from 'crypto';
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

export async function leaveLobby(roomCodeRaw: string, userId: string) {
    const roomCode = roomCodeRaw.toUpperCase();
    const lobby = await prisma.lobby.update({ where: { roomCode }, data: { players: { disconnect: { id: userId } } }, include: lobbyInclude });
    return lobby;
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