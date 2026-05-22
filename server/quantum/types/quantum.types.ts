/**
 * quantum.types.ts
 *
 * Core type contracts for the Quantum Superposition Path System.
 * No imports — zero circular dependency risk.
 */

// ── Quantum run identity ──────────────────────────────────────────────────────

export interface QuantumRunInput {
  quantumRunId: string;
  runId:        string;
  projectId:    number;
  goal:         string;
  maxPaths:     number;
  timeoutMs:    number;
  sandboxRoot:  string;
  strategies?:  string[];   // override auto-generated strategies
}

export interface QuantumRunResult {
  quantumRunId:  string;
  runId:         string;
  success:       boolean;
  selectedPath:  string | null;
  mergedPaths:   string[];
  discardedPaths: string[];
  finalState:    CollapsedState | null;
  durationMs:    number;
  error?:        string;
}

// ── Collapsed (final) state ───────────────────────────────────────────────────

export interface CollapsedState {
  quantumRunId:       string;
  winnerPathId:       string;
  mergedPathIds:      string[];
  filesWritten:       string[];
  verificationPassed: boolean;
  confidenceScore:    number;
  collapsedAt:        number;
}

// ── Strategy descriptor ───────────────────────────────────────────────────────

export interface ExecutionStrategy {
  id:          string;
  name:        string;
  description: string;
  approach:    string;        // architectural approach label
  priority:    number;        // higher = preferred when tied
  tags:        string[];
}

// ── Worker task ───────────────────────────────────────────────────────────────

export interface WorkerTask<T = unknown> {
  taskId:    string;
  pathId:    string;
  priority:  number;
  timeoutMs: number;
  fn:        () => Promise<T>;
  onDone?:   (result: T)   => void;
  onError?:  (err: Error)  => void;
  signal?:   AbortSignal;
}

export interface WorkerTaskResult<T = unknown> {
  taskId:     string;
  pathId:     string;
  success:    boolean;
  result?:    T;
  error?:     string;
  durationMs: number;
}

// ── Aggregation output ────────────────────────────────────────────────────────

export interface AggregatedResult {
  quantumRunId:  string;
  completedPaths: string[];
  failedPaths:    string[];
  pathScores:     Map<string, number>;
  mergeables:     string[][];   // groups of compatible path IDs
}

// ── Quantum execution modes ───────────────────────────────────────────────────

export type QuantumTriggerCondition =
  | "large_codebase"
  | "multi_module"
  | "architecture_generation"
  | "refactor"
  | "high_complexity";

export type CollapseStrategy =
  | "best_wins"       // single highest-confidence path selected
  | "merge_compatible" // multiple compatible paths merged
  | "consensus";       // majority-vote on conflicting sections
