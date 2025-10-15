import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { PrismaClient, TwoFactorAction } from '@prisma/client';
import { encryptSecret, decryptSecret } from '../utils/encryption';

const prisma = new PrismaClient();

/**
 * Unified Two-Factor Authentication Service
 *
 * Supports 2FA for both Users and PartnerEmployees
 */

// Entity types
export enum EntityType {
  USER = 'USER',
  PARTNER_EMPLOYEE = 'PARTNER_EMPLOYEE',
}

// Configuration
const CONFIG = {
  ISSUER: 'Discovery CFO Education',
  SECRET_LENGTH: 32,
  RECOVERY_CODES_COUNT: 10,
  RECOVERY_CODE_LENGTH: 8, // 4 chars + dash + 4 chars
  BCRYPT_SALT_ROUNDS: 10,
  TOTP_WINDOW: 2, // ±60 seconds tolerance
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  SESSION_DURATION_MINUTES: 5,
};

/**
 * 2FA Setup interface
 */
export interface TwoFactorSetup {
  secret: string; // Base32 secret (unencrypted, show ONCE)
  qrCodeDataUrl: string; // QR code data URL
  recoveryCodes: string[]; // Recovery codes (unhashed, show ONCE)
}

/**
 * Entity info interface
 */
interface EntityInfo {
  id: string;
  email: string;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorBackupCodes: any;
  twoFactorVerifiedAt: Date | null;
  failedTwoFactorAttempts: number;
  lastFailedTwoFactorAt: Date | null;
  twoFactorLockedUntil: Date | null;
}

/**
 * Fetch entity by type and ID
 */
async function getEntity(
  entityType: EntityType,
  entityId: string
): Promise<EntityInfo | null> {
  if (entityType === EntityType.USER) {
    return await prisma.user.findUnique({
      where: { id: entityId },
    });
  } else {
    return await prisma.partnerEmployee.findUnique({
      where: { id: entityId },
    });
  }
}

/**
 * Update entity 2FA fields
 */
async function updateEntityTwoFactor(
  entityType: EntityType,
  entityId: string,
  data: any
): Promise<void> {
  if (entityType === EntityType.USER) {
    await prisma.user.update({
      where: { id: entityId },
      data,
    });
  } else {
    await prisma.partnerEmployee.update({
      where: { id: entityId },
      data,
    });
  }
}

/**
 * Generate new 2FA setup for an entity
 */
export async function generateTwoFactorSetup(
  entityType: EntityType,
  entityId: string,
  email: string
): Promise<TwoFactorSetup> {
  // Generate TOTP secret
  const secret = speakeasy.generateSecret({
    name: `${CONFIG.ISSUER} (${email})`,
    issuer: CONFIG.ISSUER,
    length: CONFIG.SECRET_LENGTH,
  });

  if (!secret.base32) {
    throw new Error('Failed to generate secret');
  }

  // Generate QR code
  const otpauthUrl = secret.otpauth_url;
  if (!otpauthUrl) {
    throw new Error('Failed to generate OTP URL');
  }

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Generate recovery codes
  const recoveryCodes = generateRecoveryCodes();

  // Audit log
  await createAuditLog(entityType, entityId, TwoFactorAction.BACKUP_GENERATED, {
    count: recoveryCodes.length,
  });

  return {
    secret: secret.base32,
    qrCodeDataUrl,
    recoveryCodes,
  };
}

/**
 * Verify and enable 2FA for an entity
 */
export async function verifyAndEnableTwoFactor(
  entityType: EntityType,
  entityId: string,
  secret: string,
  code: string,
  recoveryCodes: string[]
): Promise<boolean> {
  // Verify TOTP code
  const isValid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: CONFIG.TOTP_WINDOW,
  });

  if (!isValid) {
    await createAuditLog(entityType, entityId, TwoFactorAction.FAILED, {
      reason: 'Invalid setup code',
    });
    return false;
  }

  // Encrypt secret
  const encryptedSecret = encryptSecret(secret);

  // Hash recovery codes
  const hashedRecoveryCodes = await Promise.all(
    recoveryCodes.map((code) => bcrypt.hash(code, CONFIG.BCRYPT_SALT_ROUNDS))
  );

  // Save to database
  await updateEntityTwoFactor(entityType, entityId, {
    twoFactorEnabled: true,
    twoFactorSecret: encryptedSecret,
    twoFactorBackupCodes: hashedRecoveryCodes,
    twoFactorVerifiedAt: new Date(),
    failedTwoFactorAttempts: 0,
    lastFailedTwoFactorAt: null,
    twoFactorLockedUntil: null,
  });

  // Audit log
  await createAuditLog(entityType, entityId, TwoFactorAction.ENABLED, {
    timestamp: new Date().toISOString(),
  });

  return true;
}

/**
 * Verify 2FA code during login
 */
