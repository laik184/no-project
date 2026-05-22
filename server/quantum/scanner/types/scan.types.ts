/**
 * scan.types.ts
 *
 * All type contracts for the Distributed File Scanner system.
 * No external imports — zero circular dependency risk.
 */

// ── Classification ────────────────────────────────────────────────────────────

export type FileCategory =
  | "frontend"
  | "backend"
  | "agents"
  | "infra"
  | "tests"
  | "shared"
  | "unknown";

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export type ScanTrigger =
  | "orchestration"
  | "dag"
  | "verification"
  | "recovery"
  | "manual";

export type FindingType =
  | "circular_import"
  | "dead_import"
  | "invalid_path"
  | "cross_domain_violation"
  | "architecture_leak"
  | "runtime_risk"
  | "orchestration_risk"
  | "bug_pattern"
  | "missing_await"
  | "race_condition"
  | "memory_leak"
  | "infinite_retry"
  | "orphaned_listener"
  | "unhandled_error"
  | "unsafe_singleton"
  | "sequential_bottleneck";

// ── File graph ────────────────────────────────────────────────────────────────

export interface FileEntry {
  path:      string;   // absolute or project-relative
  ext:       string;
  sizeBytes: number;
  category:  FileCategory;
}

export interface FilePartition {
  id:       string;
  files:    FileEntry[];
  category: FileCategory | "mixed";
  workerIndex: number;
}

// ── Finding ───────────────────────────────────────────────────────────────────

export interface ScanFinding {
  id:        string;
  type:      FindingType;
  severity:  SeverityLevel;
  filePath:  string;
  line?:     number;
  message:   string;
  evidence?: string;
  /** 0–1: scanner's confidence that this is a real issue. */
  confidence: number;
}

// ── Scan report ───────────────────────────────────────────────────────────────

export interface ScanReport {
  scanId:           string;
  projectId:        number;
  trigger:          ScanTrigger;
  startedAt:        number;
  completedAt:      number;
  durationMs:       number;
  filesScanned:     number;
  partitionCount:   number;
  workerCount:      number;
  findings:         ScanFinding[];
  circularImports:  CircularRef[];
  riskSummary:      RiskSummary;
  confidenceScore:  number;
  partialFailures:  PartialFailure[];
  success:          boolean;
  error?:           string;
}

export interface CircularRef {
  cycle: string[];   // ordered list of file paths forming the cycle
}

export interface RiskSummary {
  critical: number;
  high:     number;
  medium:   number;
  low:      number;
  info:     number;
  total:    number;
}

export interface PartialFailure {
  partitionId: string;
  workerIndex: number;
  error:       string;
  fileCount:   number;
}

// ── Scan options ──────────────────────────────────────────────────────────────

export interface ScanOptions {
  projectId:         number;
  rootPath:          string;
  trigger:           ScanTrigger;
  signal?:           AbortSignal;
  maxParallelWorkers?: number;
  maxFilesPerBatch?:   number;
  workerTimeoutMs?:    number;
  excludedFolders?:    string[];
  scanDepth?:          number;
}
