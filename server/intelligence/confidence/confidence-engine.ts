/**
 * confidence-engine.ts  v1.0.0
 *
 * Central facade for the Agent Confidence System.
 * All external callers (orchestration, retry, routing) interact with this
 * single entry point — never with individual sub-modules directly.
 *
 * Lifecycle per execution:
 *   1. ensureRegistered   — register agent if first time seen
 *   2. analyzeQuality     — build ExecutionQualityDimensions
 *   3. detectHallucination — compute hallucinationRisk
 *   4. score              — compute confidenceScore via confidence-scorer
 *   5. evaluatePolicies   — apply rules, apply penalties, possible block
 *   6. recordOutcome      — update EWMA reliability store
 *   7. upsertRecord       — commit final record to confidence-store
 *   8. emit telemetry     — all counters / bus events
 *   9. persist (async)    — write to .nura/confidence/ when sandboxPath given
 */

import type {
  AgentConfidenceRecord,
  ExecutionOutcome,
  ScoringInput,
} from "./confidence-types.ts";
import { scoreToState }                from "./confidence-thresholds.ts";
import { scoreExecution }              from "./confidence-scorer.ts";
import { ensureRegistered }            from "./confidence-registry.ts";
import { evaluatePolicies }            from "./confidence-policies.ts";
import { recordOutcome }               from "./reliability-tracker.ts";
import { computeReliabilityScore }     from "./stores/reliability-store.ts";
import { upsertConfidence, getConfidence, isAgentBlocked } from "./stores/confidence-store.ts";
import {
  analyzeExecutionQuality,
  defaultQualityDimensions,
  type QualityAnalysisInput,
} from "./execution-quality-analyzer.ts";
import {
  detectHallucinations,
  type HallucinationAnalysisInput,
} from "./hallucination-detector.ts";
import {
  emitConfidenceUpdated,
  emitHallucinationDetected,
} from "./confidence-events.ts";
import {
  telemetryConfidenceScored,
  telemetryHallucinationDetected,
  telemetryPolicyViolation,
  telemetryStateTransition,
  telemetryExecutionDuration,
} from "./confidence-telemetry.ts";
import { persistConfidence } from "./confidence-memory-bridge.ts";
import { decideRetry, type RetryIntelligenceInput } from "./retry-intelligence.ts";
import { resolveConflict, type ConflictInput } from "./conflict-confidence-resolver.ts";

// ── Input for recording a completed execution ─────────────────────────────────

export interface RecordExecutionInput {
  agentId:            string;
  role:               string;
  category?:          string;
  runId:              string;
  taskId:             string;
  latencyMs:          number;
  finalOutcome:       ExecutionOutcome;
  verificationPassed: boolean;
  runtimeFailures:    number;
  retries:            number;
  policyViolations:   number;
  quality?:           QualityAnalysisInput;
  hallucination?:     HallucinationAnalysisInput;
  sandboxPath?:       string;
}

// ── Main engine ───────────────────────────────────────────────────────────────

export const confidenceEngine = {
  /**
   * Record a completed agent execution and update all confidence signals.
   * Returns the final AgentConfidenceRecord.
   */
  async recordExecution(input: RecordExecutionInput): Promise<AgentConfidenceRecord> {
    const {
      agentId, role, category, runId, taskId,
      latencyMs, finalOutcome, verificationPassed,
      runtimeFailures, retries, policyViolations,
    } = input;

    // 1. Ensure registration
    ensureRegistered(agentId, role, category);

    // 2. Execution quality
    const qualityDims = input.quality
      ? analyzeExecutionQuality(input.quality)
      : defaultQualityDimensions(verificationPassed);

    // 3. Hallucination detection
    let hallucinationRisk = 0;
    if (input.hallucination) {
      const halResult = detectHallucinations(input.hallucination);
      hallucinationRisk = halResult.compositeRisk;
      for (const signal of halResult.signals) {
        emitHallucinationDetected(runId, agentId, signal);
        telemetryHallucinationDetected(agentId, signal);
      }
    }

    // 4. Historical reliability (before recording this run)
    const historicalReliability = computeReliabilityScore(agentId);

    // 5. Score
    const scoringInput: ScoringInput = {
      agentId, role, runId, taskId,
      verificationPassed,
      runtimeFailures,
      retries,
      latencyMs,
      policyViolations,
      hallucinationRisk,
      executionQuality: qualityDims,
      historicalReliability,
    };

    const { confidenceScore } = scoreExecution(scoringInput);
    const state               = scoreToState(confidenceScore);

    // 6. Build candidate record
    const record: AgentConfidenceRecord = {
      agentId,
      role,
      runId,
      taskId,
      confidenceScore,
      reliabilityScore:   historicalReliability,
      hallucinationRisk,
      executionQuality:   (
        qualityDims.verificationSuccess * 0.4 +
        qualityDims.runtimeStability    * 0.3 +
        qualityDims.codeQuality         * 0.2 +
        qualityDims.policyCompliance    * 0.1
      ),
      verificationPassed,
      retries,
      runtimeFailures,
      policyViolations,
      latencyScore:       qualityDims.runtimeStability,
      finalOutcome,
      state,
      ts: Date.now(),
    };

    // 7. Commit to store
    upsertConfidence(record);

    // 8. Policy evaluation (may mutate store + emit block events)
    const prevState = getConfidence(agentId)?.state ?? state;
    const policyResult = evaluatePolicies(record);

    if (policyResult.violationsFound.length > 0) {
      telemetryPolicyViolation(agentId, policyResult.violationsFound, policyResult.penaltyApplied);
    }
    if (policyResult.stateTransition && policyResult.stateTransition !== prevState) {
      telemetryStateTransition(agentId, prevState, policyResult.stateTransition);
    }

    // 9. Record in reliability history + update EWMA
    recordOutcome({
      agentId,
      runId,
      success:            finalOutcome === "SUCCESS" || finalOutcome === "PARTIAL",
      verificationPassed,
      hallucinationRisk,
      retries,
      latencyMs,
    });

    // 10. Telemetry
    const finalRecord = getConfidence(agentId) ?? record;
    telemetryConfidenceScored(finalRecord);
    telemetryExecutionDuration(agentId, latencyMs);
    emitConfidenceUpdated(finalRecord);

    // 11. Async persist (fire-and-forget)
    if (input.sandboxPath) {
      persistConfidence(input.sandboxPath).catch(() => void 0);
    }

    return finalRecord;
  },

  // ── Delegation proxies (thin wrappers for import convenience) ──────────────

  decideRetry(input: RetryIntelligenceInput) {
    return decideRetry(input);
  },

  resolveConflict(input: ConflictInput) {
    return resolveConflict(input);
  },

  getRecord(agentId: string) {
    return getConfidence(agentId);
  },

  isBlocked(agentId: string): boolean {
    return isAgentBlocked(agentId);
  },
};
