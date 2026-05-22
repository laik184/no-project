/**
 * server/quantum/scanner/index.ts
 *
 * Public barrel for the Distributed File Scanner system.
 * All external consumers import from here.
 */

// ── Primary entry point ───────────────────────────────────────────────────────
export { runDistributedScan }    from "./distributed-file-scanner.ts";

// ── Lock management ───────────────────────────────────────────────────────────
export { scanLockManager }       from "./locks/scan-lock-manager.ts";

// ── Sub-scanners (for direct use in recovery / DAG nodes) ────────────────────
export { scanImports, detectCircularImports } from "./import-scanner.ts";
export { scanDependencies }      from "./dependency-scanner.ts";
export { scanBugPatterns, scanRuntimeRisks }  from "./bug-pattern-scanner.ts";

// ── Worker (for direct invocation by WorkerPool) ─────────────────────────────
export { runWorker }             from "./scan-worker.ts";

// ── Partitioner + aggregator ──────────────────────────────────────────────────
export { partitionFiles, summarisePartitions } from "./file-partitioner.ts";
export { aggregateResults }      from "./scan-aggregator.ts";

// ── Config ────────────────────────────────────────────────────────────────────
export { buildConfig, DEFAULT_SCANNER_CONFIG } from "./config/scanner-config.ts";

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  FileCategory, SeverityLevel, ScanTrigger, FindingType,
  FileEntry, FilePartition, ScanFinding, ScanReport,
  CircularRef, RiskSummary, PartialFailure, ScanOptions,
} from "./types/scan.types.ts";

export type {
  WorkerInput, WorkerResult, ImportGraphEntry, FileScanDetail,
} from "./types/worker.types.ts";

export type { ScannerConfig } from "./config/scanner-config.ts";
