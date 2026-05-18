/**
 * server/approvals/diff-approval.service.ts
 *
 * Main orchestrator for the diff approval lifecycle:
 *  1. Request approval (generate diff → persist → emit SSE event → async wait)
 *  2. Approve / Reject (resolve pending session → apply or discard write)
 *
 * Design:
 *  - Tool calls requestApproval() and gets back a Promise<ApprovalOutcome>
 *  - Tool returns {ok:true, pending:true} immediately to the agent
 *  - Approval/rejection resolves the stored Promise
 *  - If approved, caller is responsible for writing the file
 */

import fs            from "fs/promises";
import path          from "path";
import crypto        from "crypto";
import { db }        from "../infrastructure/db/index.ts";
import { diffQueue } from "../../shared/schema.ts";
import { eq }        from "drizzle-orm";
import { bus }       from "../infrastructure/events/bus.ts";
import { emitFileChange } from "../infrastructure/events/file-change-emitter.ts";
import { getProjectDir }  from "../infrastructure/sandbox/sandbox.util.ts";
import { atomicWrite }    from "../infrastructure/checkpoints/atomic-write.util.ts";
import { versionStore }   from "../collaboration/version-store.ts";
import { generateUnifiedDiff, diffStats } from "./diff-generator.ts";
import {
  createSession, resolveSession,
  getPendingForProject, getAllPending,
  APPROVAL_TTL_MS,
} from "./diff-session.store.ts";
import type { ApprovalRequest, ApprovalOutcome, PendingApproval } from "./diff.types.ts";

/** Set DISABLE_DIFF_APPROVAL=true to bypass the gate (CI/testing) */
export function isApprovalEnabled(): boolean {
  return process.env.DISABLE_DIFF_APPROVAL !== "true";
}

// ── Request approval ──────────────────────────────────────────────────────────

/**
 * Create a pending approval for a file write.
 * Returns the sessionId immediately for the tool result.
 * The actual write resolution (apply/reject) happens via the approval REST API.
 */
export async function requestApproval(req: ApprovalRequest): Promise<{
  sessionId: string;
  diffId: number;
  additions: number;
  deletions: number;
}> {
  const sessionId    = crypto.randomUUID();
  const now          = Date.now();
  const unifiedDiff  = generateUnifiedDiff(req.oldContent, req.newContent, req.filePath);
  const stats        = diffStats(unifiedDiff);

  // Persist to DB for audit trail (best-effort — don't fail if DB is down)
  let diffId = -1;
  try {
    const [row] = await db.insert(diffQueue).values({
      projectId:  req.projectId,
      filePath:   req.filePath,
      oldContent: req.oldContent,
      newContent: req.newContent,
      status:     "pending",
    }).returning({ id: diffQueue.id });
    diffId = row.id;
  } catch (e) {
    console.warn("[diff-approval] DB insert failed (non-fatal):", (e as Error).message);
  }

  const approval: PendingApproval = {
    diffId,
    sessionId,
    projectId:   req.projectId,
    runId:       req.runId,
    filePath:    req.filePath,
    isNewFile:   req.isNewFile,
    oldContent:  req.oldContent,
    newContent:  req.newContent,
    unifiedDiff,
    status:      "pending",
    createdAt:   now,
    expiresAt:   now + APPROVAL_TTL_MS,
  };

  // Register async session (fire-and-forget; resolved by approve/reject)
  createSession(approval, async (sid) => {
    console.log(`[diff-approval] Session ${sid} expired — auto-rejected`);
    await updateDbStatus(diffId, "rejected");
    bus.emit("agent.diff", { ...approval, status: "expired" });
  });

  // Emit SSE event so the frontend shows the diff modal
  bus.emit("agent.diff", approval);

  return { sessionId, diffId, additions: stats.additions, deletions: stats.deletions };
}

// ── Approve / Reject ──────────────────────────────────────────────────────────

export async function approve(sessionId: string): Promise<ApprovalOutcome | { error: string }> {
  const sessions = getAllPending().concat(); // get before resolving
  const approval  = sessions.find(s => s.sessionId === sessionId)
    ?? getPendingForProject(0).find(s => s.sessionId === sessionId);

  // Read from store before resolving
  const { getSession } = await import("./diff-session.store.ts");
  const pending = getSession(sessionId);
  if (!pending) return { error: "Session not found or already resolved" };

  const result = resolveSession(sessionId, true);
  if (result === "already_resolved") return { error: "Already resolved" };
  if (result === "not_found")        return { error: "Session not found" };

  // Apply the file write
  try {
    const projectDir = getProjectDir(pending.projectId);
    const abs        = path.join(projectDir, pending.filePath);
    // Atomic write: temp-file rename prevents partial writes
    await atomicWrite(abs, pending.newContent);
    // Track version so future conflict detection works
    versionStore.record(pending.projectId, pending.filePath, pending.newContent, "agent");
    emitFileChange(pending.projectId, pending.isNewFile ? "add" : "change", pending.filePath);
    await updateDbStatus(pending.diffId, "applied");
    bus.emit("agent.diff", { ...pending, status: "approved" });
    return { approved: true, sessionId, diffId: pending.diffId };
  } catch (e: any) {
    console.error("[diff-approval] Failed to apply write:", e.message);
    await updateDbStatus(pending.diffId, "rejected");
    return { error: `Write failed: ${e.message}` };
  }
}

export async function reject(sessionId: string): Promise<ApprovalOutcome | { error: string }> {
  const { getSession } = await import("./diff-session.store.ts");
  const pending = getSession(sessionId);
  if (!pending) return { error: "Session not found or already resolved" };

  const result = resolveSession(sessionId, false);
  if (result === "already_resolved") return { error: "Already resolved" };
  if (result === "not_found")        return { error: "Session not found" };

  await updateDbStatus(pending.diffId, "rejected");
  bus.emit("agent.diff", { ...pending, status: "rejected" });
  return { approved: false, sessionId, diffId: pending.diffId };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function updateDbStatus(diffId: number, status: string): Promise<void> {
  if (diffId < 0) return; // DB insert failed earlier
  try {
    await db.update(diffQueue).set({ status }).where(eq(diffQueue.id, diffId));
  } catch { /* non-fatal */ }
}
