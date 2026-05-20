import { maxSeverity, scoreDifference } from "../utils/compare.util.js";
import type {
  ConflictDetectionResult,
  ConsistencyInput,
  ConsistencySignal,
  ConsistencyStatus,
} from "../types.js";

export function detectConflicts(input: ConsistencyInput): ConflictDetectionResult {
  const bySubject = new Map<string, ConsistencySignal[]>();

  for (const signal of input.outputs) {
    const bucket = bySubject.get(signal.subject) ?? [];
    bucket.push(signal);
    bySubject.set(signal.subject, bucket);
  }

  const conflicts = [];

  for (const [subject, signals] of Array.from(bySubject.entries())) {
    const uniqueStatuses = Array.from(
      new Set(signals.map((signal) => signal.status)),
    ) as ConsistencyStatus[];

    if (uniqueStatuses.length <= 1) {
      continue;
    }

    const confidences = signals.map((signal) => signal.confidence);
    const spread = Math.max(...confidences) - Math.min(...confidences);

    conflicts.push(
      Object.freeze({
        subject,
        statuses: Object.freeze([...uniqueStatuses]),
        modules: Object.freeze(signals.map((signal) => signal.module)),
        severity: maxSeverity(signals),
        confidenceSpread: scoreDifference(Math.max(...confidences), Math.min(...confidences)) || spread,
      }),
    );
  }

  return Object.freeze({
    hasConflict: conflicts.length > 0,
    conflicts: Object.freeze(conflicts),
  });
}
