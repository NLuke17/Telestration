import express from 'express';
import prisma from '../prisma/client';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Health check passed' });
});

router.get('/db', async (req, res) => {
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