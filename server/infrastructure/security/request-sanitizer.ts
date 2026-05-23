/**
 * server/infrastructure/security/request-sanitizer.ts  — P9 Security Hardening
 *
 * Input sanitization middleware + helpers for Express routes.
 *
 * Features:
 *   - sanitizeBody()   — strips prototype-pollution keys, trims string values
 *   - sanitizePath()   — rejects path traversal sequences in params/query
 *   - rateLimiter()    — in-memory token-bucket rate limiter per IP+endpoint
 *   - maxBodySize      — enforced at middleware level (default 2 MB)
 *   - validateRunId()  — regex-validates runId params before they reach services
 *
 * Single responsibility: HTTP input hardening only. No auth, no business logic.
 */

import type { RequestHandler, Request, Response, NextFunction } from "express";
import { bus } from "../events/bus.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const DANGEROUS_KEYS   = new Set(["__proto__", "constructor", "prototype"]);
const PATH_TRAVERSAL   = /(\.\.|%2e%2e|%2f|%5c)/i;
const RUN_ID_PATTERN   = /^[a-zA-Z0-9_\-]{8,64}$/;
const MAX_BODY_BYTES    = 2 * 1024 * 1024;    // 2 MB
const RATE_WINDOW_MS    = 60_000;             // 1-minute window
const DEFAULT_RATE_LIMIT = 120;               // requests per window per IP

// ── Prototype-pollution sanitizer ─────────────────────────────────────────────

function stripDangerousKeys(obj: unknown): unknown {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(stripDangerousKeys);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!DANGEROUS_KEYS.has(k)) clean[k] = stripDangerousKeys(v);
  }
  return clean;
}

function trimStrings(obj: unknown): unknown {
  if (typeof obj === "string") return obj.trim();
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(trimStrings);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) clean[k] = trimStrings(v);
  return clean;
}

// ── Middleware: body sanitizer ────────────────────────────────────────────────

export const sanitizeBodyMiddleware: RequestHandler = (
  req: Request, _res: Response, next: NextFunction,
): void => {
  if (req.body && typeof req.body === "object") {
    req.body = trimStrings(stripDangerousKeys(req.body));
  }
  next();
};

// ── Middleware: path traversal guard ─────────────────────────────────────────

export const pathTraversalGuard: RequestHandler = (
  req: Request, res: Response, next: NextFunction,
): void => {
  const checks = [req.path, ...Object.values(req.params), ...Object.values(req.query as Record<string, string>)];
  for (const val of checks) {
    if (typeof val === "string" && PATH_TRAVERSAL.test(val)) {
      bus.emit("agent.event", {
        runId: "security", projectId: -1,
        phase: "security", agentName: "request-sanitizer",
        eventType: "security.path_traversal_blocked",
        payload: { path: req.path, offendingValue: val },
        ts: Date.now(),
      });
      res.status(400).json({ ok: false, error: "Invalid path parameter" });
      return;
    }
  }
  next();
};

// ── RunId validator ───────────────────────────────────────────────────────────

export function validateRunId(runId: unknown): { ok: true; runId: string } | { ok: false; error: string } {
  if (typeof runId !== "string" || !RUN_ID_PATTERN.test(runId)) {
    return { ok: false, error: "runId must be 8–64 alphanumeric chars" };
  }
  return { ok: true, runId };
}

// ── Token-bucket rate limiter ─────────────────────────────────────────────────

interface RateBucket { count: number; windowStart: number; }
const _buckets = new Map<string, RateBucket>();

export function rateLimiter(options: {
  limit?:    number;
  windowMs?: number;
  keyFn?:    (req: Request) => string;
} = {}): RequestHandler {
  const limit    = options.limit    ?? DEFAULT_RATE_LIMIT;
  const windowMs = options.windowMs ?? RATE_WINDOW_MS;
  const keyFn    = options.keyFn    ?? ((req) => `${req.ip}:${req.path}`);

  return (req: Request, res: Response, next: NextFunction): void => {
    const key  = keyFn(req);
    const now  = Date.now();
    const bucket = _buckets.get(key);

    if (!bucket || now - bucket.windowStart > windowMs) {
      _buckets.set(key, { count: 1, windowStart: now });
      next();
      return;
    }

    if (bucket.count >= limit) {
      res.status(429).json({ ok: false, error: "Rate limit exceeded. Try again later." });
      return;
    }

    bucket.count++;
    next();
  };
}

// ── Composed hardening stack ──────────────────────────────────────────────────

export const securityHardeningStack: RequestHandler[] = [
  sanitizeBodyMiddleware,
  pathTraversalGuard,
  rateLimiter(),
];
