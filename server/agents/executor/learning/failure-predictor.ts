/**
 * server/agents/executor/learning/failure-predictor.ts
 *
 * Predicts likely failures BEFORE execution begins.
 * Reads learned patterns + historical signals to output risk assessment.
 * Advisory only — callers decide how to act on predictions.
 */

import type { TaskKind } from '../types/executor.types.ts';
import { executionHistory }     from '../memory/execution-history.ts';
import { failureMemory }        from '../memory/failure-memory.ts';
import { learningStore }        from './learning-store.ts';
import { patternLearner }       from './pattern-learner.ts';

// ── Input / Output ────────────────────────────────────────────────────────────

export interface PredictionInput {
  toolName:         string;
  kind:             TaskKind;
  subKind?:         string;
  goal?:            string;
  hasPackageChanges?: boolean;
  hasSchemaChanges?:  boolean;
  hasDestructiveOps?: boolean;
  estimatedDurationMs?: number;
}

export interface FailurePrediction {
  riskScore:               number;          // 0–100
  likelyFailures:          string[];
  recommendedMitigations:  string[];
  requiresCheckpoint:      boolean;
  requiresValidation:      boolean;
  confidence:              number;          // 0–1, how confident prediction is
  rationale:               string;
}

// ── Risk factors ──────────────────────────────────────────────────────────────

interface RiskFactor {
  name:       string;
  score:      number;
  mitigation: string;
}

function _gatherFactors(input: PredictionInput): RiskFactor[] {
  const factors: RiskFactor[] = [];

  // Tool reliability factor
  const reliability = patternLearner.getToolReliability(input.toolName);
  if (reliability < 0.4) {
    factors.push({
      name:       `low tool reliability (${(reliability * 100).toFixed(0)}%)`,
      score:      Math.round((0.5 - reliability) * 60),
      mitigation: `prefer alternative tool or add checkpoint before "${input.toolName}"`,
    });
  }

  // Historical failure class factor
  const histSummary = executionHistory.summary();
  const topFailure  = histSummary.topFailures[0];
  if (topFailure && topFailure.count >= 3) {
    factors.push({
      name:       `chronic error class: ${topFailure.toolName} (${topFailure.count}x)`,
      score:      Math.min(25, topFailure.count * 4),
      mitigation: `apply pre-emptive fix for ${topFailure.toolName}`,
    });
  }

  // Retry storm
  if (failureMemory.isRetryStorm()) {
    factors.push({
      name:       'active retry storm',
      score:      30,
      mitigation: 'delay execution and escalate to supervisor',
    });
  }

  // Chronic patterns for this tool
  const chronic = failureMemory.chroniclePatterns().filter(p => p.toolName === input.toolName);
  if (chronic.length > 0) {
    factors.push({
      name:       `${chronic.length} chronic failure pattern(s) for "${input.toolName}"`,
      score:      Math.min(30, chronic.length * 10),
      mitigation: 'rollback-first strategy + extended validation',
    });
  }

  // High-risk content factors
  if (input.hasPackageChanges) {
    factors.push({ name: 'package.json changes', score: 20, mitigation: 'checkpoint before install, verify after' });
  }
  if (input.hasSchemaChanges) {
    factors.push({ name: 'DB schema changes', score: 20, mitigation: 'checkpoint DB state, run migration tests' });
  }
  if (input.hasDestructiveOps) {
    factors.push({ name: 'destructive operations', score: 25, mitigation: 'require human approval or rollback plan' });
  }

  // Browser-specific risk
  if (input.kind === 'browser') {
    const browserRisk = patternLearner.getWorkflowRisk('browser');
    if (browserRisk > 0.6) {
      factors.push({
        name:       `browser instability (risk=${(browserRisk * 100).toFixed(0)}%)`,
        score:      Math.round((browserRisk - 0.5) * 60),
        mitigation: 'use filesystem alternative or add screenshot validation',
      });
    }
  }

  // Long duration risk
  if (input.estimatedDurationMs && input.estimatedDurationMs > 120_000) {
    factors.push({ name: 'long-running task (>2 min)', score: 10, mitigation: 'checkpoint halfway, monitor for deadlock' });
  }

  return factors;
}

// ── Predictor ─────────────────────────────────────────────────────────────────

export const failurePredictor = {
  /** Generate a full failure prediction for a task before execution. */
  predict(input: PredictionInput): FailurePrediction {
    const factors = _gatherFactors(input);

    const riskScore = Math.min(100, factors.reduce((sum, f) => sum + f.score, 0));
    const likelyFailures      = factors.map(f => f.name);
    const recommendedMitigations = factors.map(f => f.mitigation);

    // Confidence is proportional to available evidence
    const entry    = learningStore.get('tool-reliability', `tool::${input.toolName}`);
    const evidence = entry?.evidence ?? 0;
    const confidence = Math.min(0.95, 0.3 + evidence * 0.05);

    const requiresCheckpoint  = riskScore >= 40
      || input.hasDestructiveOps === true
      || input.hasSchemaChanges  === true
      || input.hasPackageChanges === true;
    const requiresValidation  = riskScore >= 25 || input.kind === 'browser' || input.kind === 'verify';

    const rationale = factors.length > 0
      ? `Risk factors: ${factors.map(f => f.name).join('; ')}`
      : `No significant risk signals for "${input.toolName}" (${input.kind})`;

    return {
      riskScore,
      likelyFailures,
      recommendedMitigations,
      requiresCheckpoint,
      requiresValidation,
      confidence,
      rationale,
    };
  },

  /** Quick risk score only (for hot-path use). */
  quickRisk(toolName: string, kind: TaskKind): number {
    const reliability = patternLearner.getToolReliability(toolName);
    const kindRisk    = patternLearner.getWorkflowRisk(kind);
    const storm       = failureMemory.isRetryStorm() ? 30 : 0;
    return Math.min(100, Math.round((1 - reliability) * 40 + kindRisk * 30 + storm));
  },

  /** Predict whether a rollback is likely needed. */
  predictRollback(toolName: string, kind: TaskKind): boolean {
    return this.quickRisk(toolName, kind) >= 50;
  },

  /** Get all current high-risk tools (reliability < 0.4). */
  highRiskTools(): Array<{ toolName: string; reliability: number; riskScore: number }> {
    const out: Array<{ toolName: string; reliability: number; riskScore: number }> = [];
    for (const entry of learningStore.byKind('tool-reliability')) {
      if (entry.value < 0.4) {
        const name = String(entry.metadata?.toolName ?? entry.key.replace('tool::', ''));
        out.push({ toolName: name, reliability: entry.value, riskScore: Math.round((1 - entry.value) * 100) });
      }
    }
    return out.sort((a, b) => b.riskScore - a.riskScore);
  },
};
