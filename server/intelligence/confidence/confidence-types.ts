/**
 * confidence-types.ts
 *
 * Single source of truth for all Agent Confidence System types.
 * No imports — zero circular dependency risk.
 */

// ── Confidence States ─────────────────────────────────────────────────────────

export type ConfidenceState =
  | "TRUSTED"      // score >= 0.85 — prioritised for routing
  | "STABLE"       // score >= 0.65 — normal operation
  | "DEGRADED"     // score >= 0.40 — reduced routing priority
  | "UNRELIABLE"   // score >= 0.20 — retries throttled, low priority
  | "BLOCKED";     // score <  0.20 — excluded from routing

// ── Final outcome for a single execution ─────────────────────────────────────

export type ExecutionOutcome =
  | "SUCCESS"
  | "PARTIAL"
  | "FAILED"
  | "CRASHED"
  | "HALLUCINATED"
  | "TIMEOUT"
  | "BLOCKED";

// ── Per-execution confidence record ──────────────────────────────────────────

export interface AgentConfidenceRecord {
  agentId:             string;
  role:                string;
  runId:               string;
  taskId:              string;
  confidenceScore:     number;   // 0–1
  reliabilityScore:    number;   // 0–1  (historical EWMA)
  hallucinationRisk:   number;   // 0–1  (higher = worse)
  executionQuality:    number;   // 0–1
  verificationPassed:  boolean;
  retries:             number;
  runtimeFailures:     number;
  policyViolations:    number;
  latencyScore:        number;   // 0–1  (higher = faster)
  finalOutcome:        ExecutionOutcome;
  state:               ConfidenceState;
  ts:                  number;
}

// ── Reliability history entry ─────────────────────────────────────────────────

export interface ReliabilityEntry {
  runId:              string;
  agentId:            string;
  success:            boolean;
  verificationPassed: boolean;
  hallucinationRisk:  number;
  retries:            number;
  latencyMs:          number;
  ts:                 number;
}

// ── Hallucination signal ──────────────────────────────────────────────────────

export interface HallucinationSignal {
  type:        HallucinationSignalType;
  detail:      string;
  severity:    "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  penalty:     number;   // 0–1 additive to hallucinationRisk
}

export type HallucinationSignalType =
  | "FAKE_FILE_CLAIM"
  | "FAKE_BUILD_SUCCESS"
  | "FAKE_RUNTIME_SUCCESS"
  | "INVALID_IMPORT"
  | "BROKEN_REFERENCE"
  | "MISSING_EXPORT"
  | "INVALID_PATH"
  | "FAKE_COMPLETION";

// ── Execution quality dimensions ──────────────────────────────────────────────

export interface ExecutionQualityDimensions {
  verificationSuccess: number;   // 0–1
  runtimeStability:    number;   // 0–1
  codeQuality:         number;   // 0–1 (lint + type errors)
  policyCompliance:    number;   // 0–1
  modularity:          number;   // 0–1
}

// ── Retry decision ─────────────────────────────────────────────────────────────

export interface ConfidenceRetryDecision {
  agentId:         string;
  runId:           string;
  allowed:         boolean;
  reason:          string;
  maxRetriesLeft:  number;
  backoffMs:       number;
}

// ── Conflict resolution result ────────────────────────────────────────────────

export interface ConflictResolutionResult {
  winnerAgentId:   string;
  loserAgentId:    string;
  filePath:        string;
  reason:          string;
  arbitrated:      boolean;   // true = supervisor arbitration used
}

// ── Policy evaluation result ──────────────────────────────────────────────────

export interface PolicyEvaluationResult {
  agentId:          string;
  runId:            string;
  violationsFound:  string[];
  penaltyApplied:   number;
  stateTransition?: ConfidenceState;
  blocked:          boolean;
}

// ── Scoring input ─────────────────────────────────────────────────────────────

export interface ScoringInput {
  agentId:            string;
  role:               string;
  runId:              string;
  taskId:             string;
  verificationPassed: boolean;
  runtimeFailures:    number;
  retries:            number;
  latencyMs:          number;
  policyViolations:   number;
  hallucinationRisk:  number;
  executionQuality:   ExecutionQualityDimensions;
  historicalReliability: number;
}
