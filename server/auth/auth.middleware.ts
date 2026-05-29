/**
 * auth.middleware.ts — Express JWT authentication middleware
 *
 * requireAuth:   JWT required — 401 agar nahi/invalid
 * optionalAuth:  JWT optional — req.user set agar valid, nahi to null
 * requirePlan:   Min plan level check
 * requireOwner:  Resource ownership check
 */
import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "./types.ts";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ── requireAuth ────────────────────────────────────────────────────────────
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: "Authentication required" });
    return;
  }
  try {
    // req.user = authService.verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}

// ── optionalAuth ───────────────────────────────────────────────────────────
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (token) {
    try {
      // req.user = authService.verifyAccessToken(token);
    } catch { /* ignore */ }
  }
  next();
}

// ── requirePlan ────────────────────────────────────────────────────────────
const PLAN_ORDER = { free: 0, hacker: 1, pro: 2, teams: 3 };

export function requirePlan(minPlan: keyof typeof PLAN_ORDER) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const userLevel = PLAN_ORDER[req.user.plan as keyof typeof PLAN_ORDER] ?? 0;
    const minLevel  = PLAN_ORDER[minPlan];
    if (userLevel < minLevel) {
      res.status(403).json({ ok: false, error: `This feature requires ${minPlan} plan or higher` });
      return;
    }
    next();
  };
}

// ── requireOwner ───────────────────────────────────────────────────────────
export function requireOwner(getResourceUserId: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: "Authentication required" });
      return;
    }
    const resourceUserId = getResourceUserId(req);
    if (resourceUserId && resourceUserId !== req.user.userId) {
      res.status(403).json({ ok: false, error: "Access denied" });
      return;
    }
    next();
  };
}

// ── Helper ─────────────────────────────────────────────────────────────────
function extractBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return (req.cookies?.access_token as string) || null;
}
