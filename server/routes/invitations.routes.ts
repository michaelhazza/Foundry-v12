import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess, sendCreated } from '../lib/response.js';
import * as invitationService from '../services/invitation.service.js';

const router = Router();

// ============================================================================
// GET /api/invitations/:token
// Get invitation details (for registration page)
// ============================================================================

router.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    const invitation = await invitationService.getInvitationByToken(token);
    return sendSuccess(res, invitation);
  })
);

// ============================================================================
// POST /api/invitations/:token/accept
// Accept invitation (for existing users)
// ============================================================================

router.post(
  '/:token/accept',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    const result = await invitationService.acceptInvitation(
      token,
      req.user!.userId,
      req.user!.organisationId
    );
    return sendSuccess(res, result);
  })
);

export default router;
