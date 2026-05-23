/**
 * distributed-file-scanner.ts
 *
 * Main orchestrator for the Distributed File Scanner system.
 *
 * Architecture upgrade (Phase 5)
 * ──────────────────────────────
 *   BEFORE: scan workers dispatched via raw Promise.allSettled
 *   AFTER:  each partition worker is a PoolTask submitted to CentralWorkerPool
 *
 * Execution flow:
 *   1. Acquire per-project scan lock (fail-closed if locked)
 *   2. Walk directory tree and collect FileEntry objects
 *   3. Partition files into worker batches
 *   4. Submit all workers to CentralWorkerPool — governed parallel execution
 *   5. Aggregate results into a deterministic ScanReport
 *   6. Release lock + emit telemetry
 *
 * Integrates with:
 *   ✅ orchestration hub (invokable by ID)
 *   ✅ DAG engine (NodeExecutor-compatible)
 *   ✅ recovery system (trigger="recovery")
 *   ✅ CentralWorkerPool (governed, backpressure-aware parallel execution)
 */

import fs   from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

import { scanLockManager }   from "./locks/scan-lock-manager.ts";
import { partitionFiles }    from "./file-partitioner.ts";
import { runWorker }         from "./scan-worker.ts";
import { aggregateResults }  from "./scan-aggregator.ts";
import { buildConfig }       from "./config/scanner-config.ts";
import { buildFileEntry }    from "./utils/scan-filter.ts";
import {
  emitScanStarted, emitScanPartitioned,
  emitWorkerStarted, emitWorkerCompleted, emitWorkerFailed,
  emitScanCompleted, emitScanFailed,
}                            from "./telemetry/scan-telemetry.ts";
import { centralWorkerPool } from "../scheduler/worker-pool.ts";
import { TaskPriority }      from "../scheduler/worker-types.ts";
import type { PoolTask }     from "../scheduler/worker-types.ts";
import type { ScanOptions, ScanReport, FileEntry } from "./types/scan.types.ts";
import type { WorkerResult }   from "./types/worker.types.ts";
import type { ScannerConfig }  from "./config/scanner-config.ts";
import { DEFAULT_SCANNER_CONFIG } from "./config/scanner-config.ts";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Execute a full distributed scan of the given root directory.
 *
 * Fail-closed: throws if lock acquisition fails, directory is unreadable,
 * aggregation fails, or all workers fail.
 */
