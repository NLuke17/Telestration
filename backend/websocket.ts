import { WebSocketServer } from "ws";
import {Server} from 'http';

export function setupWebSocket(server: Server) {
    const wss = new WebSocketServer({ server });
  
    wss.on("connection", (ws) => {
      console.log("Client connected");
  
      ws.on("message", (message) => {
        console.log(`Received: ${message}`);
      });
  
      ws.send("Welcome to the server");
    });
}