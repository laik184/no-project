/**
 * server/infrastructure/observability/correlation-id.ts  — P8 Observability Hardening
 *
 * Injects correlation IDs into every request/event for end-to-end trace linking.
 *
 * Features:
 *   - generateCorrelationId() — unique 128-bit hex string per operation
 *   - Express middleware: attaches X-Correlation-ID header to every response
 *   - AsyncLocalStorage context: correlationId propagates through async call chains
 *   - withCorrelation(id, fn) — run any async function with a bound correlation ID
 *   - currentCorrelationId()  — read the current correlation ID from context
 *
 * Single responsibility: correlation ID propagation only.
 */

import { AsyncLocalStorage }                         from "async_hooks";
import type { RequestHandler, Request, Response, NextFunction } from "express";
import crypto                                        from "crypto";

// ── Storage ───────────────────────────────────────────────────────────────────

const storage = new AsyncLocalStorage<string>();

// ── Generators ────────────────────────────────────────────────────────────────

export function generateCorrelationId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function currentCorrelationId(): string | undefined {
  return storage.getStore();
}

// ── Context runner ────────────────────────────────────────────────────────────

export function withCorrelation<T>(id: string, fn: () => Promise<T>): Promise<T> {
  return storage.run(id, fn);
}

// ── Express middleware ────────────────────────────────────────────────────────

export const correlationMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const id =
    (req.headers["x-correlation-id"] as string | undefined) ??
    (req.headers["x-request-id"]    as string | undefined) ??
    generateCorrelationId();

  res.setHeader("x-correlation-id", id);

  storage.run(id, () => next());
};

// ── Enrichment helper ────────────────────────────────────────────────────────

export function enrichWithCorrelation<T extends Record<string, unknown>>(payload: T): T & { correlationId: string | undefined } {
  return { ...payload, correlationId: currentCorrelationId() };
}
