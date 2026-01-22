import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { sendSuccess, sendPaginated, calculatePagination, sendNoContent } from '../lib/response.js';
import { parseIntParam, parsePaginationParams } from '../lib/validation.js';
import * as organisationService from '../services/organisation.service.js';
import * as invitationService from '../services/invitation.service.js';

const router = Router();

// All organisation routes require authentication
router.use(requireAuth);

// ============================================================================
// GET /api/organisations/:organisationId
// ============================================================================

router.get(
  '/:organisationId',
  asyncHandler(async (req, res) => {
    const organisationId = parseIntParam(req.params.organisationId, 'organisationId');
    const org = await organisationService.getOrganization(
      organisationId,
      req.user!.organisationId
    );
    return sendSuccess(res, org);
  })
);

// ============================================================================
// PATCH /api/organisations/:organisationId
// ============================================================================

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
});

router.patch(
  '/:organisationId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const organisationId = parseIntParam(req.params.organisationId, 'organisationId');
    const data = updateOrgSchema.parse(req.body);
    const org = await organisationService.updateOrganization(
      organisationId,
      req.user!.organisationId,
      data
    );
    return sendSuccess(res, org);
  })
);

// ============================================================================
// GET /api/organisations/:organisationId/members
// ============================================================================

router.get(
  '/:organisationId/members',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const organisationId = parseIntParam(req.params.organisationId, 'organisationId');
    const pagination = parsePaginationParams(req.query);
    const { members, total } = await organisationService.getOrganizationMembers(
      organisationId,
      req.user!.organisationId,
      pagination
    );
    return sendPaginated(
      res,
      members,
      calculatePagination(pagination.page, pagination.limit, total)
    );
  })
);

// ============================================================================
// PATCH /api/organisations/:organisationId/members/:userId
// ============================================================================

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member']),
});

router.patch(
  '/:organisationId/members/:userId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const organisationId = parseIntParam(req.params.organisationId, 'organisationId');
    const userId = parseIntParam(req.params.userId, 'userId');
    const { role } = updateMemberSchema.parse(req.body);
    const member = await organisationService.updateMemberRole(
      organisationId,
      req.user!.organisationId,
      userId,
      role
    );
    return sendSuccess(res, member);
  })
);

// ============================================================================
// GET /api/organisations/:organisationId/invitations
// ============================================================================

router.get(
  '/:organisationId/invitations',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const organisationId = parseIntParam(req.params.organisationId, 'organisationId');
    const pagination = parsePaginationParams(req.query);
    const { invitations, total } = await invitationService.listInvitations(
      organisationId,
      req.user!.organisationId,
      pagination
    );
    return sendPaginated(
      res,
      invitations,
      calculatePagination(pagination.page, pagination.limit, total)
    );
  })
);

// ============================================================================
// POST /api/organisations/:organisationId/invitations
// ============================================================================

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).optional(),
});

router.post(
  '/:organisationId/invitations',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const organisationId = parseIntParam(req.params.organisationId, 'organisationId');
    const data = createInvitationSchema.parse(req.body);

    // Get inviter name for email
    const user = await import('../db/index.js').then((m) =>
      m.db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, req.user!.userId),
      })
    );

    const invitation = await invitationService.createInvitation(
      organisationId,
      req.user!.userId,
      req.user!.organisationId,
      user?.name || 'A team member',
      data
    );
    return sendSuccess(res, invitation);
  })
);

// ============================================================================
// DELETE /api/organisations/:organisationId/invitations/:invitationId
// ============================================================================

router.delete(
  '/:organisationId/invitations/:invitationId',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const organisationId = parseIntParam(req.params.organisationId, 'organisationId');
    const invitationId = parseIntParam(req.params.invitationId, 'invitationId');
    await invitationService.deleteInvitation(
      organisationId,
      invitationId,
      req.user!.organisationId
    );
    return sendNoContent(res);
  })
);

export default router;
