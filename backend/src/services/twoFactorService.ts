import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { PrismaClient, TwoFactorAction } from '@prisma/client';
import { encryptSecret, decryptSecret } from '../utils/encryption';

const prisma = new PrismaClient();

/**
 * Two-Factor Authentication Service
 *
 * Gestisce setup, verifica e recovery del sistema 2FA per Partner Employees
 */

// Configurazione
const CONFIG = {
  ISSUER: 'Discovery CFO Education',
  SECRET_LENGTH: 32,
  RECOVERY_CODES_COUNT: 10,
  RECOVERY_CODE_LENGTH: 8, // 4 caratteri + dash + 4 caratteri
  BCRYPT_SALT_ROUNDS: 10,
  TOTP_WINDOW: 2, // Tolleranza ±60 secondi
  MAX_FAILED_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,
  SESSION_DURATION_MINUTES: 5,
};

/**
 * Interfaccia per setup 2FA
 */
export interface TwoFactorSetup {
  secret: string; // Base32 secret (non encrypted, da mostrare UNA volta)
  qrCodeDataUrl: string; // Data URL del QR code
  recoveryCodes: string[]; // Recovery codes (non hashati, da mostrare UNA volta)
}

/**
 * Genera un nuovo setup 2FA per un partner employee
 */
export async function generateTwoFactorSetup(
  partnerEmployeeId: string,
  email: string
): Promise<TwoFactorSetup> {
  // Genera secret TOTP
  const secret = speakeasy.generateSecret({
    name: `${CONFIG.ISSUER} (${email})`,
    issuer: CONFIG.ISSUER,
    length: CONFIG.SECRET_LENGTH,
  });

  if (!secret.base32) {
    throw new Error('Errore nella generazione del secret');
  }

  // Genera QR code
  const otpauthUrl = secret.otpauth_url;
  if (!otpauthUrl) {
    throw new Error('Errore nella generazione dell\'URL OTP');
  }

  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  // Genera recovery codes
  const recoveryCodes = generateRecoveryCodes();

  // Log audit
  await createAuditLog(
    partnerEmployeeId,
    TwoFactorAction.BACKUP_GENERATED,
    { count: recoveryCodes.length }
  );

  return {
    secret: secret.base32,
    qrCodeDataUrl,
    recoveryCodes,
  };
}

/**
 * Verifica e attiva 2FA per un partner employee
 */
export async function verifyAndEnableTwoFactor(
  partnerEmployeeId: string,
  secret: string,
  code: string,
  recoveryCodes: string[]
): Promise<boolean> {
  // Verifica il codice TOTP
  const isValid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: CONFIG.TOTP_WINDOW,
  });

  if (!isValid) {
    await createAuditLog(
      partnerEmployeeId,
      TwoFactorAction.FAILED,
      { reason: 'Invalid setup code' }
    );
    return false;
  }

  // Encrypta il secret
  const encryptedSecret = encryptSecret(secret);

  // Hash dei recovery codes
  const hashedRecoveryCodes = await Promise.all(
    recoveryCodes.map(code => bcrypt.hash(code, CONFIG.BCRYPT_SALT_ROUNDS))
  );

  // Salva nel database
  await prisma.partnerEmployee.update({
    where: { id: partnerEmployeeId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: encryptedSecret,
      twoFactorBackupCodes: hashedRecoveryCodes,
      twoFactorVerifiedAt: new Date(),
      failedTwoFactorAttempts: 0,
      lastFailedTwoFactorAt: null,
      twoFactorLockedUntil: null,
    },
  });

  // Log audit
  await createAuditLog(
    partnerEmployeeId,
    TwoFactorAction.ENABLED,
    { timestamp: new Date().toISOString() }
  );

  return true;
}

/**
 * Verifica un codice 2FA durante il login
 */
