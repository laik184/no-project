/**
 * distributed-file-scanner.ts
 *
 * Main orchestrator for the Distributed File Scanner system.
 *
 * Execution flow:
 *   1. Acquire per-project scan lock (fail-closed if locked)
 *   2. Walk directory tree and collect FileEntry objects
 *   3. Partition files into worker batches
 *   4. Run all workers in parallel (Promise.allSettled)
 *   5. Aggregate results into a deterministic ScanReport
 *   6. Release lock + emit telemetry
 *
 * Integrates with:
 *   ✅ orchestration hub (invokable by ID)
 *   ✅ DAG engine (NodeExecutor-compatible)
 *   ✅ recovery system (trigger="recovery")
 */

import fs   from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";

import { scanLockManager }     from "./locks/scan-lock-manager.ts";
import { partitionFiles }      from "./file-partitioner.ts";
import { runWorker }           from "./scan-worker.ts";
import { aggregateResults }    from "./scan-aggregator.ts";
import { buildConfig }         from "./config/scanner-config.ts";
import { buildFileEntry }      from "./utils/scan-filter.ts";
import {
  emitScanStarted, emitScanPartitioned,
  emitWorkerStarted, emitWorkerCompleted, emitWorkerFailed,
  emitScanCompleted, emitScanFailed,
} from "./telemetry/scan-telemetry.ts";
import type { ScanOptions, ScanReport, FileEntry } from "./types/scan.types.ts";
import type { WorkerResult }    from "./types/worker.types.ts";
import type { ScannerConfig }   from "./config/scanner-config.ts";
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

    // ── Run workers in parallel ───────────────────────────────────────────
    const workerPromises = partitions.map(partition => {
      emitWorkerStarted(scanId, opts.projectId, partition.id, partition.workerIndex, partition.files.length);

      return runWorkerWithTimeout(
        {
          partitionId:     partition.id,
          workerIndex:     partition.workerIndex,
          files:           partition.files,
          workerTimeoutMs: config.workerTimeoutMs,
          signal:          opts.signal,
        },
        config.workerTimeoutMs,
      ).then(result => {
        emitWorkerCompleted(
          scanId, opts.projectId, partition.id, partition.workerIndex,
          result.durationMs, result.findings.length,
        );
        return result;
      }).catch((err: Error) => {
        emitWorkerFailed(
          scanId, opts.projectId, partition.id, partition.workerIndex,
          err.message, Date.now() - startedAt,
        );
        throw err;
      });
    });

    const settled = await Promise.allSettled(workerPromises);

    // ── Fail-closed: all workers failed ───────────────────────────────────
    const succeeded = settled.filter(s => s.status === "fulfilled") as
      PromiseFulfilledResult<WorkerResult>[];

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
      workerResults:  succeeded.map(s => s.value),
      settled,
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
    return files; // unreadable directory — skip silently
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
        const stat  = await fs.stat(fullPath);
        const fe    = buildFileEntry(fullPath, stat.size, config);
        if (fe) files.push(fe);
      } catch { /* skip unreadable files */ }
    }
  }));

  return files;
}

// ── Worker timeout wrapper ────────────────────────────────────────────────────

async function runWorkerWithTimeout(
  input:     Parameters<typeof runWorker>[0],
  timeoutMs: number,
): Promise<WorkerResult> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Worker ${input.workerIndex} timed out after ${timeoutMs}ms`)),
      timeoutMs,
    ),
  );
  return Promise.race([runWorker(input), timeout]);
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
