/**
 * worker.types.ts
 *
 * Type contracts for scan worker I/O.
 * Isolated from scan.types.ts to allow independent module evolution.
 */

import type { ScanFinding, CircularRef, FileEntry } from "./scan.types.ts";

// ── Worker input ──────────────────────────────────────────────────────────────

export interface WorkerInput {
  partitionId:  string;
  workerIndex:  number;
  files:        FileEntry[];
  workerTimeoutMs: number;
  signal?:      AbortSignal;
}

// ── Worker output ─────────────────────────────────────────────────────────────

export interface WorkerResult {
  partitionId:         string;
  workerIndex:         number;
  findings:            ScanFinding[];
  importGraph:         ImportGraphEntry[];
  circularRefs:        CircularRef[];
  durationMs:          number;
  filesProcessed:      number;
  errorCount:          number;
  confidenceScore:     number;
  success:             boolean;
  error?:              string;
}

// ── Import graph ──────────────────────────────────────────────────────────────

export interface ImportGraphEntry {
  /** File that contains the import statement. */
  fromPath:    string;
  /** Resolved or raw import path. */
  toPath:      string;
  /** Whether this is a dynamic `import()` call. */
  isDynamic:   boolean;
  /** Whether the imported symbol is actually used. */
  isUsed:      boolean;
  /** Line number of the import statement. */
  line:        number;
}

// ── Per-file scan detail ──────────────────────────────────────────────────────

export interface FileScanDetail {
  filePath:   string;
  imports:    ImportGraphEntry[];
  findings:   ScanFinding[];
  scannedAt:  number;
  durationMs: number;
  error?:     string;
}
