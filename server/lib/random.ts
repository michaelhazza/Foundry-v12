import { randomBytes, randomUUID } from 'crypto';

/**
 * Cryptographically secure random value generators.
 * NEVER use Math.random() in server code.
 */
export const random = {
  /**
   * Generate a secure random token (64 hex characters).
   * Use for: API tokens, secrets, password reset tokens.
   */
  token: (): string => randomBytes(32).toString('hex'),

  /**
   * Generate a UUID v4.
   * Use for: Resource identifiers, invitation tokens.
   */
  uuid: (): string => randomUUID(),

  /**
   * Generate a shorter random state (32 hex characters).
   * Use for: OAuth state parameters, CSRF tokens.
   */
  state: (): string => randomBytes(16).toString('hex'),

  /**
   * Generate a temporary password.
   * Use for: One-time passwords, temporary credentials.
   */
  password: (): string => randomBytes(12).toString('base64url'),
};
