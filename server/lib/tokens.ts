import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';
const JWT_EXPIRY = '24h';

export interface TokenPayload {
  userId: number;
  organisationId: number;
  role: string;
}

/**
 * Generate a JWT access token.
 *
 * @param payload - The token payload
 * @returns The signed JWT token
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Verify and decode a JWT token.
 *
 * @param token - The JWT token to verify
 * @returns The decoded payload
 * @throws JsonWebTokenError if invalid, TokenExpiredError if expired
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
