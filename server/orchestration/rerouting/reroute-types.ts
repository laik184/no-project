/**
 * reroute-types.ts
 *
 * All type contracts for the Dynamic Re-Routing System.
 * No local imports — zero circular dependency risk.
 */

import type { OrchestrationMode, OrchestrationPhase } from "../core/orchestration-types.ts";

// ── Runtime signal ────────────────────────────────────────────────────────────

export type RerouteSignalKind =
  | "HIGH_COMPLEXITY"
  | "RETRY_STORM"
  | "MASS_FILE_TOUCH"
  | "VERIFICATION_CASCADE"
  | "RUNTIME_INSTABILITY"
  | "PARALLEL_OPPORTUNITY"
  | "DEPENDENCY_EXPLOSION"
  | "REFLECTION_ESCALATION"
  | "MEMORY_PRESSURE"
  | "DURATION_EXCEEDED";

export interface RerouteSignal {
  kind:        RerouteSignalKind;
  strength:    number;       // 0–1, how strongly this signal fires
  value:       number;       // raw measured value
  threshold:   number;       // threshold that was crossed
  detectedAt:  number;
  detail:      string;
}

// ── Runtime metrics snapshot (collected from live run) ────────────────────────

export interface RuntimeMetricsSnapshot {
  runId:                string;
  projectId:            number;
  currentMode:          OrchestrationMode;
  currentPhase:         OrchestrationPhase;
  capturedAt:           number;

  // Execution counters
  filesTouchedCount:    number;
  retryCount:           number;
  toolFailureCount:     number;
  verificationFailCount: number;

  // Runtime health
  runtimeStatus:        string;      // "running" | "crashed" | "stopped"
  runtimeRestarts:      number;

  // Timing
  elapsedMs:            number;
  avgStepMs:            number;

  // Complexity
  dependencyCount:      number;
  agentConfidenceScore: number;       // 0–1
  hallucinationRisk:    number;       // 0–1
  reflectionSeverity:   number;       // 0–1 (from reflection agent)

  // Memory (optional)
  heapUsedMb:           number;
}

// ── Reroute decision ──────────────────────────────────────────────────────────

export type RerouteDecisionKind =
  | "ESCALATE"
  | "MAINTAIN"
  | "BLOCK";

export interface RerouteDecision {
  kind:          RerouteDecisionKind;
  fromMode:      OrchestrationMode;
  toMode:        OrchestrationMode | null;
  confidence:    number;            // 0–1
  triggerSignals: RerouteSignalKind[];
  reason:        string;
  urgency:       "low" | "medium" | "high" | "critical";
  decidedAt:     number;
}

// ── Transition record ─────────────────────────────────────────────────────────

export type TransitionOutcome = "success" | "blocked" | "failed" | "skipped";

export interface ModeTransitionRecord {
  transitionId:  string;
  runId:         string;
  fromMode:      OrchestrationMode;
  toMode:        OrchestrationMode;
  outcome:       TransitionOutcome;
  reason:        string;
  triggeredAt:   number;
  completedAt?:  number;
  durationMs?:   number;
  checkpointId?: string;
}

// ── Guard result ──────────────────────────────────────────────────────────────

export interface GuardResult {
  safe:           boolean;
  blockingGuards: string[];
  warnings:       string[];
}

// ── Reroute context (passed between rerouting subsystems) ─────────────────────

export interface RerouteContext {
  runId:          string;
  projectId:      number;
  metrics:        RuntimeMetricsSnapshot;
  signals:        RerouteSignal[];
  decision:       RerouteDecision;
  guardResult:    GuardResult;
  escalationCount: number;     // how many times this run has been escalated
}
