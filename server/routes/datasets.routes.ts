import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess, sendPaginated, calculatePagination } from '../lib/response.js';
import { parseIntParam, parsePaginationParams } from '../lib/validation.js';
import * as datasetService from '../services/dataset.service.js';

const router = Router();

// All dataset routes require authentication
router.use(requireAuth);

// ============================================================================
// GET /api/projects/:projectId/datasets
// ============================================================================

router.get(
  '/projects/:projectId/datasets',
  asyncHandler(async (req, res) => {
    const projectId = parseIntParam(req.params.projectId, 'projectId');
    const pagination = parsePaginationParams(req.query);
    const { datasets, total } = await datasetService.listDatasets(
      projectId,
      req.user!.organisationId,
      pagination
    );
    return sendPaginated(
      res,
      datasets,
      calculatePagination(pagination.page, pagination.limit, total)
    );
  })
);

// ============================================================================
// GET /api/datasets/:datasetId
// ============================================================================

router.get(
  '/:datasetId',
  asyncHandler(async (req, res) => {
    const datasetId = parseIntParam(req.params.datasetId, 'datasetId');
    const dataset = await datasetService.getDataset(
      datasetId,
      req.user!.organisationId
    );
    return sendSuccess(res, dataset);
  })
);

// ============================================================================
// GET /api/datasets/:datasetId/preview
// ============================================================================

router.get(
  '/:datasetId/preview',
  asyncHandler(async (req, res) => {
    const datasetId = parseIntParam(req.params.datasetId, 'datasetId');
    const preview = await datasetService.previewDataset(
      datasetId,
      req.user!.organisationId
    );
    return sendSuccess(res, preview);
  })
);

// ============================================================================
// GET /api/datasets/:datasetId/export
// ============================================================================

router.get(
  '/:datasetId/export',
  asyncHandler(async (req, res) => {
    const datasetId = parseIntParam(req.params.datasetId, 'datasetId');
    const format = req.query.format as string | undefined;

    const { content, contentType, filename } = await datasetService.exportDataset(
      datasetId,
      req.user!.organisationId,
      format
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(content);
  })
);

export default router;
