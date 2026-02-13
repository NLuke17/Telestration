import express from 'express';
import { createLobby, joinLobby, getLobbySnapshot } from "../services/lobbyService";

const router = express.Router();

// Create a lobby
router.post('/', async (req, res) => {
  try {
    const { hostId } = req.body;
    if (!hostId) return res.status(400).json({ error: "hostId is required" });

    const lobby = await createLobby(hostId);
    return res.status(201).json(lobby);
  } catch (e) {
    return res.status(500).json({ error: "Failed to create lobby" });
  }
});

// Join a lobby
router.post('/:roomCode/join', async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const lobby = await joinLobby(roomCode, userId);
    return res.json(lobby);
  } catch (e: any) {
    if (e.message === "LOBBY_NOT_FOUND") return res.status(404).json({ error: "Lobby not found" });
    if (e.message === "LOBBY_NOT_ACCEPTING") return res.status(400).json({ error: "Lobby is not accepting new players" });
    if (e.message === "ALREADY_IN_LOBBY") return res.status(400).json({ error: "Already in this lobby" });
    return res.status(500).json({ error: "Failed to join lobby" });
  }
});

// Get lobby snapshot
router.get('/:roomCode', async (req, res) => {
  try {
    const lobby = await getLobbySnapshot(req.params.roomCode);
    return res.json(lobby);
  } catch (e: any) {
    if (e.message === "LOBBY_NOT_FOUND") return res.status(404).json({ error: "Lobby not found" });
    return res.status(500).json({ error: "Failed to fetch lobby" });
  }
});

export default router;