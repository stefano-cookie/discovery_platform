import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e password sono obbligatori' });
    }
    
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Credenziali non valide' });
    }
    
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: !user.passwordChanged
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Change password
router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Password corrente e nuova password sono obbligatorie' });
    }
    
    const valid = await bcrypt.compare(currentPassword, req.user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Password corrente errata' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        passwordChanged: true
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    res.json({
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      mustChangePassword: !req.user.passwordChanged
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

export default router;