/**
 * escalation-policy.ts
 *
 * Policy rules governing when and how execution mode escalation is permitted.
 * Pure logic — no side effects, no I/O, no telemetry.
 */

import type { OrchestrationMode } from "../core/orchestration-types.ts";
import type { RerouteSignalKind, RuntimeMetricsSnapshot } from "./reroute-types.ts";
import { THRESHOLDS, ESCALATION, MODE_UPGRADE_LADDER } from "./reroute-thresholds.ts";

// ── Escalation rules ──────────────────────────────────────────────────────────

export interface PolicyEvaluation {
  permitted:      boolean;
  targetMode:     OrchestrationMode | null;
  reason:         string;
  requiredSignals: RerouteSignalKind[];
}

/**
 * Evaluate whether escalation from `currentMode` is permitted.
 * Returns the target mode and the reason for/against escalation.
 */
export function evaluateEscalationPolicy(
  currentMode:     OrchestrationMode,
  activeSignals:   RerouteSignalKind[],
  escalationCount: number,
  metrics:         RuntimeMetricsSnapshot,
): PolicyEvaluation {

  // Rule 1: Hard cap on escalation count (anti-loop)
  if (escalationCount >= ESCALATION.MAX_ESCALATIONS_PER_RUN) {
    return {
      permitted: false,
      targetMode: null,
      reason: `Max escalations (${ESCALATION.MAX_ESCALATIONS_PER_RUN}) reached for this run`,
      requiredSignals: [],
    };
  }

  // Rule 2: Too late to escalate safely
  if (metrics.elapsedMs > ESCALATION.MAX_AGE_FOR_ESCALATION_MS) {
    return {
      permitted: false,
      targetMode: null,
      reason: `Run too old (${Math.round(metrics.elapsedMs / 60000)}min) for safe escalation`,
      requiredSignals: [],
    };
  }

  // Rule 3: No escalation during recovery or verification lock
  if (metrics.currentPhase === "verify" || metrics.currentPhase === "heal") {
    return {
      permitted: false,
      targetMode: null,
      reason: `Cannot escalate during phase=${metrics.currentPhase}`,
      requiredSignals: [],
    };
  }

  // Rule 4: Find the target mode from the upgrade ladder
  const step = MODE_UPGRADE_LADDER.find(s => s.from === currentMode);
  if (!step) {
    return {
      permitted: false,
      targetMode: null,
      reason: `No upgrade path defined from mode=${currentMode}`,
      requiredSignals: [],
    };
  }

  // Rule 5: quantum mode is future-reserved — only permit if explicitly ready
  if (step.to === "quantum" && !_quantumReady(metrics)) {
    return {
      permitted: false,
      targetMode: null,
      reason: "Quantum mode requires explicit complexity threshold — not reached",
      requiredSignals: ["HIGH_COMPLEXITY", "PARALLEL_OPPORTUNITY"],
    };
  }

  // Rule 6: At least one qualifying signal is required
  const qualifyingSignals = _getQualifyingSignals(step.to as OrchestrationMode);
  const hasQualifying = activeSignals.some(s => qualifyingSignals.includes(s));

  if (!hasQualifying) {
    return {
      permitted: false,
      targetMode: null,
      reason: `No qualifying signals for upgrade to ${step.to}. Need: ${qualifyingSignals.join(", ")}`,
      requiredSignals: qualifyingSignals,
    };
  }

  return {
    permitted:       true,
    targetMode:      step.to as OrchestrationMode,
    reason:          `Policy permits escalation: ${currentMode} → ${step.to} (signals: ${activeSignals.join(", ")})`,
    requiredSignals: [],
  };
}

// ── Qualifying signals per target mode ───────────────────────────────────────

function _getQualifyingSignals(targetMode: OrchestrationMode): RerouteSignalKind[] {
  switch (targetMode) {
    case "planned":
      return ["HIGH_COMPLEXITY", "RETRY_STORM", "REFLECTION_ESCALATION", "DEPENDENCY_EXPLOSION"];
    case "dag":
      return ["MASS_FILE_TOUCH", "VERIFICATION_CASCADE", "RUNTIME_INSTABILITY", "PARALLEL_OPPORTUNITY", "DEPENDENCY_EXPLOSION"];
    case "quantum":
      return ["PARALLEL_OPPORTUNITY", "HIGH_COMPLEXITY", "MASS_FILE_TOUCH"];
    default:
      return [];
  }
}

// ── Quantum readiness heuristic ───────────────────────────────────────────────

function _quantumReady(metrics: RuntimeMetricsSnapshot): boolean {
  return (
    metrics.filesTouchedCount   > THRESHOLDS.MASS_FILE_TOUCH * 2 &&
    metrics.dependencyCount     > THRESHOLDS.DEPENDENCY_EXPLOSION &&
    metrics.verificationFailCount > THRESHOLDS.VERIFICATION_CASCADE
  );
}

// ── Downgrade check (currently disabled per spec) ────────────────────────────

export function isDowngradeAllowed(): boolean {
  return false;   // NO downgrade in v1 — only escalation
}
