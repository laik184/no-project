/**
 * merge.types.ts
 *
 * Type contracts for result aggregation, merging, and consensus.
 * No imports — zero circular dependency risk.
 */

// ── Merge strategy ────────────────────────────────────────────────────────────

export type MergeStrategyKind =
  | "CONFIDENCE_WINNER"    // pick output from highest-confidence path
  | "AST_MERGE"            // structural AST-level merge
  | "LAST_WRITER"          // fallback: last written value wins
  | "SUPERVISOR_ARBITRATE"; // escalate to supervisor agent

// ── Merge result ──────────────────────────────────────────────────────────────

export interface MergeResult {
  filePath:    string;
  strategy:    MergeStrategyKind;
  winnerPathId: string;
  content:     string;
  conflicts:   number;
  success:     boolean;
  reason:      string;
}

// ── Consensus decision ────────────────────────────────────────────────────────

export interface ConsensusDecision {
  filePath:     string;
  agreedPathIds: string[];   // paths that agree on content
  dissenting:   string[];    // paths with different content
  winnerContent: string;
  strategy:     MergeStrategyKind;
  confidence:   number;
}

// ── Aggregated path output ────────────────────────────────────────────────────

export interface NormalizedPathOutput {
  pathId:       string;
  filesWritten: Map<string, string>;   // filePath → content
  exports:      Map<string, string[]>; // filePath → exported symbols
  imports:      Map<string, string[]>; // filePath → imported modules
  errorCount:   number;
  warningCount: number;
}

// ── Final merge plan ──────────────────────────────────────────────────────────

export interface MergePlan {
  quantumRunId:    string;
  primaryPathId:   string;
  supplementalPaths: string[];
  fileDecisions:   Map<string, MergeStrategyKind>;
  estimatedConflicts: number;
  createdAt:       number;
}

// ── AST merge fragment ────────────────────────────────────────────────────────

export interface AstMergeFragment {
  filePath:    string;
  pathId:      string;
  nodeType:    string;     // e.g. "FunctionDeclaration", "ImportDeclaration"
  nodeId:      string;     // unique node identifier
  content:     string;
  lineStart:   number;
  lineEnd:     number;
}
