import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../lib/tokens.js';
import { UnauthorizedError, AdminRequiredError, TokenExpiredError } from '../errors/index.js';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication middleware that requires a valid JWT token.
 * Attaches the decoded token payload to req.user.
 *
 * @throws UnauthorizedError if no token provided
 * @throws TokenExpiredError if token has expired
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('No token provided');
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      throw new TokenExpiredError();
    }
    throw new UnauthorizedError('Invalid token');
  }
}

/**
 * Middleware that requires the authenticated user to have admin role.
 * Must be used after requireAuth middleware.
 *
 * @throws AdminRequiredError if user is not an admin
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new UnauthorizedError('Not authenticated');
  }

  if (req.user.role !== 'admin') {
    throw new AdminRequiredError();
  }

  next();
}

/**
 * Optional authentication middleware.
 * If a valid token is provided, attaches user to request.
 * Does not throw errors if no token or invalid token.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyToken(token);
    req.user = payload;
  } catch {
    // Ignore invalid tokens in optional auth
  }

  next();
}
