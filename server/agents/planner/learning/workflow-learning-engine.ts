/**
 * server/agents/planner/learning/workflow-learning-engine.ts
 *
 * Learns workflow optimization patterns across runs.
 * Advises task-graph-builder, risk-estimator, dependency-analyzer.
 * Advisory only — never mutates planner internals.
 */

import type { TaskKind } from '../../executor/types/executor.types.ts';
import { learningStore }    from '../../executor/learning/learning-store.ts';
import { learningGovernor } from '../../executor/learning/learning-governor.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkflowOutcome {
  planId:        string;
  taskCount:     number;
  parallelWaves: number;
  totalPhases:   number;
  kinds:         TaskKind[];
  success:       boolean;
  totalRetries:  number;
  durationMs:    number;
  checkpointsHit: number;
  rollbacksUsed:  number;
}

export interface WorkflowOptimizationHint {
  suggestEarlierValidation:  boolean;
  suggestMoreParallelism:    boolean;
  suggestCheckpoints:        string[];   // phase or task IDs that benefit from checkpoints
  riskMultiplier:            number;     // 1.0 = baseline
  recommendedWaveSize:       number;     // optimal tasks per wave
  rationale:                 string;
}

// ── Store keys ────────────────────────────────────────────────────────────────

function _kindMixKey(kinds: TaskKind[]): string {
  return `mix::${[...new Set(kinds)].sort().join('-')}`;
}

function _waveKey(): string { return 'wave::optimal-size'; }
function _checkpointKey(kindMix: string): string { return `checkpoint::${kindMix}`; }

// ── Module API ────────────────────────────────────────────────────────────────

export const workflowLearningEngine = {
  /** Record a workflow outcome for learning. */
  recordWorkflowOutcome(outcome: WorkflowOutcome): void {
    const { kinds, success, parallelWaves, taskCount, totalRetries, rollbacksUsed } = outcome;

    // Wave efficiency learning
    if (parallelWaves > 0 && taskCount > 0 && success) {
      const waveSize  = Math.round(taskCount / parallelWaves);
      const waveKey   = _waveKey();
      const current   = learningStore.getValue('execution-quality', waveKey, 0.5);
      const evidence  = (learningStore.get('execution-quality', waveKey)?.evidence ?? 0) + 1;
      const delta     = success && totalRetries === 0 ? 0.04 : success ? 0.01 : -0.03;
      const verdict   = learningGovernor.permitUpdate(waveKey, current, delta, evidence);
      if (verdict.permitted) {
        learningStore.upsert('execution-quality', waveKey, verdict.actualDelta, { waveSize, parallelWaves });
      }
    }

    // Kind-mix risk learning
    const mixKey   = _kindMixKey(kinds);
    const current  = learningStore.getValue('workflow-risk', mixKey, 0.5);
    const evidence = (learningStore.get('workflow-risk', mixKey)?.evidence ?? 0) + 1;
    const riskDelta = !success ? 0.06 : rollbacksUsed > 0 ? 0.02 : -0.03;
    const verdict   = learningGovernor.permitUpdate(mixKey, current, riskDelta, evidence);
    if (verdict.permitted) {
      learningStore.upsert('workflow-risk', mixKey, verdict.actualDelta, {
        kinds: kinds.join(','), success: String(success), rollbacksUsed,
      });
    }

    // Checkpoint effectiveness
    const cpKey      = _checkpointKey(mixKey);
    const cpCurrent  = learningStore.getValue('workflow-risk', cpKey, 0.5);
    const cpEvidence = (learningStore.get('workflow-risk', cpKey)?.evidence ?? 0) + 1;
    const cpDelta    = outcome.checkpointsHit > 0 && success ? -0.02 : !success ? 0.04 : 0;
    if (cpDelta !== 0) {
      const cpVerdict = learningGovernor.permitUpdate(cpKey, cpCurrent, cpDelta, cpEvidence);
      if (cpVerdict.permitted) {
        learningStore.upsert('workflow-risk', cpKey, cpVerdict.actualDelta, {
          checkpointsHit: outcome.checkpointsHit, success: String(success),
        });
      }
    }
  },

  /** Get optimization hints for a planned workflow. */
  getOptimizationHints(
    kinds:          TaskKind[],
    taskCount:      number,
    currentWaves:   number,
  ): WorkflowOptimizationHint {
    const mixKey     = _kindMixKey(kinds);
    const mixRisk    = learningStore.getValue('workflow-risk', mixKey, 0.5);
    const waveEntry  = learningStore.get('execution-quality', _waveKey());

    // Suggest earlier validation if verify tasks at end historically fail
    const verifyRisk = learningStore.getValue('workflow-risk', 'kind::verify', 0.5);
    const suggestEarlierValidation = verifyRisk > 0.6;

    // Suggest more parallelism if current wave count is lower than learned optimal
    const learnedWaveSize  = waveEntry ? Number(waveEntry.metadata?.waveSize ?? 3) : 3;
    const currentWaveSize  = currentWaves > 0 ? taskCount / currentWaves : taskCount;
    const suggestMoreParallelism = currentWaveSize > learnedWaveSize * 1.5;

    // Checkpoint suggestions for high-risk kind combos
    const suggestCheckpoints: string[] = [];
    if (mixRisk > 0.6) suggestCheckpoints.push('before-terminal-phase');
    if (kinds.includes('browser') && learningStore.getValue('workflow-risk', 'kind::browser', 0.5) > 0.6) {
      suggestCheckpoints.push('before-browser-phase');
    }
    if (kinds.includes('verify')) suggestCheckpoints.push('before-verify-phase');

    const riskMultiplier      = mixRisk / 0.5;
    const recommendedWaveSize = Math.max(2, Math.min(8, learnedWaveSize));

    const rationale = [
      `kind-mix risk=${(mixRisk * 100).toFixed(0)}%`,
      suggestEarlierValidation ? 'earlier validation recommended' : null,
      suggestMoreParallelism   ? `increase parallelism (wave size ${recommendedWaveSize})` : null,
    ].filter(Boolean).join('; ') || 'No optimization signals';

    return {
      suggestEarlierValidation,
      suggestMoreParallelism,
      suggestCheckpoints,
      riskMultiplier,
      recommendedWaveSize,
      rationale,
    };
  },

  /** Get learned risk score for a kind-mix (0–1). */
  getKindMixRisk(kinds: TaskKind[]): number {
    return learningStore.getValue('workflow-risk', _kindMixKey(kinds), 0.5);
  },

  /** All workflow risk entries. */
  allWorkflowRisks(): Array<{ key: string; risk: number; evidence: number }> {
    return learningStore.byKind('workflow-risk').map(e => ({
      key:      e.key,
      risk:     e.value,
      evidence: e.evidence,
    }));
  },
};
