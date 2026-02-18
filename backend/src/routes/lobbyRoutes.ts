import express from 'express';
import { createLobby, joinLobby, getLobbySnapshot, deleteLobby, startLobby, endLobby, leaveLobby } from "../services/lobbyService";
import { validate } from "../middleware/validate";
import { createLobbySchema, joinLobbySchema, getLobbySchema, deleteLobbySchema, startLobbySchema, endLobbySchema, leaveLobbySchema } from "../validation/lobby.validation";
import { WSGatewayHandle } from "../ws/index";

const router = express.Router();

function getWSHandle(req: express.Request): WSGatewayHandle | null {
  return req.app.get('wsHandle') || null;
}

// Create a lobby
router.post('/', validate(createLobbySchema), async (req, res) => {
  try {
    const { hostId } = req.body;
    const lobby = await createLobby(hostId);
    const wsHandle = getWSHandle(req);
    if (wsHandle) {
      await wsHandle.notifyLobbyCreated(lobby.id);
    }
    
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
    
    // Notify WebSocket clients
    const wsHandle = getWSHandle(req);
    if (wsHandle) {
      await wsHandle.notifyPlayerJoined(lobby.id, userId);
    }
    
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

// Start a lobby
router.post('/:roomCode/start', validate(startLobbySchema), async (req, res) => {
  try {
    const roomCode = typeof req.params.roomCode === 'string' ? req.params.roomCode : req.params.roomCode[0];
    const lobby = await startLobby(roomCode);
    
    // Notify WebSocket clients
    const wsHandle = getWSHandle(req);
    if (wsHandle) {
      await wsHandle.notifyLobbyUpdated(lobby.id);
    }
    
    return res.json({ message: "Lobby started" });
  } catch (e: any) {
    if (e.message === "LOBBY_NOT_FOUND") return res.status(404).json({ error: "Lobby not found" });
    return res.status(500).json({ error: "Failed to start lobby" });
  }
});

// End a lobby
router.post('/:roomCode/end', validate(endLobbySchema), async (req, res) => {
  try {
    const roomCode = typeof req.params.roomCode === 'string' ? req.params.roomCode : req.params.roomCode[0];
    const lobby = await endLobby(roomCode);
    
    // Notify WebSocket clients
    const wsHandle = getWSHandle(req);
    if (wsHandle) {
      await wsHandle.notifyLobbyUpdated(lobby.id);
    }
    
    return res.json({ message: "Lobby ended" });
  } catch (e: any) {
    if (e.message === "LOBBY_NOT_FOUND") return res.status(404).json({ error: "Lobby not found" });
    return res.status(500).json({ error: "Failed to end lobby" });
  }
});

router.post('/:roomCode/leave', validate(leaveLobbySchema), async (req, res) => {
  try {
    const roomCode = typeof req.params.roomCode === 'string' ? req.params.roomCode : req.params.roomCode[0];
    const { userId } = req.body;
    const lobby = await leaveLobby(roomCode, userId);
    
    // Notify WebSocket clients
    const wsHandle = getWSHandle(req);
    if (wsHandle) {
      await wsHandle.notifyPlayerLeft(lobby.id, userId);
    }
    
    return res.json({ message: "Lobby left" });
  } catch (e: any) {
    if (e.message === "LOBBY_NOT_FOUND") return res.status(404).json({ error: "Lobby not found" });
    return res.status(500).json({ error: "Failed to leave lobby" });
  }
});

// Delete a lobby
router.delete('/:roomCode', validate(deleteLobbySchema), async (req, res) => {
  try {
    const roomCode = typeof req.params.roomCode === 'string' ? req.params.roomCode : req.params.roomCode[0];
    const lobbyId = await deleteLobby(roomCode);
    
    // Notify WebSocket clients
    const wsHandle = getWSHandle(req);
    if (wsHandle) {
      await wsHandle.notifyLobbyDeleted(lobbyId);
    }
    
    return res.json({ message: "Lobby deleted" });
  } catch (e: any) {
    if (e.message === "LOBBY_NOT_FOUND") return res.status(404).json({ error: "Lobby not found" });
    return res.status(500).json({ error: "Failed to delete lobby" });
  }
});

export default router;