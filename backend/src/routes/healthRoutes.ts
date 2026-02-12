import express from 'express';
import prisma from '../prismaClient.ts';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Health check passed' });
});

router.get('/db', (req, res) => {
    prisma.user.findMany().then((users) => {
        res.json({ message: 'DB check passed', users });
    }).catch((err) => {
        res.status(500).json({ message: 'DB check failed', error: err.message });
    });
});

export default router;