export async function verifyTwoFactorCode(
  entityType: EntityType,
  entityId: string,
  code: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
  const entity = await getEntity(entityType, entityId);

  if (!entity || !entity.twoFactorEnabled || !entity.twoFactorSecret) {
    return { success: false, error: 'Invalid 2FA configuration' };
  }

  // Check if account is locked
  if (entity.twoFactorLockedUntil && entity.twoFactorLockedUntil > new Date()) {
    const remainingMinutes = Math.ceil(
      (entity.twoFactorLockedUntil.getTime() - Date.now()) / 60000
    );
    return {
      success: false,
      error: `Account locked for ${remainingMinutes} minutes`,
    };
  }

  // Decrypt secret
  const secret = decryptSecret(entity.twoFactorSecret);

  // Verify TOTP code
  const isValid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: CONFIG.TOTP_WINDOW,
  });

  if (isValid) {
    // Reset failed attempts
    await updateEntityTwoFactor(entityType, entityId, {
      failedTwoFactorAttempts: 0,
      lastFailedTwoFactorAt: null,
      twoFactorLockedUntil: null,
    });

    // Audit log
    await createAuditLog(entityType, entityId, TwoFactorAction.VERIFIED, {
      ipAddress,
      userAgent,
    });

    return { success: true };
  }

  // Increment failed attempts
  const newFailedAttempts = (entity.failedTwoFactorAttempts || 0) + 1;
  const remainingAttempts = CONFIG.MAX_FAILED_ATTEMPTS - newFailedAttempts;

  // Lock account if max attempts reached
  if (newFailedAttempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = new Date(
      Date.now() + CONFIG.LOCKOUT_DURATION_MINUTES * 60000
    );

    await updateEntityTwoFactor(entityType, entityId, {
      failedTwoFactorAttempts: newFailedAttempts,
      lastFailedTwoFactorAt: new Date(),
      twoFactorLockedUntil: lockoutUntil,
    });

    await createAuditLog(entityType, entityId, TwoFactorAction.LOCKED, {
      reason: 'Max failed attempts',
      ipAddress,
      userAgent,
    });

    return {
      success: false,
      error: `Account locked for ${CONFIG.LOCKOUT_DURATION_MINUTES} minutes`,
    };
  }

  // Update failed attempts
  await updateEntityTwoFactor(entityType, entityId, {
    failedTwoFactorAttempts: newFailedAttempts,
    lastFailedTwoFactorAt: new Date(),
  });

  await createAuditLog(entityType, entityId, TwoFactorAction.FAILED, {
    attempts: newFailedAttempts,
    ipAddress,
    userAgent,
  });

  return {
    success: false,
    error: 'Invalid code',
    remainingAttempts,
  };
}

/**
 * Verify recovery code
 */
export async function verifyRecoveryCode(
  entityType: EntityType,
  entityId: string,
  recoveryCode: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string }> {
  const entity = await getEntity(entityType, entityId);

  if (!entity || !entity.twoFactorEnabled || !entity.twoFactorBackupCodes) {
    return { success: false, error: 'Recovery codes not available' };
  }

  // Check if account is locked
  if (entity.twoFactorLockedUntil && entity.twoFactorLockedUntil > new Date()) {
    return { success: false, error: 'Account locked' };
  }

  const hashedCodes = entity.twoFactorBackupCodes as string[];

  // Verify recovery code against all hashed codes
  for (let i = 0; i < hashedCodes.length; i++) {
    const isMatch = await bcrypt.compare(recoveryCode, hashedCodes[i]);

    if (isMatch) {
      // Remove used code
      const updatedCodes = hashedCodes.filter((_, index) => index !== i);

      await updateEntityTwoFactor(entityType, entityId, {
        twoFactorBackupCodes: updatedCodes,
        failedTwoFactorAttempts: 0,
        lastFailedTwoFactorAt: null,
        twoFactorLockedUntil: null,
      });

      await createAuditLog(entityType, entityId, TwoFactorAction.RECOVERY_USED, {
        remainingCodes: updatedCodes.length,
        ipAddress,
        userAgent,
      });

      return { success: true };
    }
  }

  return { success: false, error: 'Invalid recovery code' };
}

/**
 * Create temporary 2FA session (after password verification)
 */
export async function createTwoFactorSession(
  entityType: EntityType,
  entityId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  // Generate secure token
  const token = crypto.randomBytes(32).toString('hex');

  // Create session with 5 minutes validity
  const expiresAt = new Date(Date.now() + CONFIG.SESSION_DURATION_MINUTES * 60000);

  const sessionData: any = {
    token,
    expiresAt,
    ipAddress,
    userAgent,
  };

  if (entityType === EntityType.USER) {
    sessionData.userId = entityId;
  } else {
    sessionData.partnerEmployeeId = entityId;
  }

  await prisma.twoFactorSession.create({
    data: sessionData,
  });

  return token;
}

/**
 * Verify temporary 2FA session
 */