export async function verifyTwoFactorCode(
  partnerEmployeeId: string,
  code: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
  const employee = await prisma.partnerEmployee.findUnique({
    where: { id: partnerEmployeeId },
  });

  if (!employee || !employee.twoFactorEnabled || !employee.twoFactorSecret) {
    return { success: false, error: 'Configurazione 2FA non valida' };
  }

  // Verifica se account è bloccato
  if (employee.twoFactorLockedUntil && employee.twoFactorLockedUntil > new Date()) {
    const remainingMinutes = Math.ceil(
      (employee.twoFactorLockedUntil.getTime() - Date.now()) / 60000
    );
    return {
      success: false,
      error: `Account bloccato per ${remainingMinutes} minuti`,
    };
  }

  // Decrypta il secret
  const secret = decryptSecret(employee.twoFactorSecret);

  // Verifica il codice TOTP
  const isValid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: CONFIG.TOTP_WINDOW,
  });

  if (isValid) {
    // Reset tentativi falliti
    await prisma.partnerEmployee.update({
      where: { id: partnerEmployeeId },
      data: {
        failedTwoFactorAttempts: 0,
        lastFailedTwoFactorAt: null,
        twoFactorLockedUntil: null,
      },
    });

    // Log audit
    await createAuditLog(
      partnerEmployeeId,
      TwoFactorAction.VERIFIED,
      { ipAddress, userAgent }
    );

    return { success: true };
  }

  // Incrementa tentativi falliti
  const newFailedAttempts = (employee.failedTwoFactorAttempts || 0) + 1;
  const remainingAttempts = CONFIG.MAX_FAILED_ATTEMPTS - newFailedAttempts;

  // Blocca account se raggiunto limite
  if (newFailedAttempts >= CONFIG.MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = new Date(
      Date.now() + CONFIG.LOCKOUT_DURATION_MINUTES * 60000
    );

    await prisma.partnerEmployee.update({
      where: { id: partnerEmployeeId },
      data: {
        failedTwoFactorAttempts: newFailedAttempts,
        lastFailedTwoFactorAt: new Date(),
        twoFactorLockedUntil: lockoutUntil,
      },
    });

    await createAuditLog(
      partnerEmployeeId,
      TwoFactorAction.LOCKED,
      { reason: 'Max failed attempts', ipAddress, userAgent }
    );

    return {
      success: false,
      error: `Account bloccato per ${CONFIG.LOCKOUT_DURATION_MINUTES} minuti`,
    };
  }

  // Aggiorna tentativi falliti
  await prisma.partnerEmployee.update({
    where: { id: partnerEmployeeId },
    data: {
      failedTwoFactorAttempts: newFailedAttempts,
      lastFailedTwoFactorAt: new Date(),
    },
  });

  await createAuditLog(
    partnerEmployeeId,
    TwoFactorAction.FAILED,
    { attempts: newFailedAttempts, ipAddress, userAgent }
  );

  return {
    success: false,
    error: 'Codice non valido',
    remainingAttempts,
  };
}

/**
 * Verifica un recovery code
 */
export async function verifyRecoveryCode(
  partnerEmployeeId: string,
  recoveryCode: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; error?: string }> {
  const employee = await prisma.partnerEmployee.findUnique({
    where: { id: partnerEmployeeId },
  });

  if (!employee || !employee.twoFactorEnabled || !employee.twoFactorBackupCodes) {
    return { success: false, error: 'Recovery codes non disponibili' };
  }

  // Verifica se account è bloccato
  if (employee.twoFactorLockedUntil && employee.twoFactorLockedUntil > new Date()) {
    return { success: false, error: 'Account bloccato' };
  }

  const hashedCodes = employee.twoFactorBackupCodes as string[];

  // Verifica il recovery code contro tutti i codici hashati
  for (let i = 0; i < hashedCodes.length; i++) {
    const isMatch = await bcrypt.compare(recoveryCode, hashedCodes[i]);

    if (isMatch) {
      // Rimuovi il codice usato
      const updatedCodes = hashedCodes.filter((_, index) => index !== i);

      await prisma.partnerEmployee.update({
        where: { id: partnerEmployeeId },
        data: {
          twoFactorBackupCodes: updatedCodes,
          failedTwoFactorAttempts: 0,
          lastFailedTwoFactorAt: null,
          twoFactorLockedUntil: null,
        },
      });

      await createAuditLog(
        partnerEmployeeId,
        TwoFactorAction.RECOVERY_USED,
        { remainingCodes: updatedCodes.length, ipAddress, userAgent }
      );

      return { success: true };
    }
  }

  return { success: false, error: 'Recovery code non valido' };
}

/**
 * Crea una sessione 2FA temporanea (dopo verifica password)
 */