export async function runDistributedScan(opts: ScanOptions): Promise<ScanReport> {
  const scanId    = uuid();
  const startedAt = Date.now();
  const config    = buildConfig({
    maxParallelWorkers: opts.maxParallelWorkers,
    maxFilesPerBatch:   opts.maxFilesPerBatch,
    workerTimeoutMs:    opts.workerTimeoutMs,
    excludedFolders:    opts.excludedFolders,
    scanDepth:          opts.scanDepth,
  });

  emitScanStarted(scanId, opts.projectId, opts.trigger, opts.rootPath);

  // ── Acquire lock ─────────────────────────────────────────────────────────
  const lockResult = scanLockManager.acquire(opts.projectId, scanId);
  if (!lockResult.success) {
    const err = `Scan lock held by ${lockResult.existingScanId} — parallel scan blocked`;
    emitScanFailed(scanId, opts.projectId, err, Date.now() - startedAt);
    throw new Error(`[DistributedFileScanner] ${err}`);
  }

  try {
    // ── Walk directory ────────────────────────────────────────────────────
    const files = await walkDirectory(opts.rootPath, config, opts.scanDepth ?? Infinity);

    if (files.length === 0) {
      return buildEmptyReport(scanId, opts, startedAt);
    }

    // ── Partition ─────────────────────────────────────────────────────────
    const partitions = partitionFiles(files, config);
    emitScanPartitioned(scanId, opts.projectId, files.length, partitions.length);

    // ── Submit workers as governed PoolTasks ──────────────────────────────
    const workerTimeoutMs = config.workerTimeoutMs;

    const poolTasks: PoolTask<WorkerResult>[] = partitions.map(partition => {
      emitWorkerStarted(scanId, opts.projectId, partition.id, partition.workerIndex, partition.files.length);

      return {
        id:            partition.id,
        runId:         `scan-${scanId}`,
        priority:      TaskPriority.LOW,        // scans are background work
        timeoutMs:     workerTimeoutMs + 5_000, // outer hard cap > inner timeout
        maxRetries:    0,
        taskType:      "scan-worker",
        executionMode: "parallel" as const,
        fn:            () => runWorker({
          partitionId:     partition.id,
          workerIndex:     partition.workerIndex,
          files:           partition.files,
          workerTimeoutMs,
          signal:          opts.signal,
        }),
        signal:        opts.signal,
        metadata:      { scanId, partitionId: partition.id, workerIndex: partition.workerIndex },
      };
    });

    const poolResults = await Promise.all(
      poolTasks.map(task => centralWorkerPool.submit<WorkerResult>(task)),
    );

    // Collect succeeded / failed from pool results
    const succeeded: WorkerResult[] = [];
    for (let i = 0; i < poolResults.length; i++) {
      const result    = poolResults[i];
      const partition = partitions[i];

      if (result.success && result.data) {
        emitWorkerCompleted(
          scanId, opts.projectId, partition.id, partition.workerIndex,
          result.durationMs, result.data.findings.length,
        );
        succeeded.push(result.data);
      } else {
        const errMsg = result.error ?? "Worker pool execution failure";
        emitWorkerFailed(
          scanId, opts.projectId, partition.id, partition.workerIndex,
          errMsg, Date.now() - startedAt,
        );
      }
    }

    // ── Fail-closed: all workers failed ───────────────────────────────────
    if (succeeded.length === 0) {
      const err = "All scan workers failed — no results available";
      emitScanFailed(scanId, opts.projectId, err, Date.now() - startedAt);
      throw new Error(`[DistributedFileScanner] ${err}`);
    }

    // ── Aggregate ─────────────────────────────────────────────────────────
    const report = aggregateResults({
      scanId,
      opts,
      startedAt,
      workerResults:  succeeded,
      settled:        poolResults.map(r =>
        r.success && r.data
          ? { status: "fulfilled" as const, value: r.data }
          : { status: "rejected" as const, reason: new Error(r.error ?? "failed") },
      ),
      partitionCount: partitions.length,
      minConfidence:  config.minFindingConfidence,
    });

    emitScanCompleted(
      scanId, opts.projectId, report.durationMs,
      report.filesScanned, report.findings.length,
    );

    return report;

  } catch (err) {
    const msg = (err as Error).message;
    if (!msg.includes("All scan workers")) {
      emitScanFailed(scanId, opts.projectId, msg, Date.now() - startedAt);
    }
    throw err;
  } finally {
    scanLockManager.release(opts.projectId, scanId);
  }
}

// ── Directory walker ──────────────────────────────────────────────────────────

async function walkDirectory(
  rootPath:  string,
  config:    ScannerConfig,
  maxDepth:  number,
  depth    = 0,
): Promise<FileEntry[]> {
  const files: FileEntry[] = [];
  if (depth > maxDepth) return files;

  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch {
    return files;
  }

  await Promise.all(entries.map(async entry => {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (!config.excludedFolders.includes(entry.name)) {
        const sub = await walkDirectory(fullPath, config, maxDepth, depth + 1);
        files.push(...sub);
      }
    } else if (entry.isFile()) {
      try {
        const stat = await fs.stat(fullPath);
        const fe   = buildFileEntry(fullPath, stat.size, config);
        if (fe) files.push(fe);
      } catch { /* skip unreadable files */ }
    }
  }));

  return files;
}

// ── Empty report ──────────────────────────────────────────────────────────────

function buildEmptyReport(
  scanId:    string,
  opts:      ScanOptions,
  startedAt: number,
): ScanReport {
  const now = Date.now();
  return {
    scanId,
    projectId:       opts.projectId,
    trigger:         opts.trigger,
    startedAt,
    completedAt:     now,
    durationMs:      now - startedAt,
    filesScanned:    0,
    partitionCount:  0,
    workerCount:     0,
    findings:        [],
    circularImports: [],
    riskSummary:     { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
    confidenceScore: 1,
    partialFailures: [],
    success:         true,
  };
}
