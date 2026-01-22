import { BadRequestError } from '../errors/index.js';

/**
 * Parse an integer URL parameter with proper error handling.
 * MUST be used instead of direct parseInt() in all routes.
 *
 * @param value - The string value from req.params
 * @param paramName - The name of the parameter (for error messages)
 * @returns The parsed integer
 * @throws BadRequestError if value is not a valid positive integer
 *
 * @example
 * // In route handler:
 * const userId = parseIntParam(req.params.userId, 'userId');
 */
export function parseIntParam(value: string | undefined, paramName: string): number {
  if (value === undefined || value === null || value === '') {
    throw new BadRequestError(`Missing required parameter: ${paramName}`);
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new BadRequestError(`Invalid ${paramName}: must be a number`);
  }

  if (parsed < 1) {
    throw new BadRequestError(`Invalid ${paramName}: must be a positive integer`);
  }

  return parsed;
}

/**
 * Parse pagination query parameters with defaults.
 *
 * @param query - The req.query object
 * @returns Object with page and limit values
 *
 * @example
 * const { page, limit, offset } = parsePaginationParams(req.query);
 */
export function parsePaginationParams(query: Record<string, unknown>): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '20'), 10) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Parse an optional integer query parameter.
 * Returns undefined if not provided, throws if invalid.
 *
 * @param value - The string value from req.query
 * @param paramName - The name of the parameter (for error messages)
 * @returns The parsed integer or undefined
 */
export function parseOptionalIntParam(
  value: unknown,
  paramName: string
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = parseInt(String(value), 10);

  if (isNaN(parsed)) {
    throw new BadRequestError(`Invalid ${paramName}: must be a number`);
  }

  return parsed;
}
