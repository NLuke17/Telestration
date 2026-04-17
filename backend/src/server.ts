import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket, WSGatewayHandle } from './ws/index';
import authRoutes from './routes/authRoutes';
import healthRoutes from './routes/healthRoutes';
import lobbyRoutes from './routes/lobbyRoutes';
import gameRoutes from './routes/gameRoutes';
import mediaRoutes from './routes/mediaRoutes';

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// Setup WebSocket and attach handle to app
const wsHandle: WSGatewayHandle = setupWebSocket(server);
app.set('wsHandle', wsHandle);

// REST API under /api so the same hostname can serve the SPA (e.g. /lobby/:code) and JSON (e.g. /api/lobby/:code).
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/lobby', lobbyRoutes);
app.use('/api/game', gameRoutes);

app.get('/', (_, res) => {
    res.json({ message: 'Telestration backend is running!' });
});

server.listen(PORT, HOST, () => {
    const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
    console.log(`Server running on ${baseUrl}`);
    console.log(`WebSocket server running on ${baseUrl.replace('http', 'ws')}/ws`);
});