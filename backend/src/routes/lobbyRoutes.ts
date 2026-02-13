import express from 'express';
import prisma from '../prismaClient.ts';

const router = express.Router();

// Generate a random 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing chars (0, O, 1, I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a lobby
router.post('/', async (req, res) => {
  try {
    const { hostId } = req.body;

    if (!hostId) {
      res.status(400).json({ error: 'hostId is required' });
      return;
    }

    // Generate unique room code
    let roomCode = generateRoomCode();
    let existingLobby = await prisma.lobby.findUnique({ where: { roomCode } });
    while (existingLobby) {
      roomCode = generateRoomCode();
      existingLobby = await prisma.lobby.findUnique({ where: { roomCode } });
    }

    const lobby = await prisma.lobby.create({
      data: {
        roomCode,
        hostId,
        players: {
          connect: { id: hostId },
        },
      },
      include: {
        host: { select: { id: true, username: true, profilePicture: true } },
        players: { select: { id: true, username: true, profilePicture: true } },
      },
    });

    res.status(201).json(lobby);
  } catch (error) {
    console.error('Error creating lobby:', error);
    res.status(500).json({ error: 'Failed to create lobby' });
  }
});

// Join a lobby
router.post('/:roomCode/join', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const lobby = await prisma.lobby.findUnique({
      where: { roomCode: roomCode.toUpperCase() },
      include: { players: true },
    });

    if (!lobby) {
      res.status(404).json({ error: 'Lobby not found' });
      return;
    }

    if (lobby.state !== 'WAITING') {
      res.status(400).json({ error: 'Lobby is not accepting new players' });
      return;
    }

    // Check if already in lobby
    if (lobby.players.some((p) => p.id === userId)) {
      res.status(400).json({ error: 'Already in this lobby' });
      return;
    }

    const updatedLobby = await prisma.lobby.update({
      where: { roomCode: roomCode.toUpperCase() },
      data: {
        players: {
          connect: { id: userId },
        },
      },
      include: {
        host: { select: { id: true, username: true, profilePicture: true } },
        players: { select: { id: true, username: true, profilePicture: true } },
      },
    });

    res.json(updatedLobby);
  } catch (error) {
    console.error('Error joining lobby:', error);
    res.status(500).json({ error: 'Failed to join lobby' });
  }
});

// Get lobby snapshot
router.get('/:roomCode', async (req, res) => {
  try {
    const { roomCode } = req.params;

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
                author: { select: { id: true, username: true } },
              },
            },
          },
        },
      },
    });

    if (!lobby) {
      res.status(404).json({ error: 'Lobby not found' });
      return;
    }

    res.json(lobby);
  } catch (error) {
    console.error('Error fetching lobby:', error);
    res.status(500).json({ error: 'Failed to fetch lobby' });
  }
});

export default router;