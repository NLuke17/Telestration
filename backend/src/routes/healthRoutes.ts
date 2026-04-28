import express from 'express';
import prisma from '../prisma/client';
import { isProd } from '../config/env';
import { LOBBY_IDLE_TTL_SECONDS } from '../config/constants';
import { getLobbyRegistry } from '../ws/state/lobbyRegistry';

const router = express.Router();

router.get('/', (_req, res) => {
    res.json({ message: 'Health check passed' });
});

/**
 * Dev/ops: list recent lobbies from Postgres + in-memory WS connection counts.
 * Disabled in production (returns 404) to avoid leaking room codes on public URLs.
 */
router.get('/lobbies', async (_req, res) => {
    if (isProd()) {
        return res.status(404).json({ error: 'Not found' });
    }

    try {
        const registry = getLobbyRegistry();
        const lobbies = await prisma.lobby.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
                id: true,
                roomCode: true,
                state: true,
                createdAt: true,
                host: { select: { id: true, username: true } },
                players: { select: { id: true, username: true } },
            },
        });

        const withWs = lobbies.map((l) => ({
            ...l,
            wsConnectionCount: registry.getLobbyConnectionCount(l.id),
        }));

        return res.json({
            note: 'Lobbies are FINISHED only when POST /lobby/:roomCode/end runs. LOBBY_IDLE_TTL_SECONDS is defined in constants but not enforced yet; presence cleanup only drops WS presence after reconnect grace.',
            configuredIdleTtlSeconds: LOBBY_IDLE_TTL_SECONDS,
            lobbies: withWs,
        });
    } catch (err: any) {
        return res.status(500).json({ error: err.message || 'Failed to list lobbies' });
    }
});

router.get('/db', async (_req, res) => {
    try {
        const userCount = await prisma.user.count();
        res.json({ 
            message: 'DB check passed', 
            status: 'healthy',
            userCount 
        });
    } catch (err: any) {
        res.status(500).json({ 
            message: 'DB check failed', 
            status: 'unhealthy',
            error: err.message 
        });
    }
});

export default router;