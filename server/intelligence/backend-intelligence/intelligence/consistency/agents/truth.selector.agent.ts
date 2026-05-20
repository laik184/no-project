import { normalizeScore, severityRank, severityWeight } from "../utils/compare.util.js";
import type {
  Conflict,
  ConsistencyInput,
  ConsistencySignal,
  FinalTruth,
  ValidationResult,
} from "../types.js";

function computeWeightedScore(signal: ConsistencySignal): number {
  const baseScore = signal.score === undefined ? signal.confidence : normalizeScore(signal.score);
  const rawScore = baseScore * 0.6 + signal.confidence * 0.4 + severityWeight(signal.severity) * 0.2;
  return Number(Math.max(0, Math.min(1, rawScore)).toFixed(6));
}

function isValidated(
  signal: ConsistencySignal,
  validationResults: readonly ValidationResult[],
): boolean {
  return validationResults.some(
    (result) =>
      result.module === signal.module
      && result.subject === signal.subject
      && result.valid,
  );
}

function pickWinner(signals: readonly ConsistencySignal[]): ConsistencySignal {
  return [...signals].sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const weightedDelta = computeWeightedScore(right) - computeWeightedScore(left);
    if (weightedDelta !== 0) {
      return weightedDelta;
    }

    return right.confidence - left.confidence;
  })[0];
}

export function selectTruth(
  input: ConsistencyInput,
  conflicts: readonly Conflict[],
  validationResults: readonly ValidationResult[],
): readonly FinalTruth[] {
  const bySubject = new Map<string, ConsistencySignal[]>();
  const conflictSubjects = new Set(conflicts.map((conflict) => conflict.subject));

  for (const signal of input.outputs) {
    if (!isValidated(signal, validationResults)) {
      continue;
    }

    const bucket = bySubject.get(signal.subject) ?? [];
    bucket.push(signal);
    bySubject.set(signal.subject, bucket);
  }

  const finalTruth: FinalTruth[] = [];

  for (const [subject, signals] of Array.from(bySubject.entries())) {
    if (signals.length === 0) {
      continue;
    }

    const winner = pickWinner(signals);

    finalTruth.push(
      Object.freeze({
        subject,
        status: winner.status,
        selectedModule: winner.module,
        confidence: winner.confidence,
        severity: winner.severity,
        supportingModules: Object.freeze(
          signals
            .map((signal) => signal.module)
            .filter((module) => module !== winner.module),
        ),
        weightedScore: computeWeightedScore(winner),
      }),
    );
  }

  return Object.freeze(
    finalTruth.sort((a, b) => {
      const aConflict = conflictSubjects.has(a.subject) ? 1 : 0;
      const bConflict = conflictSubjects.has(b.subject) ? 1 : 0;

      if (aConflict !== bConflict) {
        return bConflict - aConflict;
      }

      return a.subject.localeCompare(b.subject);
    }),
  );
}
