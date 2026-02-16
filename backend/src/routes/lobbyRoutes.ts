import express from 'express';
import { createLobby, joinLobby, getLobbySnapshot } from "../services/lobbyService";
import { validate } from "../middleware/validate";
import { createLobbySchema, joinLobbySchema, getLobbySchema } from "../validation/lobby.validation";

const router = express.Router();

// Create a lobby
router.post('/', validate(createLobbySchema), async (req, res) => {
  try {
    const { hostId } = req.body;
    const lobby = await createLobby(hostId);
    return res.status(201).json(lobby);
  } catch (e) {
    return res.status(500).json({ error: "Failed to create lobby" });
  }
});

// Join a lobby
router.post('/:roomCode/join', validate(joinLobbySchema), async (req, res) => {
  try {
    const roomCode = typeof req.params.roomCode === 'string' ? req.params.roomCode : req.params.roomCode[0];
    const { userId } = req.body;

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
router.get('/:roomCode', validate(getLobbySchema), async (req, res) => {
  try {
    const roomCode = typeof req.params.roomCode === 'string' ? req.params.roomCode : req.params.roomCode[0];
    const lobby = await getLobbySnapshot(roomCode);
    return res.json(lobby);
  } catch (e: any) {
    if (e.message === "LOBBY_NOT_FOUND") return res.status(404).json({ error: "Lobby not found" });
    return res.status(500).json({ error: "Failed to fetch lobby" });
  }
});

export default router;