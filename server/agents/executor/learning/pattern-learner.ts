/**
 * server/agents/executor/learning/pattern-learner.ts
 *
 * Central learning intelligence engine.
 * Reads execution history + failure memory → extracts patterns →
 * writes learned intelligence to learning-store.
 * Advisory only — NEVER mutates orchestration or dispatcher.
 */

import type { TaskKind } from '../types/executor.types.ts';
import { executionHistory }                from '../memory/execution-history.ts';
import { failureMemory }                   from '../memory/failure-memory.ts';
import { learningStore }                   from './learning-store.ts';
import { learningGovernor }                from './learning-governor.ts';

// ── Recommendation ────────────────────────────────────────────────────────────

export type LearningStrategy =
  | 'retry-first'
  | 'rollback-first'
  | 'validation-heavy'
  | 'browser-first'
  | 'terminal-first'
  | 'standard';

export interface LearningRecommendation {
  strategy:          LearningStrategy;
  toolReliability:   Record<string, number>;   // toolName → 0–1
  riskMultiplier:    number;                   // 1.0 = baseline
  checkpointBefore:  boolean;
  rationale:         string;
}

// ── Outcome recording ─────────────────────────────────────────────────────────

export interface OutcomeRecord {
  runId:        string;
  taskId:       string;
  toolName:     string;
  kind:         TaskKind;
  outcome:      'success' | 'failure' | 'partial';
  retries:      number;
  recoveryUsed: boolean;
  errorText?:   string;
  durationMs:   number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _toolReliabilityKey(toolName: string): string { return `tool::${toolName}`; }
function _kindRiskKey(kind: TaskKind): string           { return `kind::${kind}`;    }

function _computeReliabilityDelta(outcome: 'success' | 'failure' | 'partial', retries: number): number {
  if (outcome === 'success' && retries === 0) return  0.05;
  if (outcome === 'success' && retries > 0)   return  0.02;
  if (outcome === 'partial')                  return  0.00;
  // failure
  if (retries >= 3) return -0.08;
  return -0.04;
}

function _computeRiskDelta(outcome: 'success' | 'failure' | 'partial'): number {
  if (outcome === 'success') return -0.03;   // lowers risk perception on success
  if (outcome === 'failure') return  0.06;   // raises risk on failure
  return 0.01;
}

// ── Module API ────────────────────────────────────────────────────────────────

export const patternLearner = {
  /** Record a task outcome and update learned patterns. */
  recordOutcome(record: OutcomeRecord): void {
    const { toolName, kind, outcome, retries, recoveryUsed } = record;

    // Update tool reliability
    const reliabilityKey    = _toolReliabilityKey(toolName);
    const currentReliability = learningStore.getValue('tool-reliability', reliabilityKey, 0.5);
    const rawDelta           = _computeReliabilityDelta(outcome, retries);
    const evidence           = (learningStore.get('tool-reliability', reliabilityKey)?.evidence ?? 0) + 1;
    const verdict            = learningGovernor.permitUpdate(reliabilityKey, currentReliability, rawDelta, evidence);
    if (verdict.permitted) {
      learningStore.upsert('tool-reliability', reliabilityKey, verdict.actualDelta, {
        toolName, lastOutcome: outcome, lastRetries: retries,
      });
    }

    // Update kind-level risk
    const riskKey     = _kindRiskKey(kind);
    const currentRisk = learningStore.getValue('workflow-risk', riskKey, 0.5);
    const riskDelta   = _computeRiskDelta(outcome);
    const riskEvidence = (learningStore.get('workflow-risk', riskKey)?.evidence ?? 0) + 1;
    const riskVerdict  = learningGovernor.permitUpdate(riskKey, currentRisk, riskDelta, riskEvidence);
    if (riskVerdict.permitted) {
      learningStore.upsert('workflow-risk', riskKey, riskVerdict.actualDelta, {
        kind, recoveryUsed: String(recoveryUsed),
      });
    }
  },

  /** Learn from a set of outcomes in a single batch (post-run). */
  learnPattern(records: OutcomeRecord[]): void {
    for (const r of records) this.recordOutcome(r);
  },

  /** Get recommended execution strategy for a given task kind + context. */
  getRecommendedStrategy(
    kind:     TaskKind,
    toolName: string,
    retryCount?: number,
  ): LearningRecommendation {
    const toolReliability = learningStore.getValue('tool-reliability', _toolReliabilityKey(toolName), 0.5);
    const kindRisk        = learningStore.getValue('workflow-risk',    _kindRiskKey(kind),             0.5);
    const chronicleCount  = failureMemory.chroniclePatterns().filter(p => p.toolName === toolName).length;

    // Determine strategy
    let strategy: LearningStrategy = 'standard';
    let rationale = 'No strong learned signal — using standard strategy';

    if (toolReliability < 0.3 || (retryCount ?? 0) >= 3) {
      strategy  = 'rollback-first';
      rationale = `Tool "${toolName}" reliability ${(toolReliability * 100).toFixed(0)}% — rollback-first preferred`;
    } else if (kind === 'browser' && toolReliability < 0.6) {
      strategy  = 'validation-heavy';
      rationale = `Browser kind with ${(toolReliability * 100).toFixed(0)}% reliability — heavy validation`;
    } else if (kind === 'verify') {
      strategy  = 'validation-heavy';
      rationale = 'Verify tasks always benefit from validation-heavy strategy';
    } else if (chronicleCount >= 2) {
      strategy  = 'rollback-first';
      rationale = `${chronicleCount} chronic failure patterns detected for "${toolName}"`;
    } else if (kind === 'terminal' && kindRisk > 0.65) {
      strategy  = 'terminal-first';
      rationale = `Terminal kind risk ${(kindRisk * 100).toFixed(0)}% — dedicated terminal-first strategy`;
    }

    // Build per-tool reliability snapshot
    const toolReliabilityMap: Record<string, number> = {};
    for (const entry of learningStore.byKind('tool-reliability')) {
      const name = String(entry.metadata?.toolName ?? entry.key.replace('tool::', ''));
      toolReliabilityMap[name] = entry.value;
    }

    return {
      strategy,
      toolReliability:  toolReliabilityMap,
      riskMultiplier:   kindRisk / 0.5,   // 1.0 = baseline
      checkpointBefore: kindRisk > 0.65 || toolReliability < 0.4,
      rationale,
    };
  },

  /** Get failure prediction for this tool + kind combination. */
  getFailurePrediction(toolName: string, kind: TaskKind): { probability: number; reason: string } {
    const reliability = learningStore.getValue('tool-reliability', _toolReliabilityKey(toolName), 0.5);
    const risk        = learningStore.getValue('workflow-risk',    _kindRiskKey(kind),             0.5);
    const isStorm     = failureMemory.isRetryStorm();
    const chronicleCount = failureMemory.chroniclePatterns().filter(p => p.toolName === toolName).length;

    let probability = (1 - reliability) * 0.5 + risk * 0.3;
    const reasons: string[] = [];

    if (isStorm)           { probability += 0.25; reasons.push('active retry storm'); }
    if (chronicleCount > 0){ probability += chronicleCount * 0.1; reasons.push(`${chronicleCount} chronic patterns`); }

    return {
      probability: Math.min(0.99, probability),
      reason: reasons.length ? reasons.join(', ') : `reliability=${(reliability * 100).toFixed(0)}%`,
    };
  },

  /** Get current learned tool reliability (0–1). */
  getToolReliability(toolName: string): number {
    return learningStore.getValue('tool-reliability', _toolReliabilityKey(toolName), 0.5);
  },

  /** Get current workflow risk for a kind (0–1). */
  getWorkflowRisk(kind: TaskKind): number {
    return learningStore.getValue('workflow-risk', _kindRiskKey(kind), 0.5);
  },

  /** Snapshot of all learned tool reliabilities. */
  allToolReliabilities(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const e of learningStore.byKind('tool-reliability')) {
      out[e.key] = e.value;
    }
    return out;
  },

  /** Reset all learned patterns. */
  reset(): void {
    learningStore.reset();
  },
};
