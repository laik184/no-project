/**
 * scan-telemetry.ts
 *
 * Emits structured telemetry for all scanner lifecycle events.
 * Integrates with the shared event bus.
 *
 * Events:
 *   quantum.scan.started      — scanner initialised, directory walk begins
 *   quantum.scan.partitioned  — files partitioned into worker batches
 *   quantum.worker.started    — a worker batch begins execution
 *   quantum.worker.completed  — a worker batch finished successfully
 *   quantum.worker.failed     — a worker batch failed
 *   quantum.scan.completed    — all workers finished, report ready
 *   quantum.scan.failed       — scanner aborted (lock / aggregation failure)
 */

import { bus } from "../../../infrastructure/events/bus.ts";
import type { QuantumScanEvent } from "../../../infrastructure/events/types/event.types.ts";

// ── Builder ───────────────────────────────────────────────────────────────────

function base(
  scanId:    string,
  projectId: number,
  extra:     Partial<QuantumScanEvent> = {},
): QuantumScanEvent {
  return { scanId, projectId, ts: Date.now(), ...extra };
}

// ── Emitters ──────────────────────────────────────────────────────────────────

export function emitScanStarted(
  scanId:    string,
  projectId: number,
  trigger:   string,
  rootPath:  string,
): void {
  bus.emit("quantum.scan.started", base(scanId, projectId, { trigger, rootPath }));
}

export function emitScanPartitioned(
  scanId:         string,
  projectId:      number,
  fileCount:      number,
  partitionCount: number,
): void {
  bus.emit("quantum.scan.partitioned", base(scanId, projectId, { fileCount, partitionCount }));
}

export function emitWorkerStarted(
  scanId:      string,
  projectId:   number,
  partitionId: string,
  workerIndex: number,
  fileCount:   number,
): void {
  bus.emit("quantum.worker.started", base(scanId, projectId, { partitionId, workerIndex, fileCount }));
}

export function emitWorkerCompleted(
  scanId:       string,
  projectId:    number,
  partitionId:  string,
  workerIndex:  number,
  durationMs:   number,
  findingCount: number,
): void {
  bus.emit("quantum.worker.completed", base(scanId, projectId, {
    partitionId, workerIndex, durationMs, findingCount,
  }));
}

export function emitWorkerFailed(
  scanId:      string,
  projectId:   number,
  partitionId: string,
  workerIndex: number,
  error:       string,
  durationMs:  number,
): void {
  bus.emit("quantum.worker.failed", base(scanId, projectId, {
    partitionId, workerIndex, error, durationMs,
  }));
}

export function emitScanCompleted(
  scanId:       string,
  projectId:    number,
  durationMs:   number,
  filesScanned: number,
  findingCount: number,
): void {
  bus.emit("quantum.scan.completed", base(scanId, projectId, {
    durationMs, fileCount: filesScanned, findingCount,
  }));
}

export function emitScanFailed(
  scanId:    string,
  projectId: number,
  error:     string,
  durationMs: number,
): void {
  bus.emit("quantum.scan.failed", base(scanId, projectId, { error, durationMs }));
}
