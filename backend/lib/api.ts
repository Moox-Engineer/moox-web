import { NextResponse } from 'next/server'
import { MiddlewareError } from './middleware'

/** Map middleware/validation errors to the same error envelope the middleware uses. */
export function apiError(e: unknown) {
  if (e instanceof MiddlewareError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, retryable: e.retryable, ...(e.details ? { details: e.details } : {}) } },
      { status: e.status },
    )
  }
  console.error('[api] unexpected:', e)
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'Unexpected error', retryable: true } }, { status: 500 })
}

export class ValidationError extends MiddlewareError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION', message, false, details)
  }
}
