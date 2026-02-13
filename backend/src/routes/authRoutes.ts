import express from 'express';
import prisma from '../prismaClient';

const router = express.Router();

//CRUD
//test route to create a user
router.post('/create-user', async (req, res) => {
    const { username, password } = req.body ?? {};
  
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }
  
    try {
      const user = await prisma.user.create({
        data: { username, password },
      });
  
      return res.status(201).json(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ message: 'Failed to create user', error: message });
    }
  });

router.get('/all-users', async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        return res.status(200).json(users);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return res.status(500).json({ message: 'Failed to get users', error: message });
    }
});

router.put('/:id', (req, res) => {});

router.delete('/:id', (req, res) => {});

export default router;