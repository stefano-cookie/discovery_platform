import crypto from 'crypto';

/**
 * Encryption Service per TOTP Secrets
 *
 * Utilizza AES-256-GCM per encryption/decryption sicuro dei secret 2FA
 *
 * Formato encrypted string: encrypted:iv:authTag
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT = 'discovery-2fa-salt-v1'; // Salt fisso per derivazione chiave

/**
 * Deriva una chiave da ENCRYPTION_KEY usando scrypt
 */
function deriveKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY non configurato in .env');
  }

  // Deriva chiave a 32 bytes usando scrypt
  return crypto.scryptSync(encryptionKey, SALT, KEY_LENGTH);
}

/**
 * Cripta un TOTP secret usando AES-256-GCM
 *
 * @param plaintext - Secret TOTP in chiaro (base32)
 * @returns Stringa encrypted nel formato: encrypted:iv:authTag
 */
export function encryptSecret(plaintext: string): string {
  try {
    const key = deriveKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Formato: encrypted:iv:authTag
    return `${encrypted}:${iv.toString('hex')}:${authTag.toString('hex')}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Errore durante encryption del secret');
  }
}

/**
 * Decripta un TOTP secret usando AES-256-GCM
 *
 * @param encryptedString - Stringa encrypted nel formato: encrypted:iv:authTag
 * @returns Secret TOTP in chiaro (base32)
 */
export function decryptSecret(encryptedString: string): string {
  try {
    const parts = encryptedString.split(':');

    if (parts.length !== 3) {
      throw new Error('Formato encrypted string non valido');
    }

    const [encrypted, ivHex, authTagHex] = parts;

    const key = deriveKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Errore durante decryption del secret');
  }
}

/**
 * Verifica che ENCRYPTION_KEY sia configurato correttamente
 *
 * @throws Error se ENCRYPTION_KEY non è configurato
 */
export function validateEncryptionKey(): void {
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY non configurato. ' +
      'Genera una chiave con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY deve essere almeno 32 caratteri');
  }
}
