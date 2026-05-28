/**
 * server/agents/executor/learning/feedback-loop.ts
 *
 * Closes the learning cycle: execute → validate → score → learn → optimize.
 * Hard-governed: all updates pass through learning-governor.
 * Prevents runaway adaptation, recursive mutation, governance bypass.
 */

import type { TaskKind } from '../types/executor.types.ts';
import { scoreExecution, summariseScore }  from './execution-scorer.ts';
import type { ExecutionScoringInput }      from './execution-scorer.ts';
import { patternLearner }                  from './pattern-learner.ts';
import type { OutcomeRecord }              from './pattern-learner.ts';
import { toolSelectionEngine }             from './tool-selection-engine.ts';
import { strategyOptimizer }               from './strategy-optimizer.ts';
import type { ExecutionStrategy }          from './strategy-optimizer.ts';
import { learningGovernor }                from './learning-governor.ts';
import { learningStore }                   from './learning-store.ts';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface FeedbackRecord {
  runId:             string;
  strategy:          ExecutionStrategy;
  taskOutcomes:      OutcomeRecord[];
  scoringInput:      ExecutionScoringInput;
  activeKinds:       TaskKind[];
}

export interface FeedbackResult {
  score:           ReturnType<typeof scoreExecution>;
  patternsLearned: number;
  storeVersion:    number;
  rationale:       string;
  blocked:         boolean;
}

// ── Safety limits ─────────────────────────────────────────────────────────────

let _lastCycleMs     = 0;
const MIN_CYCLE_GAP  = 2_000;   // minimum 2 s between feedback cycles
let _cyclesThisHour  = 0;
let _hourWindowStart = Date.now();
const MAX_CYCLES_HOUR = 500;   // hard cap — prevents runaway learning

// ── Module API ────────────────────────────────────────────────────────────────

export const feedbackLoop = {
  /**
   * Run a complete feedback cycle for a finished execution run.
   * Scores the run, updates pattern learner, tool selection, strategy optimizer.
   * All updates are governor-gated.
   */
  process(record: FeedbackRecord): FeedbackResult {
    const now = Date.now();

    // ── Safety: cycle rate limiting ───────────────────────────────────────────
    if (now - _lastCycleMs < MIN_CYCLE_GAP) {
      return {
        score:           scoreExecution(record.scoringInput),
        patternsLearned: 0,
        storeVersion:    learningStore.version(),
        rationale:       `Cycle skipped — min gap ${MIN_CYCLE_GAP}ms not elapsed`,
        blocked:         true,
      };
    }

    // ── Safety: hourly cap ────────────────────────────────────────────────────
    if (now - _hourWindowStart > 3_600_000) {
      _cyclesThisHour  = 0;
      _hourWindowStart = now;
    }
    if (_cyclesThisHour >= MAX_CYCLES_HOUR) {
      return {
        score:           scoreExecution(record.scoringInput),
        patternsLearned: 0,
        storeVersion:    learningStore.version(),
        rationale:       `Cycle blocked — hourly cap ${MAX_CYCLES_HOUR} reached`,
        blocked:         true,
      };
    }

    // ── Governance boundary check ─────────────────────────────────────────────
    // Advisory assertion — ensures this module never mutates forbidden systems
    learningGovernor.assertBoundary('feedback-loop', 'non-learning-system');

    _lastCycleMs = now;
    _cyclesThisHour++;

    // ── Step 1: Score the execution ───────────────────────────────────────────
    const score = scoreExecution(record.scoringInput);

    // ── Step 2: Learn from task outcomes ──────────────────────────────────────
    patternLearner.learnPattern(record.taskOutcomes);

    // ── Step 3: Record tool outcomes ──────────────────────────────────────────
    for (const o of record.taskOutcomes) {
      toolSelectionEngine.recordToolOutcome({
        toolName:   o.toolName,
        kind:       o.kind,
        subKind:    'default',
        success:    o.outcome === 'success',
        retries:    o.retries,
        durationMs: o.durationMs,
      });
    }

    // ── Step 4: Record strategy outcome ───────────────────────────────────────
    for (const kind of record.activeKinds) {
      strategyOptimizer.recordStrategyOutcome({
        strategy:    record.strategy,
        kind,
        success:     score.executionScore >= 60,
        retries:     record.scoringInput.totalRetries,
        durationMs:  record.scoringInput.actualDurationMs,
        rollbackUsed: record.scoringInput.rollbackCount > 0,
      });
    }

    // ── Step 5: Write execution quality entry ─────────────────────────────────
    const qualityKey = `run::${record.runId}`;
    const normalised = score.feedbackDelta;
    const qCurrent   = learningStore.getValue('execution-quality', qualityKey, 0.5);
    const qEvidence  = (learningStore.get('execution-quality', qualityKey)?.evidence ?? 0) + 1;
    const qVerdict   = learningGovernor.permitUpdate(qualityKey, qCurrent, normalised, qEvidence);
    if (qVerdict.permitted) {
      learningStore.upsert('execution-quality', qualityKey, qVerdict.actualDelta, {
        grade: score.grade, executionScore: score.executionScore,
      });
    }

    const patternsLearned = record.taskOutcomes.length;

    return {
      score,
      patternsLearned,
      storeVersion:  learningStore.version(),
      rationale:     `${summariseScore(score)} — ${patternsLearned} task outcomes learned`,
      blocked:       false,
    };
  },

  /** Stats for observability. */
  stats() {
    return {
      cyclesThisHour:  _cyclesThisHour,
      maxCyclesHour:   MAX_CYCLES_HOUR,
      lastCycleMs:     _lastCycleMs,
      governorStats:   learningGovernor.stats(),
      storeSize:       learningStore.size(),
      storeVersion:    learningStore.version(),
    };
  },

  reset(): void {
    _lastCycleMs     = 0;
    _cyclesThisHour  = 0;
    _hourWindowStart = Date.now();
  },
};
