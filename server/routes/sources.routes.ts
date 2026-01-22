import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rate-limit.js';
import {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendNoContent,
  sendAccepted,
  calculatePagination,
} from '../lib/response.js';
import { parseIntParam, parsePaginationParams } from '../lib/validation.js';
import * as sourceService from '../services/source.service.js';
import * as schemaMappingService from '../services/schema-mapping.service.js';
import * as deidentificationService from '../services/deidentification.service.js';
import { config } from '../config.js';
import { FileTooLargeError, UnsupportedFileTypeError } from '../errors/index.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (config.allowedFileTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new UnsupportedFileTypeError());
    }
  },
});

// All source routes require authentication
router.use(requireAuth);

// ============================================================================
// GET /api/projects/:projectId/sources
// ============================================================================

router.get(
  '/projects/:projectId/sources',
  asyncHandler(async (req, res) => {
    const projectId = parseIntParam(req.params.projectId, 'projectId');
    const pagination = parsePaginationParams(req.query);
    const { sources, total } = await sourceService.listSources(
      projectId,
      req.user!.organisationId,
      pagination
    );
    return sendPaginated(
      res,
      sources,
      calculatePagination(pagination.page, pagination.limit, total)
    );
  })
);

// ============================================================================
// POST /api/projects/:projectId/sources
// ============================================================================

const createSourceSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['file', 'teamwork_desk']),
  apiKey: z.string().optional(),
  apiSubdomain: z.string().optional(),
  dataTypes: z.array(z.string()).optional(),
});

router.post(
  '/projects/:projectId/sources',
  asyncHandler(async (req, res) => {
    const projectId = parseIntParam(req.params.projectId, 'projectId');
    const data = createSourceSchema.parse(req.body);
    const source = await sourceService.createSource(
      projectId,
      req.user!.organisationId,
      data
    );
    return sendCreated(res, source);
  })
);

// ============================================================================
// GET /api/sources/:sourceId
// ============================================================================

router.get(
  '/:sourceId',
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');
    const source = await sourceService.getSource(sourceId, req.user!.organisationId);
    return sendSuccess(res, source);
  })
);

// ============================================================================
// PATCH /api/sources/:sourceId
// ============================================================================

const updateSourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  apiKey: z.string().optional(),
  apiSubdomain: z.string().optional(),
  dataTypes: z.array(z.string()).optional(),
});

router.patch(
  '/:sourceId',
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');
    const data = updateSourceSchema.parse(req.body);
    const source = await sourceService.updateSource(
      sourceId,
      req.user!.organisationId,
      data
    );
    return sendSuccess(res, source);
  })
);

// ============================================================================
// DELETE /api/sources/:sourceId
// ============================================================================

router.delete(
  '/:sourceId',
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');
    await sourceService.deleteSource(sourceId, req.user!.organisationId);
    return sendNoContent(res);
  })
);

// ============================================================================
// POST /api/sources/:sourceId/sync
// ============================================================================

router.post(
  '/:sourceId/sync',
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');
    const result = await sourceService.syncSource(sourceId, req.user!.organisationId);
    return sendAccepted(res, result);
  })
);

// ============================================================================
// POST /api/sources/:sourceId/upload
// ============================================================================

router.post(
  '/:sourceId/upload',
  uploadLimiter,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');

    if (!req.file) {
      throw new UnsupportedFileTypeError('No file uploaded');
    }

    const source = await sourceService.uploadFile(
      sourceId,
      req.user!.organisationId,
      req.file
    );
    return sendSuccess(res, source);
  })
);

// ============================================================================
// GET /api/sources/:sourceId/schema-mapping
// ============================================================================

router.get(
  '/:sourceId/schema-mapping',
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');
    const mapping = await schemaMappingService.getSchemaMapping(
      sourceId,
      req.user!.organisationId
    );
    return sendSuccess(res, mapping);
  })
);

// ============================================================================
// PATCH /api/sources/:sourceId/schema-mapping
// ============================================================================

const updateSchemaMappingSchema = z.object({
  mappings: z.array(z.object({
    sourceField: z.string(),
    targetField: z.string().nullable(),
    confidence: z.enum(['high', 'medium', 'low', 'manual']).optional(),
    transform: z.string().optional(),
  })).optional(),
  targetSchema: z.enum(['conversation', 'qa_pairs', 'raw']).optional(),
});

router.patch(
  '/:sourceId/schema-mapping',
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');
    const data = updateSchemaMappingSchema.parse(req.body);
    const mapping = await schemaMappingService.updateSchemaMapping(
      sourceId,
      req.user!.organisationId,
      data
    );
    return sendSuccess(res, mapping);
  })
);

// ============================================================================
// GET /api/sources/:sourceId/schema-mapping/preview
// ============================================================================

router.get(
  '/:sourceId/schema-mapping/preview',
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');
    const preview = await schemaMappingService.previewSchemaMapping(
      sourceId,
      req.user!.organisationId
    );
    return sendSuccess(res, preview);
  })
);

// ============================================================================
// GET /api/sources/:sourceId/deidentification
// ============================================================================

router.get(
  '/:sourceId/deidentification',
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');
    const config = await deidentificationService.getDeidentificationConfig(
      sourceId,
      req.user!.organisationId
    );
    return sendSuccess(res, config);
  })
);

// ============================================================================
// PATCH /api/sources/:sourceId/deidentification
// ============================================================================

const updateDeidentificationSchema = z.object({
  enabledTypes: z.array(z.enum(['email', 'phone', 'name', 'address', 'ssn', 'credit_card', 'dob'])).optional(),
  customPatterns: z.array(z.object({
    name: z.string(),
    pattern: z.string(),
    replacement: z.string(),
  })).optional(),
  maskingStrategy: z.enum(['replacement', 'redaction', 'pseudonymization']).optional(),
});

router.patch(
  '/:sourceId/deidentification',
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');
    const data = updateDeidentificationSchema.parse(req.body);
    const config = await deidentificationService.updateDeidentificationConfig(
      sourceId,
      req.user!.organisationId,
      data
    );
    return sendSuccess(res, config);
  })
);

// ============================================================================
// GET /api/sources/:sourceId/deidentification/preview
// ============================================================================

router.get(
  '/:sourceId/deidentification/preview',
  asyncHandler(async (req, res) => {
    const sourceId = parseIntParam(req.params.sourceId, 'sourceId');
    const preview = await deidentificationService.previewDeidentification(
      sourceId,
      req.user!.organisationId
    );
    return sendSuccess(res, preview);
  })
);

export default router;
