/**
 * aggregation-types.ts
 *
 * Canonical type contracts for the DAG-wave Result Aggregation Layer.
 * No local imports — zero circular dependency risk.
 */

// ── Identity ──────────────────────────────────────────────────────────────────

export interface WaveIdentity {
  runId:       string;
  projectId:   number;
  waveIndex:   number;
  executionId: string;
}

// ── Agent result collected from one node in a wave ────────────────────────────

export interface AgentResult {
  nodeId:             string;
  agentId:            string;
  waveIndex:          number;
  runId:              string;
  projectId:          number;
  success:            boolean;
  output:             unknown;
  fileMutations:      FileMutation[];
  toolResults:        ToolResult[];
  runtimeEvidence:    RuntimeEvidence | null;
  verificationPassed: boolean;
  confidence:         number;
  durationMs:         number;
  retries:            number;
  completedAt:        number;
  error?:             string;
}

// ── File-level mutation from an agent ─────────────────────────────────────────

export interface FileMutation {
  filePath:  string;
  operation: "write" | "delete" | "rename";
  content?:  string;
  ownerId:   string;       // nodeId that produced this mutation
  ts:        number;
}

// ── Tool result from a node execution ─────────────────────────────────────────

export interface ToolResult {
  toolName:    string;
  executionId: string;
  success:     boolean;
  output:      unknown;
  durationMs:  number;
}

// ── Runtime observation attached to a result ──────────────────────────────────

export interface RuntimeEvidence {
  verificationOutcome: "passed" | "failed" | "skipped";
  port?:               number;
  summary:             string;
  collectedAt:         number;
}

// ── Conflict types ────────────────────────────────────────────────────────────

export type ConflictKind =
  | "same_file_write"
  | "stale_write"
  | "patch_overlap"
  | "ownership_conflict"
  | "duplicate_execution";

export interface MergeConflict {
  kind:      ConflictKind;
  filePath:  string;
  ownerA:    string;
  ownerB:    string;
  runId:     string;
  waveIndex: number;
  resolved:  boolean;
  resolution?: ConflictResolution;
}

export interface ConflictResolution {
  strategy:   MergeStrategyKind;
  winnerId:   string;
  reason:     string;
  resolvedAt: number;
}

// ── Merge strategies ──────────────────────────────────────────────────────────

export type MergeStrategyKind =
  | "union"
  | "precedence"
  | "confidence"
  | "ast_safe";

export interface MergedFileState {
  filePath:   string;
  content:    string;
  strategy:   MergeStrategyKind;
  winnerId:   string;
  confidence: number;
  mergedAt:   number;
}

// ── Aggregation session status ─────────────────────────────────────────────────

export type AggregationStatus =
  | "collecting"
  | "merging"
  | "validating"
  | "collapsed"
  | "failed"
  | "blocked";

// ── Final collapsed execution state ───────────────────────────────────────────

export interface CollapsedExecutionState {
  runId:              string;
  projectId:          number;
  waveIndex:          number;
  winnerNodeId:       string;
  mergedFiles:        MergedFileState[];
  totalNodes:         number;
  successfulNodes:    number;
  failedNodes:        number;
  conflicts:          number;
  resolvedConflicts:  number;
  unresolvedConflicts:number;
  overallConfidence:  number;
  verificationPassed: boolean;
  collapsedAt:        number;
  durationMs:         number;
  safe:               boolean;
}

// ── Validation report ─────────────────────────────────────────────────────────

export interface ValidationReport {
  valid:           boolean;
  checks:          ValidationCheck[];
  blockedReason?:  string;
}

export interface ValidationCheck {
  name:    string;
  passed:  boolean;
  detail?: string;
}
