import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    type?: string; // 'user' or 'partner'
    role?: string;
  };
}

/**
 * Middleware to check if password is expired and block access if needed
 * Should be applied AFTER authentication middleware
 */
export const checkPasswordExpiration = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId) {
      // No user authenticated, skip check
      return next();
    }

    let isExpired = false;
    let daysUntilExpiry: number | null = null;
    let passwordExpiresAt: Date | null = null;

    if (userType === 'partner') {
      // Check PartnerEmployee
      const employee = await prisma.partnerEmployee.findUnique({
        where: { id: userId },
        select: { passwordExpiresAt: true }
      });

      passwordExpiresAt = employee?.passwordExpiresAt || null;
    } else {
      // Check User (USER or ADMIN)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordExpiresAt: true }
      });

      passwordExpiresAt = user?.passwordExpiresAt || null;
    }

    if (passwordExpiresAt) {
      const now = new Date();
      const timeDiff = passwordExpiresAt.getTime() - now.getTime();
      daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      isExpired = daysUntilExpiry <= 0;
    }

    if (isExpired) {
      // Password expired - block access
      return res.status(403).json({
        error: 'Password scaduta. Devi modificare la password per continuare.',
        passwordExpired: true,
        requiresPasswordChange: true,
        message: 'La tua password è scaduta. Per motivi di sicurezza, devi modificarla prima di poter accedere alla piattaforma.'
      });
    }

    // Password not expired, continue
    next();

  } catch (error) {
    console.error('Error checking password expiration:', error);
    // Don't block on error, just log and continue
    next();
  }
};

/**
 * Attach password expiration info to response headers
 * Useful for frontend to display warnings
 */
export const attachPasswordExpirationInfo = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const userType = req.user?.type;

    if (!userId) {
      return next();
    }

    let passwordExpiresAt: Date | null = null;

    if (userType === 'partner') {
      const employee = await prisma.partnerEmployee.findUnique({
        where: { id: userId },
        select: { passwordExpiresAt: true }
      });
      passwordExpiresAt = employee?.passwordExpiresAt || null;
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordExpiresAt: true }
      });
      passwordExpiresAt = user?.passwordExpiresAt || null;
    }

    if (passwordExpiresAt) {
      const now = new Date();
      const timeDiff = passwordExpiresAt.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      // Attach info to response headers
      res.setHeader('X-Password-Expires-At', passwordExpiresAt.toISOString());
      res.setHeader('X-Password-Days-Until-Expiry', daysUntilExpiry.toString());
      res.setHeader('X-Password-Is-Expiring-Soon', (daysUntilExpiry <= 7).toString());
    }

    next();

  } catch (error) {
    console.error('Error attaching password expiration info:', error);
    next();
  }
};
