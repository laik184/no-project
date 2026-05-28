/**
 * server/agents/executor/learning/strategy-optimizer.ts
 *
 * Learns which execution strategies work best per workflow type.
 * Produces ranked strategy recommendations backed by historical outcomes.
 * Advisory only — never commands orchestration.
 */

import type { TaskKind } from '../types/executor.types.ts';
import { learningStore }    from './learning-store.ts';
import { learningGovernor } from './learning-governor.ts';

// ── Strategy types ────────────────────────────────────────────────────────────

export type ExecutionStrategy =
  | 'retry-first'
  | 'rollback-first'
  | 'validation-heavy'
  | 'browser-first'
  | 'terminal-first'
  | 'standard';

export interface StrategyScore {
  strategy:     ExecutionStrategy;
  score:        number;          // [0, 1] learned effectiveness
  evidence:     number;          // observations
  successRate:  number;          // empirical %
  avgRetries:   number;
  recommended:  boolean;
}

export interface StrategyRecommendation {
  primary:    ExecutionStrategy;
  fallback:   ExecutionStrategy;
  scores:     StrategyScore[];
  rationale:  string;
  confidence: number;
}

// ── Strategy outcome ──────────────────────────────────────────────────────────

export interface StrategyOutcome {
  strategy:    ExecutionStrategy;
  kind:        TaskKind;
  success:     boolean;
  retries:     number;
  durationMs:  number;
  rollbackUsed: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _strategyKey(strategy: ExecutionStrategy, kind: TaskKind): string {
  return `${strategy}::${kind}`;
}

function _successKey(strategy: ExecutionStrategy, kind: TaskKind): string {
  return `success::${strategy}::${kind}`;
}

const ALL_STRATEGIES: ExecutionStrategy[] = [
  'retry-first', 'rollback-first', 'validation-heavy',
  'browser-first', 'terminal-first', 'standard',
];

// ── Module API ────────────────────────────────────────────────────────────────

export const strategyOptimizer = {
  /** Record the outcome of using a given strategy. */
  recordStrategyOutcome(outcome: StrategyOutcome): void {
    const { strategy, kind, success, retries } = outcome;

    const key      = _strategyKey(strategy, kind);
    const current  = learningStore.getValue('strategy-weight', key, 0.5);
    const evidence = (learningStore.get('strategy-weight', key)?.evidence ?? 0) + 1;

    // Delta: success with few retries = positive, failure/many retries = negative
    let delta = 0;
    if (success && retries === 0) delta =  0.06;
    else if (success)             delta =  0.03;
    else if (!success && retries >= 3) delta = -0.07;
    else                          delta = -0.04;

    const verdict = learningGovernor.permitUpdate(key, current, delta, evidence);
    if (verdict.permitted) {
      learningStore.upsert('strategy-weight', key, verdict.actualDelta, {
        strategy, kind, lastSuccess: String(success), lastRetries: retries,
      });
    }

    // Track success rate separately for scoreStrategy()
    const sKey       = _successKey(strategy, kind);
    const sCurrent   = learningStore.getValue('execution-quality', sKey, 0.5);
    const sEvidence  = (learningStore.get('execution-quality', sKey)?.evidence ?? 0) + 1;
    const sDelta     = success ? 0.05 : -0.05;
    const sVerdict   = learningGovernor.permitUpdate(sKey, sCurrent, sDelta, sEvidence);
    if (sVerdict.permitted) {
      learningStore.upsert('execution-quality', sKey, sVerdict.actualDelta, { strategy, kind });
    }
  },

  /** Score a strategy for a given kind based on learned data. */
  scoreStrategy(strategy: ExecutionStrategy, kind: TaskKind): StrategyScore {
    const key       = _strategyKey(strategy, kind);
    const entry     = learningStore.get('strategy-weight', key);
    const score     = entry?.value ?? 0.5;
    const evidence  = entry?.evidence ?? 0;

    const sKey        = _successKey(strategy, kind);
    const successRate = learningStore.getValue('execution-quality', sKey, 0.5);

    // avgRetries: inferred from score (low score → high retries)
    const avgRetries = Math.round((1 - score) * 4);

    return {
      strategy,
      score,
      evidence,
      successRate: Math.round(successRate * 100),
      avgRetries,
      recommended: score >= 0.65 && evidence >= 3,
    };
  },

  /** Get the optimized strategy recommendation for a kind + context. */
  optimizeStrategy(
    kind:          TaskKind,
    retryCount?:   number,
    hasRollbacks?: boolean,
  ): StrategyRecommendation {
    const scores = ALL_STRATEGIES.map(s => this.scoreStrategy(s, kind));
    scores.sort((a, b) => b.score - a.score);

    let primary: ExecutionStrategy   = 'standard';
    let fallback: ExecutionStrategy  = 'retry-first';
    let rationale = 'No strong signal — using standard strategy';

    const top = scores[0];
    const sec = scores[1];

    if (top.evidence >= 3 && top.score > 0.6) {
      primary  = top.strategy;
      fallback = sec?.strategy ?? 'standard';
      rationale = `Learned: "${top.strategy}" has ${top.successRate}% success rate (${top.evidence} observations)`;
    } else {
      // Context-derived heuristic when evidence is thin
      if (kind === 'browser')    { primary = 'browser-first';    rationale = 'Browser kind → browser-first default'; }
      if (kind === 'terminal')   { primary = 'terminal-first';   rationale = 'Terminal kind → terminal-first default'; }
      if (kind === 'verify')     { primary = 'validation-heavy'; rationale = 'Verify kind → validation-heavy default'; }
      if ((retryCount ?? 0) >= 3){ primary = 'rollback-first';   rationale = `${retryCount} retries already → rollback-first`; }
      if (hasRollbacks)          { primary = 'rollback-first';   rationale = 'Rollbacks in history → rollback-first'; }
    }

    const topScore      = scores[0]?.score ?? 0.5;
    const totalEvidence = scores.reduce((s, sc) => s + sc.evidence, 0);
    const confidence    = Math.min(0.95, 0.3 + (totalEvidence * 0.02) + (topScore - 0.5) * 0.5);

    return { primary, fallback, scores, rationale, confidence };
  },

  /** Recommend a full workflow plan strategy based on task mix. */
  recommendWorkflowPlan(kinds: TaskKind[]): {
    recommendedOrder: TaskKind[];
    parallelSafe:     TaskKind[];
    rationale:        string;
  } {
    // Higher-risk kinds go last; verification always last
    const risk: Record<TaskKind, number> = {
      filesystem: 1, coding: 2, terminal: 3, browser: 4, verify: 5,
    };
    const sorted      = [...kinds].sort((a, b) => (risk[a] ?? 3) - (risk[b] ?? 3));
    const parallelSafe: TaskKind[] = ['filesystem', 'coding'];
    const safeInBatch  = kinds.filter(k => parallelSafe.includes(k));

    return {
      recommendedOrder: sorted,
      parallelSafe:     safeInBatch,
      rationale: `Ordered by risk: ${sorted.join(' → ')}; parallel-safe: [${safeInBatch.join(', ')}]`,
    };
  },

  /** All strategy scores for a kind. */
  allScoresForKind(kind: TaskKind): StrategyScore[] {
    return ALL_STRATEGIES.map(s => this.scoreStrategy(s, kind));
  },
};
