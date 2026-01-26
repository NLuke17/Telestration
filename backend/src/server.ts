import express from 'express';
import cors from 'cors';
import http from 'http';
import { setupWebSocket } from './websocket.ts';
import authRoutes from './routes/authRoutes.ts';

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

setupWebSocket(server);

app.use('/auth', authRoutes);

const PORT = process.env.PORT || 8000;

app.get('/', (_, res) => {
    res.json({ message: 'The backend has been hit!!!' });
});

server.listen(PORT, () => {
    console.log(`HTTP + WS server running on port ${PORT}`);
});