import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess, sendCreated, sendPaginated, sendNoContent, calculatePagination } from '../lib/response.js';
import { parseIntParam, parsePaginationParams } from '../lib/validation.js';
import * as projectService from '../services/project.service.js';

const router = Router();

// All project routes require authentication
router.use(requireAuth);

// ============================================================================
// GET /api/projects
// ============================================================================

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const pagination = parsePaginationParams(req.query);
    const { projects, total } = await projectService.listProjects(
      req.user!.organisationId,
      pagination
    );
    return sendPaginated(
      res,
      projects,
      calculatePagination(pagination.page, pagination.limit, total)
    );
  })
);

// ============================================================================
// POST /api/projects
// ============================================================================

const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createProjectSchema.parse(req.body);
    const project = await projectService.createProject(
      req.user!.organisationId,
      data
    );
    return sendCreated(res, project);
  })
);

// ============================================================================
// GET /api/projects/:projectId
// ============================================================================

router.get(
  '/:projectId',
  asyncHandler(async (req, res) => {
    const projectId = parseIntParam(req.params.projectId, 'projectId');
    const project = await projectService.getProject(
      projectId,
      req.user!.organisationId
    );
    return sendSuccess(res, project);
  })
);

// ============================================================================
// PATCH /api/projects/:projectId
// ============================================================================

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

router.patch(
  '/:projectId',
  asyncHandler(async (req, res) => {
    const projectId = parseIntParam(req.params.projectId, 'projectId');
    const data = updateProjectSchema.parse(req.body);
    const project = await projectService.updateProject(
      projectId,
      req.user!.organisationId,
      data
    );
    return sendSuccess(res, project);
  })
);

// ============================================================================
// DELETE /api/projects/:projectId
// ============================================================================

router.delete(
  '/:projectId',
  asyncHandler(async (req, res) => {
    const projectId = parseIntParam(req.params.projectId, 'projectId');
    await projectService.deleteProject(projectId, req.user!.organisationId);
    return sendNoContent(res);
  })
);

export default router;
