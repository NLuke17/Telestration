import { WebSocketServer, WebSocket } from "ws";
import { Server } from 'http';
import { sendJson, broadcast } from './wsutils';

export type WSContext = {
  wss: WebSocketServer;
}

export function createWSS(server: Server) {
    const wss = new WebSocketServer({server, path: '/ws', maxPayload: 1024 * 1024}); // 10MB
    
    // Ping pong heartbeat
    const interval = setInterval(() => {
      wss.clients.forEach((ws: WebSocket) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    wss.on('close', () => {
      clearInterval(interval);
    });
  
    wss.on("connection", (ws: WebSocket) => {
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('error', console.error);
      console.log("Client connected");

      sendJson(ws, { type: "welcome", message: "Welcome to the server" });
  
      ws.on("message", (message: Buffer) => {
        console.log(`Received: ${message}`);
      });
    });

    return {wss};

}


