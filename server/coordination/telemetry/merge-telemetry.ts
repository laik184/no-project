/**
 * merge-telemetry.ts
 *
 * Centralised telemetry helpers for the entire coordination/merge layer.
 * Single responsibility: typed event emission — no logic, no side effects beyond bus.
 *
 * All merge infrastructure imports from here; avoids copy-paste of bus.emit boilerplate.
 *
 * Canonical merge event taxonomy:
 *   merge.start              → merge pipeline initiated
 *   merge.patch.received     → patch enqueued for processing
 *   merge.patch.validated    → patch passed/failed validation barrier
 *   merge.conflict.detected  → conflict between specialists detected
 *   merge.conflict.resolved  → conflict resolved by strategy chain
 *   merge.patch.applied      → patch written to sandbox FS
 *   merge.patch.skipped      → patch excluded (lock fail / validation reject)
 *   merge.rollback           → transaction rolled back
 *   merge.reconcile.start    → reconciliation engine starting
 *   merge.reconcile.complete → reconciliation finished (consistent or anomalies)
 *   merge.complete           → full pipeline finished
 *   tx.begin / tx.commit / tx.rollback → transaction lifecycle
 *   journal.entry            → replay journal record written
 *   graph.built              → conflict dependency graph constructed
 *   memory.write             → merge outcome persisted to memory bridge
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Agent names (stable identifiers) ─────────────────────────────────────────

export type MergeAgentName =
  | "merge-pipeline"
  | "merge-transaction-manager"
  | "transactional-patch-applier"
  | "replay-journal"
  | "conflict-graph-builder"
  | "reconciliation-engine"
  | "merge-memory-bridge"
  | "patch-validation-barrier"
  | "specialist-result-merger";

// ── Emit helper ───────────────────────────────────────────────────────────────

export function emitMerge(
  agentName: MergeAgentName,
  runId:     string,
  eventType: string,
  payload:   Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId,
    phase:     "coordination.merge",
    agentName,
    eventType,
    payload,
    ts: Date.now(),
  });
}

// ── Pipeline lifecycle ────────────────────────────────────────────────────────

export function emitMergeStart(runId: string, patchCount: number, conflictCount: number): void {
  emitMerge("merge-pipeline", runId, "merge.start", { patchCount, conflictCount });
}

export function emitMergeComplete(
  runId:      string,
  applied:    number,
  skipped:    number,
  durationMs: number,
): void {
  emitMerge("merge-pipeline", runId, "merge.complete", { applied, skipped, durationMs });
}

export function emitPatchReceived(runId: string, filePath: string, domain: string): void {
  emitMerge("merge-pipeline", runId, "merge.patch.received", { filePath, domain });
}

// ── Transaction lifecycle ─────────────────────────────────────────────────────

export function emitTxBegin(runId: string, txId: string, patchCount: number): void {
  emitMerge("merge-transaction-manager", runId, "tx.begin", { txId, patchCount });
}

export function emitTxCommit(runId: string, txId: string, applied: number, durationMs: number): void {
  emitMerge("merge-transaction-manager", runId, "tx.commit", { txId, applied, durationMs });
}

export function emitTxRollback(runId: string, txId: string, reason: string, rolledBack: number): void {
  emitMerge("merge-transaction-manager", runId, "merge.rollback", { txId, reason, rolledBack });
}

// ── Patch lifecycle ───────────────────────────────────────────────────────────

export function emitPatchValidated(runId: string, filePath: string, valid: boolean, reason?: string): void {
  emitMerge("patch-validation-barrier", runId, "merge.patch.validated", { filePath, valid, reason });
}

export function emitPatchApplied(runId: string, filePath: string, op: string, durationMs: number): void {
  emitMerge("transactional-patch-applier", runId, "merge.patch.applied", { filePath, op, durationMs });
}

export function emitPatchSkipped(runId: string, filePath: string, reason: string): void {
  emitMerge("merge-pipeline", runId, "merge.patch.skipped", { filePath, reason });
}

// ── Conflict lifecycle ────────────────────────────────────────────────────────

export function emitConflictDetected(
  runId:    string,
  filePath: string,
  type:     string,
  domains:  string[],
): void {
  emitMerge("specialist-result-merger", runId, "merge.conflict.detected", { filePath, type, domains });
}

export function emitConflictResolved(
  runId:     string,
  filePath:  string,
  strategy:  string,
  reasoning: string,
): void {
  emitMerge("specialist-result-merger", runId, "merge.conflict.resolved", { filePath, strategy, reasoning });
}

// ── Reconciliation lifecycle ──────────────────────────────────────────────────

export function emitReconcileStart(runId: string, patchCount: number): void {
  emitMerge("reconciliation-engine", runId, "merge.reconcile.start", { patchCount });
}

export function emitReconcileComplete(
  runId:           string,
  consistent:      boolean,
  patchesVerified: number,
  anomalies:       number,
): void {
  emitMerge("reconciliation-engine", runId, "merge.reconcile.complete", {
    consistent, patchesVerified, anomalies,
  });
}

/** @deprecated Use emitReconcileComplete */
export function emitReconciliationResult(
  runId: string,
  consistent: boolean,
  patchesVerified: number,
  anomalies: number,
): void {
  emitReconcileComplete(runId, consistent, patchesVerified, anomalies);
}

// ── Journal ───────────────────────────────────────────────────────────────────

export function emitJournalEntry(runId: string, entryId: string, filePath: string, strategy: string): void {
  emitMerge("replay-journal", runId, "journal.entry", { entryId, filePath, strategy });
}

// ── Graph ─────────────────────────────────────────────────────────────────────

export function emitGraphBuilt(runId: string, nodes: number, edges: number, cycles: number): void {
  emitMerge("conflict-graph-builder", runId, "graph.built", { nodes, edges, cycles });
}

// ── Memory bridge ─────────────────────────────────────────────────────────────

export function emitMemoryBridgeWrite(
  runId:    string,
  filePath: string,
  outcome:  "success" | "failure",
  strategy: string,
): void {
  emitMerge("merge-memory-bridge", runId, "memory.write", { filePath, outcome, strategy });
}
