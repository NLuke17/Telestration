import { WebSocketServer, WebSocket } from "ws";


export function sendJson<T>(socket: WebSocket, payload: T) {
    if (socket.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  }
  
export function broadcast<T>(wss: WebSocketServer, payload: T) {
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(payload));
        }
    }
}