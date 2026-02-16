import type { Server } from "http";
import { createWSS } from "./wsServer";
import { registerLobbyWS } from "./lobbyWs";

export function setupWebSocket(server: Server) {
    const { wss } = createWSS(server);
  
    // Register WS modules
    const lobby = registerLobbyWS(wss);
  
    // Return any server-side broadcasters you want to call from HTTP routes/services
    return {
      broadcastLobbyCreated: lobby.broadcastLobbyCreated,
    };
  }