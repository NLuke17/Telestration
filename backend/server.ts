import express from 'express';
import http from 'http';
import { setupWebSocket } from './websocket.ts';

const app = express();
const server = http.createServer(app);

setupWebSocket(server);

const PORT = process.env.PORT || 8000;

app.get('/health', (_, res) => {
    res.send('OK');
});

server.listen(PORT, () => {
    console.log(`HTTP + WS server running on port ${PORT}`);
});