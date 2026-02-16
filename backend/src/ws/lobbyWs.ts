import { WebSocketServer, WebSocket } from "ws";
import { Lobby } from "../generated/prisma";
import { sendJson, broadcast } from './wsutils';

type WSMessage =
  | { type: "lobby:connect"; roomCode: string; userId?: string }
  | { type: "ping" }
  | { type: string;[key: string]: any };


export function registerLobbyWS(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    sendJson(ws, { type: "welcome", message: "Welcome to the server" });

    ws.on("message", (raw: Buffer) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(raw.toString("utf8"));
      } catch {
        return sendJson(ws, { type: "error", message: "Invalid JSON" });
      }

      // Lobby WS events
      if (msg.type === "lobby:connect") {
        // TODO:
        // - validate roomCode exists (DB)
        // - track presence in memory by roomCode/lobbyId
        // - broadcast lobby snapshot
        return sendJson(ws, { type: "lobby:connected", roomCode: msg.roomCode.toUpperCase() });
      }

      if (msg.type === "ping") {
        return sendJson(ws, { type: "pong" });
      }

      sendJson(ws, { type: "error", message: `Unknown type: ${msg.type}` });
    });
  });



  function broadcastLobbyCreated(lobby: Lobby) {
    broadcast(wss, {
      type: "lobby_created",
      data: lobby,
    });
  };

  function broadcastLobbyDeleted(lobby: Lobby) {
    broadcast(wss, {
      type: "lobby_deleted",
      data: lobby
    })
  }

  function broadcastPlayerLeft(lobby: Lobby) {
    broadcast(wss, {
      type: "player_left",
      data: lobby
    })
  }

  return { broadcastLobbyCreated, broadcastLobbyDeleted, broadcastPlayerLeft };
}