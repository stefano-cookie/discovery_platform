/**
 * Token Helper Utilities
 * Centralized JWT token generation with admin display name support
 */

import jwt from 'jsonwebtoken';
import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

export interface TokenPayload {
  id: string;
  type: 'user' | 'partner';
  role?: UserRole;
  partnerCompanyId?: string;
  twoFactorVerified?: boolean;
  requires2FASetup?: boolean;
  adminDisplayName?: string; // NEW: Admin display name for audit logs
}

/**
 * Generate JWT token with admin display name if applicable
 */
export async function generateUserToken(
  userId: string,
  userRole: UserRole,
  twoFactorVerified: boolean = true,
  requires2FASetup: boolean = false,
  expiresIn: string = '7d'
): Promise<string> {
  const payload: TokenPayload = {
    id: userId,
    type: 'user',
    role: userRole,
    twoFactorVerified,
    requires2FASetup,
  };

  // If user is ADMIN, fetch and include display name
  if (userRole === UserRole.ADMIN) {
    const adminAccount = await prisma.adminAccount.findUnique({
      where: { userId },
      select: { displayName: true },
    });

    if (adminAccount) {
      payload.adminDisplayName = adminAccount.displayName;
    }
  }

  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn } as jwt.SignOptions);
}

/**
 * Generate JWT token for partner employee
 */
export function generatePartnerToken(
  employeeId: string,
  partnerCompanyId: string,
  employeeRole: string,
  twoFactorVerified: boolean = true,
  expiresIn: string = '7d'
): string {
  const payload = {
    id: employeeId,
    type: 'partner' as const,
    partnerCompanyId,
    role: employeeRole,
    twoFactorVerified,
  };

  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn } as jwt.SignOptions);
}
