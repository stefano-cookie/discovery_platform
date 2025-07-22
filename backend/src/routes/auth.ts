import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import emailService from '../services/emailService';

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
      where: { email },
      include: {
        partner: true
      }
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
        mustChangePassword: !user.passwordChanged,
        referralCode: user.partner?.referralCode || null
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

// Send email verification
router.post('/send-email-verification', async (req, res) => {
  try {
    const { email, referralCode } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email è obbligatoria' });
    }
    
    // Check if email already exists and is truly registered (has profile and registrations)
    const existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        registrations: true
      }
    });
    
    // Consider user as "truly registered" only if they have complete data
    const hasCompleteProfile = !!existingUser?.profile;
    const hasActiveRegistration = existingUser?.registrations && existingUser.registrations.length > 0;
    const isTrulyRegistered = existingUser && (hasCompleteProfile || hasActiveRegistration);
    
    if (isTrulyRegistered) {
      return res.status(400).json({ error: 'Email già registrata con un account completo' });
    }
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Create or update user with verification token - but mark as incomplete
    await prisma.user.upsert({
      where: { email },
      update: {
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiry: tokenExpiry
      },
      create: {
        email,
        password: 'INCOMPLETE_TEMP', // Temporary password - will be set during registration
        emailVerificationToken: verificationToken,
        emailVerificationTokenExpiry: tokenExpiry,
        role: 'USER',
        isActive: false // Mark as inactive until registration is complete
      }
    });
    
    // Create verification link
    const verificationLink = `${process.env.FRONTEND_URL}/email-verification?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    
    // Send email with verification link
    await emailService.sendEmailVerification(email, verificationLink);
    
    res.json({ 
      success: true,
      message: 'Email di verifica inviata'
    });
    
  } catch (error) {
    console.error('Send email verification error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token, email } = req.body;
    
    if (!token || !email) {
      return res.status(400).json({ error: 'Token e email sono obbligatori' });
    }
    
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato' });
    }
    
    // Allow re-verification if email is already verified (for UX)
    if (user.emailVerified) {
      return res.json({ 
        success: true,
        message: 'Email già verificata in precedenza',
        alreadyVerified: true
      });
    }
    
    if (!user.emailVerificationToken || user.emailVerificationToken !== token) {
      return res.status(400).json({ 
        error: 'Token di verifica non valido. Richiedi una nuova email di verifica.' 
      });
    }
    
    if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < new Date()) {
      return res.status(400).json({ 
        error: 'Token di verifica scaduto. Richiedi una nuova email di verifica.' 
      });
    }
    
    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null
      }
    });
    
    res.json({ 
      success: true,
      message: 'Email verificata con successo'
    });
    
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Check email verification status
router.get('/check-email-verification/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log(`🔍 EMAIL CHECK REQUEST for: ${email}`);
    
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
        registrations: true
      }
    });
    
    console.log(`🔍 EMAIL CHECK RESULT:`, {
      userExists: !!user,
      hasProfile: !!user?.profile,
      registrationsCount: user?.registrations?.length || 0,
      emailVerified: user?.emailVerified || false
    });
    
    if (!user) {
      return res.json({ verified: false, exists: false });
    }
    
    // Consider user as "truly registered" only if they have BOTH:
    // 1. A complete profile, AND 
    // 2. At least one active registration
    // Email verification alone is NOT enough to be considered "registered"
    const hasCompleteProfile = !!user.profile;
    const hasActiveRegistration = user.registrations.length > 0;
    const isTrulyRegistered = hasCompleteProfile && hasActiveRegistration;
    
    res.json({ 
      verified: user.emailVerified || false,
      exists: isTrulyRegistered
    });
    
  } catch (error) {
    console.error('Check email verification error:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Development utilities
if (process.env.NODE_ENV === 'development') {
  router.get('/test-email', async (_req, res) => {
    try {
      const isConnected = await emailService.testConnection();
      res.json({ 
        success: isConnected,
        message: isConnected ? 'Email configurata correttamente' : 'Errore configurazione email'
      });
    } catch (error) {
      res.status(500).json({ error: 'Errore test email' });
    }
  });


  // Clean user data for development
  router.delete('/dev-clean-user/:email', async (req, res) => {
    try {
      const { email } = req.params;
      
      const existingUser = await prisma.user.findUnique({
        where: { email: decodeURIComponent(email) },
        include: {
          profile: true,
          registrations: true
        }
      });

      if (!existingUser) {
        return res.json({ success: true, message: 'User not found, nothing to clean' });
      }

      await prisma.$transaction(async (tx) => {
        // Delete related records first
        if (existingUser.registrations.length > 0) {
          const registrationIds = existingUser.registrations.map(r => r.id);
          
          await tx.document.deleteMany({
            where: { registrationId: { in: registrationIds } }
          });
          await tx.couponUse.deleteMany({
            where: { registrationId: { in: registrationIds } }
          });
          await tx.paymentDeadline.deleteMany({
            where: { registrationId: { in: registrationIds } }
          });
          await tx.payment.deleteMany({
            where: { registrationId: { in: registrationIds } }
          });
          await tx.registration.deleteMany({
            where: { id: { in: registrationIds } }
          });
        }
        
        if (existingUser.profile) {
          await tx.userProfile.delete({
            where: { userId: existingUser.id }
          });
        }
        
        await tx.user.delete({
          where: { id: existingUser.id }
        });
      });

      res.json({ 
        success: true, 
        message: `User ${email} and all related data cleaned successfully` 
      });
    } catch (error) {
      console.error('Clean user error:', error);
      res.status(500).json({ error: 'Errore durante la pulizia' });
    }
  });
}

export default router;