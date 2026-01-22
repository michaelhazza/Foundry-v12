/**
 * Base application error class.
 * All custom errors extend this.
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request - Invalid input data
 */
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(400, 'BAD_REQUEST', message);
  }
}

/**
 * 400 Validation Error - Request body/params failed Zod validation
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(400, 'VALIDATION_ERROR', message);
  }
}

/**
 * 401 Unauthorized - Missing or invalid authentication
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

/**
 * 401 Token Expired - JWT token has expired
 */
export class TokenExpiredError extends AppError {
  constructor(message: string = 'Token expired') {
    super(401, 'TOKEN_EXPIRED', message);
  }
}

/**
 * 403 Forbidden - Authenticated but not authorized
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

/**
 * 403 Admin Required - Admin role required for action
 */
export class AdminRequiredError extends AppError {
  constructor(message: string = 'Admin role required') {
    super(403, 'ADMIN_REQUIRED', message);
  }
}

/**
 * 404 Not Found - Resource does not exist
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

/**
 * 409 Conflict - Resource already exists
 */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(409, 'CONFLICT', message);
  }
}

/**
 * 409 Already Member - User already member of organization
 */
export class AlreadyMemberError extends AppError {
  constructor(message: string = 'User is already a member of this organization') {
    super(409, 'ALREADY_MEMBER', message);
  }
}

/**
 * 410 Gone - Resource no longer available (e.g., used invitation)
 */
export class GoneError extends AppError {
  constructor(message: string = 'Resource no longer available') {
    super(410, 'GONE', message);
  }
}

/**
 * 410 Invitation Used - Invitation has already been used
 */
export class InvitationUsedError extends AppError {
  constructor(message: string = 'This invitation has already been used') {
    super(410, 'INVITATION_USED', message);
  }
}

/**
 * 410 Invitation Expired - Invitation has expired
 */
export class InvitationExpiredError extends AppError {
  constructor(message: string = 'This invitation has expired') {
    super(410, 'INVITATION_EXPIRED', message);
  }
}

/**
 * 410 Reset Token Expired - Password reset token expired
 */
export class ResetTokenExpiredError extends AppError {
  constructor(message: string = 'Password reset token has expired') {
    super(410, 'RESET_TOKEN_EXPIRED', message);
  }
}

/**
 * 413 Payload Too Large - File exceeds size limit
 */
export class FileTooLargeError extends AppError {
  constructor(message: string = 'File exceeds 100MB limit') {
    super(413, 'FILE_TOO_LARGE', message);
  }
}

/**
 * 415 Unsupported Media Type - File type not supported
 */
export class UnsupportedFileTypeError extends AppError {
  constructor(message: string = 'File type not supported') {
    super(415, 'UNSUPPORTED_FILE_TYPE', message);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests, please try again later') {
    super(429, 'RATE_LIMIT_EXCEEDED', message);
  }
}

/**
 * 409 Processing In Progress - Processing already running
 */
export class ProcessingInProgressError extends AppError {
  constructor(message: string = 'Processing is already in progress') {
    super(409, 'PROCESSING_IN_PROGRESS', message);
  }
}

/**
 * 500 Internal Server Error - Unexpected error
 */
export class InternalError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(500, 'INTERNAL_ERROR', message);
  }
}

/**
 * 501 Not Implemented - Feature not yet implemented
 */
export class NotImplementedError extends AppError {
  constructor(message: string = 'Feature not implemented') {
    super(501, 'NOT_IMPLEMENTED', message);
  }
}
