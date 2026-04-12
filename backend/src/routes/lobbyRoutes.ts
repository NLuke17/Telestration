import express from 'express';
import { createLobby, joinLobby, getLobbySnapshot, deleteLobby, startLobby, endLobby, leaveLobby } from "../services/lobbyService";
import { getGameState } from "../services/gameStateService";
import { tryAdvanceInitialPromptsIfReadyByRoomCode } from "../services/gameService";
import { logInfo } from "../utils/logger";
import { validate } from "../middleware/validate";
import { createLobbySchema, joinLobbySchema, getLobbySchema, deleteLobbySchema, startLobbySchema, endLobbySchema, leaveLobbySchema, getGameStateSchema } from "../validation/lobby.validation";
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

// Get complete game state for a user
router.get('/:roomCode/state', validate(getGameStateSchema), async (req, res) => {
  try {
    const roomCode = typeof req.params.roomCode === 'string' ? req.params.roomCode : req.params.roomCode[0];
    const { userId } = req.query;

    const repair = await tryAdvanceInitialPromptsIfReadyByRoomCode(roomCode);
    if (repair.advanced) {
      logInfo('GET /lobby/:roomCode/state repaired initial prompts → DRAWING', {
        roomCode,
        lobbyId: repair.lobbyId,
        endsAt: repair.endsAt,
      });
    }
    const state = await getGameState(roomCode, userId as string);

    const wsHandle = getWSHandle(req);
    if (repair.advanced && repair.endsAt != null && repair.lobbyId && wsHandle) {
      await wsHandle.notifyPhaseChange(repair.lobbyId, 'DRAWING', { endsAt: repair.endsAt });
    }

    return res.json(state);
  } catch (e: any) {
    if (e.message === "LOBBY_NOT_FOUND") return res.status(404).json({ error: "Lobby not found" });
    if (e.message === "ROUND_NOT_FOUND") return res.status(404).json({ error: "No active round found" });
    return res.status(500).json({ error: "Failed to fetch game state" });
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
    const customPrompts = req.body?.prompts;
    
    // Get lobby info to retrieve player IDs
    const lobby = await getLobbySnapshot(roomCode);
    const playerIds = lobby.players.map(p => p.id);
    
    // If no custom prompts in body, try to get from WebSocket prompt tracker
    let promptsToUse = customPrompts;
    if (!promptsToUse) {
      const wsHandle = getWSHandle(req);
      if (wsHandle) {
        const collectedPrompts = wsHandle.getPromptsForLobby(lobby.id, playerIds);
        // Only use collected prompts if all players submitted
        if (collectedPrompts.every(p => p && p.trim().length > 0)) {
          promptsToUse = collectedPrompts;
        }
      }
    }
    
    const result = await startLobby(roomCode, promptsToUse);
    
    // Notify WebSocket clients about game start
    const wsHandle = getWSHandle(req);
    if (wsHandle) {
      await wsHandle.notifyGameStarted(result.lobby.id, result.round.id, result.round.number);
    }
    
    return res.json({ 
      message: "Game started",
      roundId: result.round.id,
      roundNumber: result.round.number,
      flipbooks: result.flipbooks.map(fb => ({
        id: fb.id,
        prompt: fb.prompt,
        authorId: fb.author.id,
        authorUsername: fb.author.username,
      })),
    });
  } catch (e: any) {
    if (e.message === "LOBBY_NOT_FOUND") return res.status(404).json({ error: "Lobby not found" });
    if (e.message === "LOBBY_ALREADY_STARTED") return res.status(400).json({ error: "Lobby already started" });
    if (e.message === "NOT_ENOUGH_PLAYERS") return res.status(400).json({ error: "Not enough players to start" });
    if (e.message === "PROMPT_COUNT_MISMATCH") return res.status(400).json({ error: "Number of prompts must match number of players" });
    if (e.message === "INVALID_PROMPTS") return res.status(400).json({ error: "All prompts must be non-empty strings" });
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

// Delete a lobby (host only — pass ?userId= matching lobby host)
router.delete('/:roomCode', validate(deleteLobbySchema), async (req, res) => {
  try {
    const roomCode = typeof req.params.roomCode === 'string' ? req.params.roomCode : req.params.roomCode[0];
    const userId = req.query.userId as string;
    const lobbyId = await deleteLobby(roomCode, userId);

    const wsHandle = getWSHandle(req);
    if (wsHandle) {
      await wsHandle.notifyLobbyDeleted(lobbyId);
    }

    return res.json({ message: "Lobby deleted" });
  } catch (e: any) {
    if (e.message === "LOBBY_NOT_FOUND") return res.status(404).json({ error: "Lobby not found" });
    if (e.message === "FORBIDDEN_NOT_HOST") {
      return res.status(403).json({ error: "Only the host can delete this lobby" });
    }
    return res.status(500).json({ error: "Failed to delete lobby" });
  }
});

export default router;