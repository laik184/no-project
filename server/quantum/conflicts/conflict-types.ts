/**
 * server/quantum/conflicts/conflict-types.ts
 *
 * Canonical type contracts for the Conflict Resolution System.
 * No imports — zero circular dependency risk.
 * Single source of truth for all conflict domain types.
 */

// ── Conflict classification ───────────────────────────────────────────────────

export type ConflictType =
  | "FILE_WRITE_CONFLICT"   // two paths write the same file
  | "AST_CONFLICT"          // overlapping edits to the same AST node
  | "MEMORY_CONFLICT"       // concurrent writes to the same memory key
  | "RUNTIME_CONFLICT"      // concurrent modification of runtime state
  | "DAG_STATE_CONFLICT";   // two DAG nodes claim the same output key

export type ConflictSeverity =
  | "low"       // informational — safe to merge automatically
  | "medium"    // needs strategy selection but no escalation
  | "high"      // escalation candidate; may block completion
  | "critical"; // blocks all forward progress until resolved

export type ConflictResolutionStrategy =
  | "AST_MERGE"
  | "CONFIDENCE_WINNER"
  | "SUPERVISOR_ARBITRATION"
  | "SAFE_RETRY"
  | "LAST_WRITE";

export type ConflictStatus = "detected" | "resolving" | "resolved" | "failed" | "escalated";

// ── Unified conflict record ───────────────────────────────────────────────────

export interface UnifiedConflict {
  readonly conflictId:    string;
  readonly type:          ConflictType;
  readonly runId:         string;
  readonly quantumRunId:  string;
  readonly resource:      string;     // file path, memory key, state key, etc.
  readonly parties:       string[];   // pathIds or agentIds involved
  readonly severity:      ConflictSeverity;
  readonly detectedAt:    number;
  status:                 ConflictStatus;
  resolution?:            ConflictResolutionStrategy;
  resolvedAt?:            number;
  resolvedBy?:            string;     // pathId that won
  metadata?:              Record<string, unknown>;
}

// ── Merge history entry ───────────────────────────────────────────────────────

export interface MergeHistoryEntry {
  readonly entryId:       string;
  readonly conflictId:    string;
  readonly quantumRunId:  string;
  readonly filePath:      string;
  readonly strategy:      ConflictResolutionStrategy;
  readonly winnerPathId:  string;
  readonly success:       boolean;
  readonly durationMs:    number;
  readonly mergedAt:      number;
  readonly reason:        string;
}

// ── Retry history entry ───────────────────────────────────────────────────────

export interface RetryHistoryEntry {
  readonly entryId:       string;
  readonly conflictId:    string;
  readonly quantumRunId:  string;
  readonly attempt:       number;
  readonly strategy:      ConflictResolutionStrategy;
  readonly success:       boolean;
  readonly delayMs:       number;
  readonly retriedAt:     number;
}

// ── Validation issue ──────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  readonly code:      string;
  readonly severity:  ValidationSeverity;
  readonly message:   string;
  readonly line?:     number;
  readonly column?:   number;
}

export interface ValidationResult {
  readonly filePath:  string;
  readonly passed:    boolean;
  readonly issues:    ValidationIssue[];
  readonly checkedAt: number;
}

// ── Write request (for parallel-write-coordinator) ────────────────────────────

export interface WriteRequest {
  readonly id:           string;
  readonly quantumRunId: string;
  readonly pathId:       string;
  readonly filePath:     string;
  readonly content:      string;
  readonly priority:     number;
  readonly timeoutMs:    number;
  maxRetries:            number;
}

export interface WriteResult {
  readonly requestId:  string;
  readonly success:    boolean;
  readonly durationMs: number;
  readonly retries:    number;
  readonly error?:     string;
}
