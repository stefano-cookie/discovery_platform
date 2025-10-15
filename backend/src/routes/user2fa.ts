import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import twoFactorServiceUnified, { EntityType } from '../services/twoFactorServiceUnified';
import { validateEncryptionKey } from '../utils/encryption';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateUserToken } from '../utils/tokenHelpers';

const router = express.Router();
const prisma = new PrismaClient();

// Validate encryption key on startup
validateEncryptionKey();

/**
 * POST /api/user/2fa/setup
 * Start 2FA setup process (generate QR + secret)
 * Requires user to be authenticated
 */
router.post('/setup', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return res.status(400).json({
        error: 'Two-factor authentication already enabled',
      });
    }

    // Generate setup
    const setup = await twoFactorServiceUnified.generateTwoFactorSetup(
      EntityType.USER,
      userId,
      user.email
    );

    return res.json({
      message: '2FA setup generated successfully',
      data: {
        qrCode: setup.qrCodeDataUrl,
        secret: setup.secret, // Manual entry fallback
        recoveryCodes: setup.recoveryCodes,
      },
      instructions: {
        step1: 'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)',
        step2: 'Or manually enter the secret in your app',
        step3: 'Save the recovery codes in a safe place',
        step4: 'Verify setup by entering the 6-digit code',
      },
    });
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    return res.status(500).json({ error: 'Error during 2FA setup' });
  }
});

/**
 * POST /api/user/2fa/verify-setup
 * Confirm setup with first code
 */
router.post('/verify-setup', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { secret, code, recoveryCodes } = req.body;

    if (!secret || !code || !recoveryCodes) {
      return res.status(400).json({
        error: 'Missing parameters: secret, code, recoveryCodes required',
      });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify and enable 2FA
    const success = await twoFactorServiceUnified.verifyAndEnableTwoFactor(
      EntityType.USER,
      userId,
      secret,
      code,
      recoveryCodes
    );

    if (!success) {
      return res.status(400).json({
        error: 'Invalid code. Please try again.',
      });
    }

    // Get updated user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        partner: true,
        assignedPartner: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    // Generate new JWT token with 2FA verified and full access
    const token = await generateUserToken(
      user.id,
      user.role,
      true, // twoFactorVerified
      false // requires2FASetup
    );

    return res.json({
      message: 'Two-factor authentication activated successfully',
      twoFactorEnabled: true,
      token, // Provide new token with full access
      type: 'user',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        hasProfile: !!user.profile,
        twoFactorVerified: true,
        referralCode: user.partner?.referralCode || null,
        assignedPartner: user.assignedPartner
          ? {
              id: user.assignedPartner.id,
              referralCode: user.assignedPartner.referralCode,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error verifying 2FA setup:', error);
    return res.status(500).json({ error: 'Error activating 2FA' });
  }
});

/**
 * POST /api/user/2fa/verify
 * Verify 2FA code during login
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { sessionToken, code } = req.body;

    if (!sessionToken || !code) {
      return res.status(400).json({
        error: 'Missing parameters: sessionToken and code required',
      });
    }

    // Verify temporary session
    const sessionData = await twoFactorServiceUnified.verifyTwoFactorSession(
      sessionToken
    );

    if (!sessionData || sessionData.entityType !== EntityType.USER) {
      return res.status(401).json({
        error: 'Session expired or invalid',
      });
    }

    const userId = sessionData.entityId;

    // Verify 2FA code
    const result = await twoFactorServiceUnified.verifyTwoFactorCode(
      EntityType.USER,
      userId,
      code,
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        remainingAttempts: result.remainingAttempts,
      });
    }

    // Mark session as verified
    await twoFactorServiceUnified.markSessionVerified(sessionToken);

    // Generate final JWT with 2FA flag
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        partner: true,
        assignedPartner: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    const token = await generateUserToken(
      user.id,
      user.role,
      true // twoFactorVerified
    );

    return res.json({
      message: 'Authentication completed',
      token,
      type: 'user',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        hasProfile: !!user.profile,
        twoFactorVerified: true,
        referralCode: user.partner?.referralCode || null,
        assignedPartner: user.assignedPartner
          ? {
              id: user.assignedPartner.id,
              referralCode: user.assignedPartner.referralCode,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    return res.status(500).json({ error: 'Error during 2FA verification' });
  }
});

/**
 * POST /api/user/2fa/recovery
 * Use recovery code to login
 */
router.post('/recovery', async (req: Request, res: Response) => {
  try {
    const { sessionToken, recoveryCode } = req.body;

    if (!sessionToken || !recoveryCode) {
      return res.status(400).json({
        error: 'Missing parameters: sessionToken and recoveryCode required',
      });
    }

    // Verify temporary session
    const sessionData = await twoFactorServiceUnified.verifyTwoFactorSession(
      sessionToken
    );

    if (!sessionData || sessionData.entityType !== EntityType.USER) {
      return res.status(401).json({
        error: 'Session expired or invalid',
      });
    }

    const userId = sessionData.entityId;

    // Verify recovery code
    const result = await twoFactorServiceUnified.verifyRecoveryCode(
      EntityType.USER,
      userId,
      recoveryCode.replace(/\s+/g, ''), // Remove spaces
      req.ip,
      req.headers['user-agent']
    );

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
      });
    }

    // Mark session as verified
    await twoFactorServiceUnified.markSessionVerified(sessionToken);

    // Generate final JWT
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        partner: true,
        assignedPartner: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    const token = await generateUserToken(
      user.id,
      user.role,
      true // twoFactorVerified
    );

    // Get updated status
    const status = await twoFactorServiceUnified.getTwoFactorStatus(
      EntityType.USER,
      userId
    );

    return res.json({
      message: 'Authentication completed with recovery code',
      token,
      type: 'user',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        hasProfile: !!user.profile,
        twoFactorVerified: true,
        referralCode: user.partner?.referralCode || null,
        assignedPartner: user.assignedPartner
          ? {
              id: user.assignedPartner.id,
              referralCode: user.assignedPartner.referralCode,
            }
          : null,
      },
      warning:
        status?.needsRecoveryCodeRefresh
          ? 'Warning: less than 3 recovery codes remaining. Consider regenerating them.'
          : null,
    });
  } catch (error) {
    console.error('Error with recovery code:', error);
    return res.status(500).json({ error: 'Error verifying recovery code' });
  }
});

