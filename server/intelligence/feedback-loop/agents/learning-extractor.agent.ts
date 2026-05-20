import type { EvaluationResult, LearningInsight, LearningCategory, IssueCode } from '../types.ts';

interface PatternAccumulator {
  count: number;
  totalScore: number;
  category: LearningCategory;
}

const PATTERN_CATEGORY_MAP: Record<IssueCode, LearningCategory> = {
  LOGICAL_ERROR: 'error',
  INCOMPLETE_OUTPUT: 'quality',
  CONTRACT_VIOLATION: 'quality',
  SCHEMA_MISMATCH: 'quality',
  EMPTY_RESULT: 'error',
  TIMEOUT: 'performance',
  UNKNOWN: 'error',
};

const PATTERN_RECOMMENDATION_MAP: Record<IssueCode, string> = {
  LOGICAL_ERROR: 'Add pre-execution input validation and guard clauses to prevent logic failures',
  INCOMPLETE_OUTPUT: 'Enforce output completeness checks before returning from agent',
  CONTRACT_VIOLATION: 'Add schema validation middleware at agent output boundary',
  SCHEMA_MISMATCH: 'Define strict TypeScript output contracts and validate at runtime',
  EMPTY_RESULT: 'Add non-null guards and default output fallbacks in agent logic',
  TIMEOUT: 'Profile agent execution and apply caching or parallelism where possible',
  UNKNOWN: 'Increase observability with structured logging to classify unknown errors',
};

function buildPatternLabel(code: IssueCode): string {
  const labels: Record<IssueCode, string> = {
    LOGICAL_ERROR: 'Recurring logical error in agent output',
    INCOMPLETE_OUTPUT: 'Output consistently missing required fields',
    CONTRACT_VIOLATION: 'Output violating declared type contract',
    SCHEMA_MISMATCH: 'Output schema does not match expected structure',
    EMPTY_RESULT: 'Agent producing empty or null output',
    TIMEOUT: 'Agent execution frequently exceeding time limits',
    UNKNOWN: 'Unclassified failure pattern detected',
  };
  return labels[code] ?? 'Unknown pattern';
}

export function extractLearning(history: EvaluationResult[]): LearningInsight[] {
  if (history.length === 0) return [];

  const accumulator: Map<IssueCode, PatternAccumulator> = new Map();

  for (const evaluation of history) {
    for (const issue of evaluation.issues) {
      const existing = accumulator.get(issue.code);
      if (existing) {
        existing.count += 1;
        existing.totalScore += evaluation.score;
      } else {
        accumulator.set(issue.code, {
          count: 1,
          totalScore: evaluation.score,
          category: PATTERN_CATEGORY_MAP[issue.code] ?? 'error',
        });
      }
    }
  }

  const insights: LearningInsight[] = [];

  for (const [code, data] of accumulator.entries()) {
    const avgScore = data.totalScore / data.count;
    const frequency = data.count / history.length;
    const confidence = Math.min(frequency * (1 - avgScore), 1);

    insights.push(
      Object.freeze({
        pattern: buildPatternLabel(code),
        frequency: Math.round(frequency * 100) / 100,
        recommendation: PATTERN_RECOMMENDATION_MAP[code] ?? 'Investigate and fix root cause',
        category: data.category,
        confidence: Math.round(confidence * 100) / 100,
      }),
    );
  }

  return insights.sort((a, b) => b.confidence - a.confidence);
}
