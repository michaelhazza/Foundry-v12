import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  calculatePagination,
} from '../lib/response.js';
import { parseIntParam, parsePaginationParams } from '../lib/validation.js';
import * as processingService from '../services/processing.service.js';

const router = Router();

// All processing routes require authentication
router.use(requireAuth);

// ============================================================================
// GET /api/projects/:projectId/processing-config
// ============================================================================

router.get(
  '/projects/:projectId/processing-config',
  asyncHandler(async (req, res) => {
    const projectId = parseIntParam(req.params.projectId, 'projectId');
    const config = await processingService.getProcessingConfig(
      projectId,
      req.user!.organisationId
    );
    return sendSuccess(res, config);
  })
);

// ============================================================================
// PATCH /api/projects/:projectId/processing-config
// ============================================================================

const updateConfigSchema = z.object({
  stages: z
    .array(
      z.object({
        name: z.string(),
        enabled: z.boolean(),
        config: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
  filters: z.record(z.unknown()).optional(),
  roleIdentification: z.record(z.unknown()).optional(),
  exportFormat: z.enum(['jsonl', 'json', 'csv', 'qa_pairs']).optional(),
});

router.patch(
  '/projects/:projectId/processing-config',
  asyncHandler(async (req, res) => {
    const projectId = parseIntParam(req.params.projectId, 'projectId');
    const data = updateConfigSchema.parse(req.body);
    const config = await processingService.updateProcessingConfig(
      projectId,
      req.user!.organisationId,
      data
    );
    return sendSuccess(res, config);
  })
);

// ============================================================================
// GET /api/projects/:projectId/runs
// ============================================================================

router.get(
  '/projects/:projectId/runs',
  asyncHandler(async (req, res) => {
    const projectId = parseIntParam(req.params.projectId, 'projectId');
    const pagination = parsePaginationParams(req.query);
    const { runs, total } = await processingService.listProcessingRuns(
      projectId,
      req.user!.organisationId,
      pagination
    );
    return sendPaginated(
      res,
      runs,
      calculatePagination(pagination.page, pagination.limit, total)
    );
  })
);

// ============================================================================
// POST /api/projects/:projectId/runs
// ============================================================================

router.post(
  '/projects/:projectId/runs',
  asyncHandler(async (req, res) => {
    const projectId = parseIntParam(req.params.projectId, 'projectId');
    const run = await processingService.startProcessingRun(
      projectId,
      req.user!.organisationId
    );
    return sendCreated(res, run);
  })
);

// ============================================================================
// GET /api/runs/:runId
// ============================================================================

router.get(
  '/runs/:runId',
  asyncHandler(async (req, res) => {
    const runId = parseIntParam(req.params.runId, 'runId');
    const run = await processingService.getProcessingRun(
      runId,
      req.user!.organisationId
    );
    return sendSuccess(res, run);
  })
);

// ============================================================================
// POST /api/runs/:runId/cancel
// ============================================================================

router.post(
  '/runs/:runId/cancel',
  asyncHandler(async (req, res) => {
    const runId = parseIntParam(req.params.runId, 'runId');
    const run = await processingService.cancelProcessingRun(
      runId,
      req.user!.organisationId
    );
    return sendSuccess(res, run);
  })
);

// ============================================================================
// GET /api/runs/:runId/filtered-records
// ============================================================================

router.get(
  '/runs/:runId/filtered-records',
  asyncHandler(async (req, res) => {
    const runId = parseIntParam(req.params.runId, 'runId');
    const pagination = parsePaginationParams(req.query);
    const { records, total } = await processingService.getFilteredRecords(
      runId,
      req.user!.organisationId,
      pagination
    );
    return sendPaginated(
      res,
      records,
      calculatePagination(pagination.page, pagination.limit, total)
    );
  })
);

export default router;
