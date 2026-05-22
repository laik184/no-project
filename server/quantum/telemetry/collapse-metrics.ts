/**
 * collapse-metrics.ts
 *
 * Tracks collapse-level metrics: path survival rates, merge ratios,
 * conflict counts, and confidence distributions per quantum run.
 */

import { incrementCounter, recordDuration } from "../../orchestration/telemetry/orchestration-metrics.ts";

// ── Per-run collapse snapshot ─────────────────────────────────────────────────

export interface CollapseSnapshot {
  quantumRunId:      string;
  totalPaths:        number;
  succeededPaths:    number;
  failedPaths:       number;
  mergedPaths:       number;
  conflictsDetected: number;
  conflictsResolved: number;
  winnerConfidence:  number;
  collapseDurationMs: number;
  verificationPassed: boolean;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _snapshots = new Map<string, CollapseSnapshot>();

// ── Record ────────────────────────────────────────────────────────────────────

export function recordCollapseMetrics(snap: CollapseSnapshot): void {
  _snapshots.set(snap.quantumRunId, snap);

  const survivalRate = snap.totalPaths > 0
    ? (snap.succeededPaths / snap.totalPaths).toFixed(2)
    : "0";

  incrementCounter("quantum.collapse.path_survival", { rate: survivalRate });
  incrementCounter("quantum.collapse.conflicts_total", {}, snap.conflictsDetected);
  recordDuration("quantum.collapse.duration_ms", snap.collapseDurationMs);

  if (snap.verificationPassed) {
    incrementCounter("quantum.collapse.verification_passed");
  } else {
    incrementCounter("quantum.collapse.verification_failed");
  }

  console.info(
    `[collapse-metrics] run=${snap.quantumRunId} ` +
    `paths=${snap.succeededPaths}/${snap.totalPaths} ` +
    `conflicts=${snap.conflictsResolved}/${snap.conflictsDetected} ` +
    `confidence=${snap.winnerConfidence.toFixed(2)} ` +
    `dur=${snap.collapseDurationMs}ms`,
  );
}

// ── Readers ───────────────────────────────────────────────────────────────────

export function getSnapshot(quantumRunId: string): CollapseSnapshot | undefined {
  return _snapshots.get(quantumRunId);
}

export function getAllSnapshots(): CollapseSnapshot[] {
  return Array.from(_snapshots.values());
}

export function averageWinnerConfidence(): number {
  const snaps = getAllSnapshots();
  if (snaps.length === 0) return 0;
  return snaps.reduce((s, n) => s + n.winnerConfidence, 0) / snaps.length;
}

export function averageSurvivalRate(): number {
  const snaps = getAllSnapshots();
  if (snaps.length === 0) return 0;
  const rates = snaps.map(s => s.totalPaths > 0 ? s.succeededPaths / s.totalPaths : 0);
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export function clearMetrics(): void {
  _snapshots.clear();
}
