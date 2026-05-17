/**
 * server/approvals/diff-session.store.ts
 *
 * In-memory store for pending approval sessions.
 * Each session is a Promise that resolves true (approved) or false (rejected).
 *
 * The diffQueue DB table handles persistence/audit separately.
 * This store handles the live async-wait gate.
 */

import type { ApprovalStatus, PendingApproval } from "./diff.types.ts";

interface Session {
  approval:  PendingApproval;
  resolve:   (approved: boolean) => void;
  timer:     ReturnType<typeof setTimeout>;
}

/** TTL for pending approvals: 10 minutes */
export const APPROVAL_TTL_MS = 10 * 60 * 1000;

const sessions = new Map<string, Session>();

// ── Create ────────────────────────────────────────────────────────────────────

export function createSession(
  approval: PendingApproval,
  onTimeout: (sessionId: string) => void,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      const s = sessions.get(approval.sessionId);
      if (s && s.approval.status === "pending") {
        s.approval.status = "expired";
        sessions.delete(approval.sessionId);
        onTimeout(approval.sessionId);
        resolve(false);
      }
    }, APPROVAL_TTL_MS);

    sessions.set(approval.sessionId, {
      approval,
      resolve,
      timer,
    });
  });
}

// ── Resolve ───────────────────────────────────────────────────────────────────

export function resolveSession(
  sessionId: string,
  approved: boolean,
): "ok" | "not_found" | "already_resolved" {
  const s = sessions.get(sessionId);
  if (!s) return "not_found";
  if (s.approval.status !== "pending") return "already_resolved";

  clearTimeout(s.timer);
  s.approval.status = approved ? "approved" : "rejected";
  sessions.delete(sessionId);
  s.resolve(approved);
  return "ok";
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getSession(sessionId: string): PendingApproval | null {
  return sessions.get(sessionId)?.approval ?? null;
}

export function getPendingForProject(projectId: number): PendingApproval[] {
  return [...sessions.values()]
    .filter(s => s.approval.projectId === projectId && s.approval.status === "pending")
    .map(s => s.approval);
}

export function getAllPending(): PendingApproval[] {
  return [...sessions.values()]
    .filter(s => s.approval.status === "pending")
    .map(s => s.approval);
}

/** Periodic GC — clears any stale sessions (safety net, timer should handle it) */
export function gcSessions(): number {
  const now = Date.now();
  let removed = 0;
  for (const [id, s] of sessions.entries()) {
    if (now > s.approval.expiresAt) {
      clearTimeout(s.timer);
      sessions.delete(id);
      removed++;
    }
  }
  return removed;
}
