import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket } from './websocket.ts';
import authRoutes from './routes/authRoutes.ts';
import healthRoutes from './routes/healthRoutes.ts';
import lobbyRoutes from './routes/lobbyRoutes.ts';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/health', healthRoutes);
app.use('/lobby', lobbyRoutes);

setupWebSocket(server);

app.get('/', (_, res) => {
    res.json({ message: 'The backend has been hit!!!' });
});


server.listen(PORT, () => {
    console.log(`HTTP + WS server running on port ${PORT}`);
});