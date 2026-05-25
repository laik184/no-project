/**
 * merge-telemetry.ts
 *
 * Centralised telemetry helpers for the entire coordination/merge layer.
 * Single responsibility: typed event emission — no logic, no side effects beyond bus.
 *
 * All merge infrastructure imports from here; avoids copy-paste of bus.emit boilerplate.
 */

import { bus } from "../../infrastructure/events/bus.ts";

// ── Agent names (stable identifiers) ─────────────────────────────────────────

export type MergeAgentName =
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

// ── Standard event builders ───────────────────────────────────────────────────

export function emitTxBegin(runId: string, txId: string, patchCount: number): void {
  emitMerge("merge-transaction-manager", runId, "tx.begin", { txId, patchCount });
}

export function emitTxCommit(runId: string, txId: string, applied: number, durationMs: number): void {
  emitMerge("merge-transaction-manager", runId, "tx.commit", { txId, applied, durationMs });
}

export function emitTxRollback(runId: string, txId: string, reason: string, rolledBack: number): void {
  emitMerge("merge-transaction-manager", runId, "tx.rollback", { txId, reason, rolledBack });
}

export function emitPatchValidated(runId: string, filePath: string, valid: boolean, reason?: string): void {
  emitMerge("patch-validation-barrier", runId, "patch.validated", { filePath, valid, reason });
}

export function emitPatchApplied(runId: string, filePath: string, op: string, durationMs: number): void {
  emitMerge("transactional-patch-applier", runId, "patch.applied", { filePath, op, durationMs });
}

export function emitJournalEntry(runId: string, entryId: string, filePath: string, strategy: string): void {
  emitMerge("replay-journal", runId, "journal.entry", { entryId, filePath, strategy });
}

export function emitGraphBuilt(runId: string, nodes: number, edges: number, cycles: number): void {
  emitMerge("conflict-graph-builder", runId, "graph.built", { nodes, edges, cycles });
}

export function emitReconciliationResult(
  runId: string,
  consistent: boolean,
  patchesVerified: number,
  anomalies: number,
): void {
  emitMerge("reconciliation-engine", runId, "reconciliation.result", {
    consistent, patchesVerified, anomalies,
  });
}

export function emitMemoryBridgeWrite(
  runId:    string,
  filePath: string,
  outcome:  "success" | "failure",
  strategy: string,
): void {
  emitMerge("merge-memory-bridge", runId, "memory.write", { filePath, outcome, strategy });
}
