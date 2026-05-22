/**
 * path.types.ts
 *
 * Type contracts for individual execution paths.
 * No imports — zero circular dependency risk.
 */

// ── Path lifecycle states ─────────────────────────────────────────────────────

export type PathLifecycleState =
  | "IDLE"
  | "SPAWNING"
  | "RUNNING"
  | "VERIFYING"
  | "MERGING"
  | "COLLAPSED"
  | "FAILED"
  | "CANCELLED";

// ── Path execution result ─────────────────────────────────────────────────────

export interface PathResult {
  pathId:             string;
  success:            boolean;
  filesWritten:       string[];
  output?:            unknown;
  verificationPassed: boolean;
  error?:             string;
  durationMs:         number;
  retries:            number;
  completedAt:        number;
}

// ── Path telemetry snapshot ───────────────────────────────────────────────────

export interface PathTelemetry {
  spawned:       number;
  started:       number;
  completed?:    number;
  failed?:       number;
  retries:       number;
  durationMs:    number;
  stepCount:     number;
}

// ── Execution path (full model) ───────────────────────────────────────────────

export interface ExecutionPath {
  pathId:       string;
  quantumRunId: string;
  strategy:     string;
  strategyName: string;
  priority:     number;

  // State machine
  state:        PathLifecycleState;

  // Runtime
  confidenceScore:    number;
  verificationPassed: boolean;
  hallucinationRisk:  number;

  // Result (populated after completion)
  result?:      PathResult;

  // Telemetry
  telemetry:    PathTelemetry;

  // Isolation
  sandboxSubDir: string;    // isolated working directory for this path
  abortController: AbortController;
}

// ── Path comparison ───────────────────────────────────────────────────────────

export interface PathRanking {
  pathId:             string;
  rank:               number;
  confidenceScore:    number;
  verificationPassed: boolean;
  hallucinationRisk:  number;
  reason:             string;
}

// ── Path conflict ─────────────────────────────────────────────────────────────

export interface PathConflict {
  conflictId: string;
  filePath:   string;
  pathIds:    string[];     // paths that wrote the same file
  detected:   number;
  resolved:   boolean;
  resolution? : "path_a_wins" | "path_b_wins" | "merged" | "supervisor";
  winnerPathId?: string;
}
