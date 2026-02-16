import { WebSocketServer, WebSocket } from "ws";
import si from "systeminformation";
import { Server } from 'http';
import { Lobby } from '../generated/prisma';

export function setupWebSocket(server: Server) {
    const wss = new WebSocketServer({server, path: '/ws', maxPayload: 1024 * 1024}); // 10MB
  
    wss.on("connection", (ws: WebSocket) => {
      console.log("Client connected");
      sendJson(ws, { type: "welcome", message: "Welcome to the server" });
      ws.on('error', console.error);
  
      ws.on("message", (message: Buffer) => {
        console.log(`Received: ${message}`);
      });
  
      // setInterval(async () => {
      //   const data = await getSystemInformation();
      //   ws.send(JSON.stringify({
      //     type: "system_info",
      //     data
      //   }));
      // }, 1000);
    });

    function broadcastLobbyCreated(lobby: Lobby) {
      broadcast(wss, {
        type: "lobby_created",
        data:lobby
      });
    }

    return { broadcastLobbyCreated };
}

// async function getSystemInformation() {
//   const [cpu, mem, osInfo] = await Promise.all([
//     si.currentLoad(),
//     si.mem(),
//     si.osInfo()
//   ]);
//   return { cpu, mem, osInfo };
// }

function sendJson(socket: WebSocket, payload: any) {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function broadcast(wss: WebSocketServer, payload: any) {
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }
    client.send(JSON.stringify(payload));
  }
}

