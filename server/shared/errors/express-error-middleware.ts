/**
 * server/shared/errors/express-error-middleware.ts
 *
 * Express error-handling middleware (4-arg signature).
 * Mount this LAST in main.ts so it catches all unhandled route errors.
 */

import type { Request, Response, NextFunction } from 'express';
import { toApiErrorBody, toHttpStatus, logError } from './error-serializer.ts';

export function expressErrorMiddleware(
  err:  unknown,
  req:  Request,
  res:  Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  logError(err, `${req.method} ${req.path}`);
  const status = toHttpStatus(err);
  res.status(status).json(toApiErrorBody(err));
}
