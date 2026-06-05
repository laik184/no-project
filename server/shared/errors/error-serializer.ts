/**
 * server/shared/errors/error-serializer.ts
 *
 * Converts any thrown value into a structured, user-safe error payload.
 * This is the single translation layer between internal exceptions and API responses.
 *
 * Rules:
 *  - Never expose raw stack traces to API consumers.
 *  - Always include a recoverySuggestion when possible.
 *  - Log the full technical detail internally.
 */

import { BaseAppError }  from './base-app-error.ts';
import { ErrorFactory }  from './error-factory.ts';
import type { AppErrorFields } from './base-app-error.ts';

export interface UserFacingError {
  errorId:             string;
  type:                string;
  title:               string;
  message:             string;
  recoverySuggestion?: string;
  severity:            string;
  timestamp:           string;
}

/**
 * Serialises any thrown value into an AppErrorFields object.
 * The `technicalReason` field contains internal detail — strip it before
 * sending to the client unless you are in a trusted admin context.
 */
export function serialize(err: unknown): AppErrorFields {
  const appErr = ErrorFactory.wrap(err);
  return appErr.toJSON();
}

/**
 * Returns a user-safe subset — no internal stack traces or technical reasons.
 */
export function toUserFacingError(err: unknown): UserFacingError {
  const full = serialize(err);
  return {
    errorId:             full.errorId,
    type:                full.type,
    title:               full.title,
    message:             full.message,
    recoverySuggestion:  full.recoverySuggestion,
    severity:            full.severity,
    timestamp:           full.timestamp,
  };
}

/**
 * Builds an Express-compatible JSON error response body.
 * Use this in catch blocks inside controllers and route handlers.
 */
export function toApiErrorBody(err: unknown): { ok: false; error: UserFacingError } {
  return { ok: false, error: toUserFacingError(err) };
}

/**
 * Maps a BaseAppError severity to an HTTP status code.
 */
export function toHttpStatus(err: unknown): number {
  if (!(err instanceof BaseAppError)) return 500;
  switch (err.type) {
    case 'ValidationError':     return 400;
    case 'AuthenticationError': return 401;
    case 'AuthorizationError':  return 403;
    case 'ToolNotFoundError':   return 404;
    case 'TimeoutError':        return 408;
    default:                    return 500;
  }
}

/**
 * Logs an error to stderr with its errorId and structured fields.
 * Always call this before sending a response so there is a server-side trace.
 */
export function logError(err: unknown, context?: string): void {
  const full = serialize(err);
  const prefix = context ? `[${context}]` : '[error]';
  console.error(
    `${prefix} ${full.type} (${full.errorId}): ${full.technicalReason ?? full.message}`,
    full.context ?? '',
  );
}