export async function createTwoFactorSession(
  partnerEmployeeId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {
  // Genera token sicuro
  const token = crypto.randomBytes(32).toString('hex');

  // Crea sessione con validità 5 minuti
  const expiresAt = new Date(Date.now() + CONFIG.SESSION_DURATION_MINUTES * 60000);

  await prisma.twoFactorSession.create({
    data: {
      partnerEmployeeId,
      token,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  return token;
}

/**
 * Verifica una sessione 2FA temporanea
 */
export async function verifyTwoFactorSession(token: string): Promise<string | null> {
  const session = await prisma.twoFactorSession.findUnique({
    where: { token },
  });

  if (!session) {
    return null;
  }

  // Verifica scadenza
  if (session.expiresAt < new Date()) {
    // Elimina sessione scaduta
    await prisma.twoFactorSession.delete({
      where: { id: session.id },
    });
    return null;
  }

  // Verifica che non sia già stata usata
  if (session.verified) {
    return null;
  }

  return session.partnerEmployeeId;
}

/**
 * Marca una sessione 2FA come verificata
 */
export async function markSessionVerified(token: string): Promise<void> {
  await prisma.twoFactorSession.update({
    where: { token },
    data: { verified: true },
  });
}

/**
 * Rigenera recovery codes
 */
export async function regenerateRecoveryCodes(
  partnerEmployeeId: string
): Promise<string[]> {
  const recoveryCodes = generateRecoveryCodes();

  const hashedCodes = await Promise.all(
    recoveryCodes.map(code => bcrypt.hash(code, CONFIG.BCRYPT_SALT_ROUNDS))
  );

  await prisma.partnerEmployee.update({
    where: { id: partnerEmployeeId },
    data: {
      twoFactorBackupCodes: hashedCodes,
    },
  });

  await createAuditLog(
    partnerEmployeeId,
    TwoFactorAction.BACKUP_GENERATED,
    { count: recoveryCodes.length, regenerated: true }
  );

  return recoveryCodes;
}

/**
 * Disabilita 2FA per un partner employee
 */
export async function disableTwoFactor(partnerEmployeeId: string): Promise<void> {
  await prisma.partnerEmployee.update({
    where: { id: partnerEmployeeId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: undefined, // Use undefined instead of null for Json type
      twoFactorVerifiedAt: null,
      failedTwoFactorAttempts: 0,
      lastFailedTwoFactorAt: null,
      twoFactorLockedUntil: null,
    },
  });

  // Elimina tutte le sessioni 2FA attive
  await prisma.twoFactorSession.deleteMany({
    where: { partnerEmployeeId },
  });

  await createAuditLog(
    partnerEmployeeId,
    TwoFactorAction.DISABLED,
    { timestamp: new Date().toISOString() }
  );
}

/**
 * Cleanup sessioni 2FA scadute (da eseguire con cron)
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
 * Ottiene stato 2FA di un partner employee
 */
export async function getTwoFactorStatus(partnerEmployeeId: string) {
  const employee = await prisma.partnerEmployee.findUnique({
    where: { id: partnerEmployeeId },
    select: {
      twoFactorEnabled: true,
      twoFactorVerifiedAt: true,
      failedTwoFactorAttempts: true,
      twoFactorLockedUntil: true,
      twoFactorBackupCodes: true,
    },
  });

  if (!employee) {
    return null;
  }

  const remainingRecoveryCodes = employee.twoFactorBackupCodes
    ? (employee.twoFactorBackupCodes as string[]).length
    : 0;

  return {
    enabled: employee.twoFactorEnabled,
    verifiedAt: employee.twoFactorVerifiedAt,
    isLocked: employee.twoFactorLockedUntil
      ? employee.twoFactorLockedUntil > new Date()
      : false,
    lockedUntil: employee.twoFactorLockedUntil,
    failedAttempts: employee.failedTwoFactorAttempts,
    remainingRecoveryCodes,
    needsRecoveryCodeRefresh: remainingRecoveryCodes < 3,
  };
}

// ============ UTILITY FUNCTIONS ============

/**
 * Genera recovery codes nel formato XXXX-YYYY
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
 * Crea un audit log per azioni 2FA
 */
async function createAuditLog(
  partnerEmployeeId: string,
  action: TwoFactorAction,
  details?: Record<string, any>
): Promise<void> {
  await prisma.twoFactorAuditLog.create({
    data: {
      partnerEmployeeId,
      action,
      ipAddress: details?.ipAddress,
      userAgent: details?.userAgent,
      details: details ? JSON.parse(JSON.stringify(details)) : undefined,
    },
  });
}

export default {
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