/**
 * GET /api/user/2fa/status
 * Get 2FA status for current user
 */
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = await twoFactorServiceUnified.getTwoFactorStatus(
      EntityType.USER,
      userId
    );

    if (!status) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(status);
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    return res.status(500).json({ error: 'Error retrieving 2FA status' });
  }
});

/**
 * POST /api/user/2fa/regenerate-backup
 * Regenerate recovery codes (requires current password)
 */
router.post('/regenerate-backup', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password' });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        error: 'Two-factor authentication not enabled',
      });
    }

    // Regenerate recovery codes
    const newRecoveryCodes = await twoFactorServiceUnified.regenerateRecoveryCodes(
      EntityType.USER,
      userId
    );

    return res.json({
      message: 'Recovery codes regenerated successfully',
      recoveryCodes: newRecoveryCodes,
      warning:
        'Save these codes in a safe place. Old codes are no longer valid.',
    });
  } catch (error) {
    console.error('Error regenerating backup codes:', error);
    return res.status(500).json({
      error: 'Error regenerating recovery codes',
    });
  }
});

/**
 * DELETE /api/user/2fa/disable
 * Disable 2FA (requires current 2FA code)
 */
router.delete('/disable', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: '2FA code required' });
    }

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify code before disabling
    const result = await twoFactorServiceUnified.verifyTwoFactorCode(
      EntityType.USER,
      userId,
      code
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid code',
      });
    }

    // Disable 2FA
    await twoFactorServiceUnified.disableTwoFactor(EntityType.USER, userId);

    return res.json({
      message: 'Two-factor authentication disabled',
      twoFactorEnabled: false,
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return res.status(500).json({ error: 'Error disabling 2FA' });
  }
});

/**
 * GET /api/user/2fa/audit-logs
 * Get 2FA audit logs for current user
 */
router.get('/audit-logs', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const limit = parseInt(req.query.limit as string) || 50;

    const logs = await prisma.twoFactorAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.json({ logs });
  } catch (error) {
    console.error('Error getting audit logs:', error);
    return res.status(500).json({ error: 'Error retrieving audit logs' });
  }
});

export default router;
