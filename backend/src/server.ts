import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket } from './ws/index.ts';
import authRoutes from './routes/authRoutes.ts';
import healthRoutes from './routes/healthRoutes.ts';
import lobbyRoutes from './routes/lobbyRoutes.ts';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/health', healthRoutes);
app.use('/lobby', lobbyRoutes);

app.get('/', (_, res) => {
    res.json({ message: 'The backend has been hit!!!' });
});

const wsAPI = setupWebSocket(server);
app.locals.broadcastLobbyCreated = wsAPI.broadcastLobbyCreated;
app.locals.broadcastLobbyDeleted = wsAPI.broadcastLobbyDeleted;
app.locals.broadcastPlayerLeft = wsAPI.broadcastPlayerLeft;

server.listen(PORT, HOST, () => {
    const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
    console.log(`WebSocket server running on ${baseUrl.replace('http', 'ws')}/ws`);
});