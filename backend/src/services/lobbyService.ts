import prisma from '../prismaClient';

// Generate a random 6-character room code
function generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

const lobbyInclude = {
    host: { select: { id: true, username: true, profilePicture: true } },
    players: { select: { id: true, username: true, profilePicture: true } },
};

export async function createLobby(hostId: string) {
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
    const roomCode = roomCodeRaw.toUpperCase();

    const lobby = await prisma.lobby.findUnique({
        where: { roomCode },
        include: { players: true },
    });

    if (!lobby) throw new Error("LOBBY_NOT_FOUND");
    if (lobby.state !== "WAITING") throw new Error("LOBBY_NOT_ACCEPTING");
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
    return prisma.lobby.findUnique({
        where: { roomCode },
        include: lobbyInclude,
    }) || lobby;
}

export async function deleteLobby(roomCodeRaw: string) {
    const roomCode = roomCodeRaw.toUpperCase();
    await prisma.lobby.delete({ where: { roomCode } });
}

export async function startLobby(roomCodeRaw: string) {
    const roomCode = roomCodeRaw.toUpperCase();
    await prisma.lobby.update({ where: { roomCode }, data: { state: "STARTING" } });
}

export async function endLobby(roomCodeRaw: string) {
    const roomCode = roomCodeRaw.toUpperCase();
    await prisma.lobby.update({ where: { roomCode }, data: { state: "FINISHED" } });
}