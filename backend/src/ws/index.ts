import type { Server } from "http";
import { createWSS } from "./wsServer";
import { registerLobbyWS } from "./lobbyWs";

export function setupWebSocket(server: Server) {
  const { wss } = createWSS(server);

  const lobby = registerLobbyWS(wss);

  return {
    broadcastLobbyCreated: lobby.broadcastLobbyCreated,
    broadcastLobbyDeleted: lobby.broadcastLobbyDeleted,
    broadcastPlayerLeft: lobby.broadcastPlayerLeft
  };
}