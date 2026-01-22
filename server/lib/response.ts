import { Response } from 'express';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Send a successful response with data.
 * Per Constitution Section C: Success Envelope format.
 *
 * @example
 * return sendSuccess(res, user);
 * // Returns: { data: user, meta: { timestamp: "..." } }
 */
export function sendSuccess<T>(res: Response, data: T): Response {
  return res.json({
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a created response (201) with data.
 *
 * @example
 * return sendCreated(res, newProject);
 */
export function sendCreated<T>(res: Response, data: T): Response {
  return res.status(201).json({
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a paginated response with data array.
 * Per Constitution Section C: Paginated Envelope format.
 *
 * @example
 * return sendPaginated(res, projects, { page: 1, limit: 20, total: 150, totalPages: 8, hasMore: true });
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta
): Response {
  return res.json({
    data,
    pagination,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Send a no-content response (204).
 * Used for DELETE operations.
 *
 * @example
 * return sendNoContent(res);
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}

/**
 * Send an accepted response (202) for async operations.
 *
 * @example
 * return sendAccepted(res, { status: 'processing', runId: 123 });
 */
export function sendAccepted<T>(res: Response, data: T): Response {
  return res.status(202).json({
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Calculate pagination metadata from total count.
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}
