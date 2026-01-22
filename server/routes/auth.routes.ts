import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rate-limit.js';
import { sendSuccess, sendCreated, sendNoContent } from '../lib/response.js';
import * as authService from '../services/auth.service.js';
import * as emailService from '../services/email.service.js';

const router = Router();

// Password validation: min 8 chars, 1 uppercase, 1 digit
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

// ============================================================================
// POST /api/auth/register
// ============================================================================

const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1),
  inviteToken: z.string().optional(),
});

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    return sendCreated(res, result);
  })
);

// ============================================================================
// POST /api/auth/login
// ============================================================================

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);
    return sendSuccess(res, result);
  })
);

// ============================================================================
// POST /api/auth/logout
// ============================================================================

router.post(
  '/logout',
  requireAuth,
  asyncHandler(async (_req, res) => {
    // JWT is stateless - client handles token deletion
    return sendNoContent(res);
  })
);

// ============================================================================
// GET /api/auth/me
// ============================================================================

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await authService.getCurrentUser(req.user!.userId);
    return sendSuccess(res, user);
  })
);

// ============================================================================
// PATCH /api/auth/profile
// ============================================================================

const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  currentPassword: z.string().optional(),
  newPassword: passwordSchema.optional(),
});

router.patch(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = profileUpdateSchema.parse(req.body);
    const result = await authService.updateProfile(req.user!.userId, data);
    return sendSuccess(res, result);
  })
);

// ============================================================================
// POST /api/auth/forgot-password
// ============================================================================

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const result = await authService.requestPasswordReset(email);

    // Send email if token was created
    if ('token' in result && result.email) {
      await emailService.sendPasswordResetEmail(result.email, result.token);
    }

    return sendSuccess(res, {
      message: 'If the email exists, a reset link will be sent',
    });
  })
);

// ============================================================================
// GET /api/auth/reset-password/:token
// ============================================================================

router.get(
  '/reset-password/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    const result = await authService.validateResetToken(token);
    return sendSuccess(res, result);
  })
);

// ============================================================================
// POST /api/auth/reset-password
// ============================================================================

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword(token, newPassword);
    return sendSuccess(res, result);
  })
);

export default router;
