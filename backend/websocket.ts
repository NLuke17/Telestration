import { WebSocketServer } from "ws";
import si from "systeminformation";
import {Server} from 'http';

export function setupWebSocket(server: Server) {
    const wss = new WebSocketServer({ server });
  
    wss.on("connection", (ws) => {
      console.log("Client connected");
  
      ws.on("message", (message) => {
        console.log(`Received: ${message}`);
      });
  
      ws.send("Welcome to the server");

      setInterval(async () => {
        const data = await getSystemInformation();
        ws.send(JSON.stringify({
          type: "system_info",
          data
        }));
      }, 1000);
    });
}

async function getSystemInformation() {
  const [cpu, mem, osInfo] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.osInfo()
  ]);
  return { cpu, mem, osInfo };
}