export async function verifyTwoFactorSession(
  token: string
): Promise<{ entityType: EntityType; entityId: string } | null> {
  const session = await prisma.twoFactorSession.findUnique({
    where: { token },
  });

  if (!session) {
    return null;
  }

  // Check expiration
  if (session.expiresAt < new Date()) {
    // Delete expired session
    await prisma.twoFactorSession.delete({
      where: { id: session.id },
    });
    return null;
  }

  // Check if already verified
  if (session.verified) {
    return null;
  }

  // Determine entity type and ID
  if (session.userId) {
    return {
      entityType: EntityType.USER,
      entityId: session.userId,
    };
  } else if (session.partnerEmployeeId) {
    return {
      entityType: EntityType.PARTNER_EMPLOYEE,
      entityId: session.partnerEmployeeId,
    };
  }

  return null;
}

/**
 * Mark session as verified
 */
export async function markSessionVerified(token: string): Promise<void> {
  await prisma.twoFactorSession.update({
    where: { token },
    data: { verified: true },
  });
}

/**
 * Regenerate recovery codes
 */
export async function regenerateRecoveryCodes(
  entityType: EntityType,
  entityId: string
): Promise<string[]> {
  const recoveryCodes = generateRecoveryCodes();

  const hashedCodes = await Promise.all(
    recoveryCodes.map((code) => bcrypt.hash(code, CONFIG.BCRYPT_SALT_ROUNDS))
  );

  await updateEntityTwoFactor(entityType, entityId, {
    twoFactorBackupCodes: hashedCodes,
  });

  await createAuditLog(entityType, entityId, TwoFactorAction.BACKUP_GENERATED, {
    count: recoveryCodes.length,
    regenerated: true,
  });

  return recoveryCodes;
}

/**
 * Disable 2FA for an entity
 */
export async function disableTwoFactor(
  entityType: EntityType,
  entityId: string
): Promise<void> {
  await updateEntityTwoFactor(entityType, entityId, {
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: undefined,
    twoFactorVerifiedAt: null,
    failedTwoFactorAttempts: 0,
    lastFailedTwoFactorAt: null,
    twoFactorLockedUntil: null,
  });

  // Delete all active 2FA sessions
  const whereClause: any = {};
  if (entityType === EntityType.USER) {
    whereClause.userId = entityId;
  } else {
    whereClause.partnerEmployeeId = entityId;
  }

  await prisma.twoFactorSession.deleteMany({
    where: whereClause,
  });

  await createAuditLog(entityType, entityId, TwoFactorAction.DISABLED, {
    timestamp: new Date().toISOString(),
  });
}

/**
 * Cleanup expired sessions (run via cron)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.twoFactorSession.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

/**
 * Get 2FA status for an entity
 */
export async function getTwoFactorStatus(
  entityType: EntityType,
  entityId: string
) {
  const entity = await getEntity(entityType, entityId);

  if (!entity) {
    return null;
  }

  const remainingRecoveryCodes = entity.twoFactorBackupCodes
    ? (entity.twoFactorBackupCodes as string[]).length
    : 0;

  return {
    enabled: entity.twoFactorEnabled,
    verifiedAt: entity.twoFactorVerifiedAt,
    isLocked: entity.twoFactorLockedUntil
      ? entity.twoFactorLockedUntil > new Date()
      : false,
    lockedUntil: entity.twoFactorLockedUntil,
    failedAttempts: entity.failedTwoFactorAttempts,
    remainingRecoveryCodes,
    needsRecoveryCodeRefresh: remainingRecoveryCodes < 3,
  };
}

// ============ UTILITY FUNCTIONS ============

/**
 * Generate recovery codes in XXXX-YYYY format
 */
function generateRecoveryCodes(): string[] {
  const codes: string[] = [];

  for (let i = 0; i < CONFIG.RECOVERY_CODES_COUNT; i++) {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    codes.push(`${part1}-${part2}`);
  }

  return codes;
}

/**
 * Create audit log for 2FA actions
 */
async function createAuditLog(
  entityType: EntityType,
  entityId: string,
  action: TwoFactorAction,
  details?: Record<string, any>
): Promise<void> {
  const logData: any = {
    action,
    ipAddress: details?.ipAddress,
    userAgent: details?.userAgent,
    details: details ? JSON.parse(JSON.stringify(details)) : undefined,
  };

  if (entityType === EntityType.USER) {
    logData.userId = entityId;
  } else {
    logData.partnerEmployeeId = entityId;
  }

  await prisma.twoFactorAuditLog.create({
    data: logData,
  });
}

export default {
  EntityType,
  generateTwoFactorSetup,
  verifyAndEnableTwoFactor,
  verifyTwoFactorCode,
  verifyRecoveryCode,
  createTwoFactorSession,
  verifyTwoFactorSession,
  markSessionVerified,
  regenerateRecoveryCodes,
  disableTwoFactor,
  cleanupExpiredSessions,
  getTwoFactorStatus,
};
