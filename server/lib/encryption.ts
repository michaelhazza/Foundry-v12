import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Get encryption key from environment.
 * Throws if not configured.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is required for storing sensitive data');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt sensitive data (API keys, OAuth tokens, etc.).
 * Uses AES-256-GCM for authenticated encryption.
 *
 * @param plaintext - The data to encrypt
 * @returns Encrypted string in format: iv:encrypted:authTag (all hex-encoded)
 *
 * @example
 * const encryptedToken = encrypt(oauthAccessToken);
 * await db.insert(integrations).values({ accessToken: encryptedToken });
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt sensitive data.
 *
 * @param ciphertext - Encrypted string in format: iv:encrypted:authTag
 * @returns Decrypted plaintext
 *
 * @example
 * const integration = await db.query.integrations.findFirst(...);
 * const decryptedToken = decrypt(integration.accessToken);
 */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, encrypted, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Check if encryption is properly configured.
 * Use at startup to fail fast if encryption is needed but not configured.
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length === 64;
}
