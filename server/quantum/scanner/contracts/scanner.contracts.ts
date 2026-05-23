/**
 * server/quantum/scanner/contracts/scanner.contracts.ts
 *
 * Abstract interface contracts for the Distributed File Scanner subsystem.
 *
 * These interfaces decouple the planning, context, and verification pipelines
 * from the concrete DistributedFileScanner implementation, enabling future
 * migration to remote/distributed scan workers without changing call sites.
 */

import type { ScanOptions, ScanReport } from "../types/scan.types.ts";
import type { WorkerResult }            from "../types/worker.types.ts";
import type { FileEntry }               from "../types/scan.types.ts";

// ── Core scanner interface ────────────────────────────────────────────────────

/**
 * IFileScanner — contract for any distributed file analysis executor.
 * DistributedFileScanner (runDistributedScan) satisfies this interface.
 */
export interface IFileScanner {
  /**
   * Execute a full scan of a project sandbox.
   * Fail-closed: throws if the scan cannot produce any results.
   */
  scan(opts: ScanOptions): Promise<ScanReport>;
}

// ── Partition contract ────────────────────────────────────────────────────────

export interface IScanPartition {
  readonly id:          string;
  readonly workerIndex: number;
  readonly files:       FileEntry[];
}

// ── Worker contract ───────────────────────────────────────────────────────────

export interface IScanWorker {
  run(partition: IScanPartition, timeoutMs: number, signal?: AbortSignal): Promise<WorkerResult>;
}

// ── Aggregator contract ───────────────────────────────────────────────────────

export interface IScanAggregator {
  aggregate(params: ScanAggregationParams): ScanReport;
}

export interface ScanAggregationParams {
  scanId:         string;
  opts:           ScanOptions;
  startedAt:      number;
  workerResults:  WorkerResult[];
  settled:        Array<PromiseFulfilledResult<WorkerResult> | PromiseRejectedResult>;
  partitionCount: number;
  minConfidence:  number;
}

// ── Lock contract ─────────────────────────────────────────────────────────────

export interface IScanLockManager {
  acquire(projectId: number, scanId: string): { success: boolean; existingScanId?: string };
  release(projectId: number, scanId: string): void;
  isLocked(projectId: number): boolean;
}

// ── Telemetry contract ────────────────────────────────────────────────────────

export interface IScanTelemetry {
  onScanStarted(scanId: string, projectId: number, trigger: string, rootPath: string): void;
  onScanPartitioned(scanId: string, projectId: number, fileCount: number, partitionCount: number): void;
  onWorkerStarted(scanId: string, projectId: number, partitionId: string, workerIndex: number, fileCount: number): void;
  onWorkerCompleted(scanId: string, projectId: number, partitionId: string, workerIndex: number, durationMs: number, findingCount: number): void;
  onWorkerFailed(scanId: string, projectId: number, partitionId: string, workerIndex: number, error: string, durationMs: number): void;
  onScanCompleted(scanId: string, projectId: number, durationMs: number, filesScanned: number, findingCount: number): void;
  onScanFailed(scanId: string, projectId: number, error: string, durationMs: number): void;
}

// ── Integration points ────────────────────────────────────────────────────────

/**
 * ScanTrigger — all valid contexts that can invoke a distributed scan.
 * Enforces typed integration at call sites.
 */
export type ScanTrigger =
  | "planning"        // invoked by planner before architecture analysis
  | "context-build"   // invoked by context builder for dependency graph
  | "verification"    // invoked by verification pipeline post-execution
  | "recovery"        // invoked by crash recovery for damage assessment
  | "intelligence"    // invoked by code intelligence for symbol extraction
  | "manual";         // invoked directly by an agent tool call
