// src/lib/errors.ts — consistent error envelope (requirements  + ).
// Every API response on error is { error: "CODE", message: "..." }.

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_FUNDS'
  | 'BAD_REQUEST'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const Errors = {
  validation: (details?: unknown) =>
    new ApiError('VALIDATION_ERROR', 'Request validation failed', 400, details),
  unauthorized: (msg = 'Unauthorized') => new ApiError('UNAUTHORIZED', msg, 401),
  forbidden: (msg = 'Forbidden') => new ApiError('FORBIDDEN', msg, 403),
  notFound: (msg = 'Not found') => new ApiError('NOT_FOUND', msg, 404),
  conflict: (msg = 'Conflict') => new ApiError('CONFLICT', msg, 409),
  insufficientFunds: () => new ApiError('INSUFFICIENT_FUNDS', 'Insufficient funds', 422),
  badRequest: (msg = 'Bad request') => new ApiError('BAD_REQUEST', msg, 400),
  rateLimited: () => new ApiError('RATE_LIMITED', 'Too many requests', 429),
  serviceUnavailable: (msg = 'Service unavailable') => new ApiError('SERVICE_UNAVAILABLE', msg, 503),
  internal: (msg = 'Internal server error') => new ApiError('INTERNAL_ERROR', msg, 500),
}

/** Map an ApiError (or any thrown value) to a JSON-serialisable response body + status. */
export function toErrorResponse(err: unknown): { status: number; body: { error: ErrorCode | 'INTERNAL_ERROR'; message: string; details?: unknown } } {
  if (err instanceof ApiError) {
    return { status: err.status, body: { error: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } }
  }
  // Prisma unique-constraint violation → 409 CONFLICT
  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
    return { status: 409, body: { error: 'CONFLICT', message: 'Resource already exists' } }
  }
  return { status: 500, body: { error: 'INTERNAL_ERROR', message: 'Internal server error' } }
}
