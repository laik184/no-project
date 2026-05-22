/**
 * reroute-decision-engine.ts
 *
 * Determines whether escalation should occur and calculates the target mode.
 * Combines signal analysis + policy evaluation into a final RerouteDecision.
 * Pure logic — no side effects, no telemetry.
 */

import type { OrchestrationMode } from "../core/orchestration-types.ts";
import type {
  RerouteDecision,
  RuntimeMetricsSnapshot,
} from "./reroute-types.ts";
import type { SignalAnalysis } from "./reroute-signal-analyzer.ts";
import { evaluateEscalationPolicy } from "./escalation-policy.ts";
import { ESCALATION } from "./reroute-thresholds.ts";

// ── Decision engine ───────────────────────────────────────────────────────────

export interface DecisionInput {
  metrics:         RuntimeMetricsSnapshot;
  analysis:        SignalAnalysis;
  escalationCount: number;
}

export function makeDecision(input: DecisionInput): RerouteDecision {
  const { metrics, analysis, escalationCount } = input;
  const now = Date.now();

  // Step 1: Nothing to do if no signals
  if (analysis.signals.length === 0) {
    return _maintain(metrics.currentMode, "No reroute signals detected", now);
  }

  // Step 2: Check minimum combined strength
  if (analysis.totalStrength < ESCALATION.MIN_STRENGTH_TO_ESCALATE) {
    return _maintain(
      metrics.currentMode,
      `Signal strength ${analysis.totalStrength.toFixed(2)} below threshold ${ESCALATION.MIN_STRENGTH_TO_ESCALATE}`,
      now,
    );
  }

  // Step 3: Evaluate policy
  const policy = evaluateEscalationPolicy(
    metrics.currentMode,
    analysis.activeKinds,
    escalationCount,
    metrics,
  );

  if (!policy.permitted || !policy.targetMode) {
    return _block(metrics.currentMode, policy.reason, now);
  }

  // Step 4: Calculate confidence
  const confidence = _calculateConfidence(analysis, escalationCount);

  if (confidence < ESCALATION.MIN_CONFIDENCE) {
    return _block(
      metrics.currentMode,
      `Confidence ${confidence.toFixed(2)} below minimum ${ESCALATION.MIN_CONFIDENCE}`,
      now,
    );
  }

  // Step 5: Determine urgency
  const urgency = _urgency(analysis.totalStrength);

  return {
    kind:           "ESCALATE",
    fromMode:       metrics.currentMode,
    toMode:         policy.targetMode,
    confidence,
    triggerSignals: analysis.activeKinds,
    reason:         policy.reason,
    urgency,
    decidedAt:      now,
  };
}

// ── Confidence calculation ────────────────────────────────────────────────────

function _calculateConfidence(
  analysis:        SignalAnalysis,
  escalationCount: number,
): number {
  // Base: proportional to combined signal strength
  let confidence = Math.min(0.95, analysis.totalStrength * 0.6);

  // Boost for multiple independent signals (more evidence = higher confidence)
  const signalBonus = Math.min(0.25, (analysis.signals.length - 1) * 0.08);
  confidence += signalBonus;

  // Penalty for repeated escalation (diminishing confidence with each escalation)
  const escalationPenalty = escalationCount * 0.10;
  confidence = Math.max(0, confidence - escalationPenalty);

  // Boost for dominant high-strength signal
  if (analysis.dominant && analysis.dominant.strength > 0.70) {
    confidence = Math.min(0.95, confidence + 0.10);
  }

  return confidence;
}

// ── Urgency mapping ───────────────────────────────────────────────────────────

function _urgency(
  totalStrength: number,
): RerouteDecision["urgency"] {
  if (totalStrength > 1.50) return "critical";
  if (totalStrength > 0.90) return "high";
  if (totalStrength > 0.50) return "medium";
  return "low";
}

// ── Factory helpers ───────────────────────────────────────────────────────────

function _maintain(
  mode:   OrchestrationMode,
  reason: string,
  now:    number,
): RerouteDecision {
  return {
    kind:           "MAINTAIN",
    fromMode:       mode,
    toMode:         null,
    confidence:     1.0,
    triggerSignals: [],
    reason,
    urgency:        "low",
    decidedAt:      now,
  };
}

function _block(
  mode:   OrchestrationMode,
  reason: string,
  now:    number,
): RerouteDecision {
  return {
    kind:           "BLOCK",
    fromMode:       mode,
    toMode:         null,
    confidence:     0,
    triggerSignals: [],
    reason,
    urgency:        "low",
    decidedAt:      now,
  };
}
