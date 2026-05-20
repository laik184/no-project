import { normalizeScore } from "../utils/compare.util.js";
import type {
  ConsistencyInput,
  ConsistencySignal,
  ValidationResult,
} from "../types.js";

function validateSignalStructure(signal: ConsistencySignal): readonly string[] {
  const issues: string[] = [];

  if (!signal.module.trim()) {
    issues.push("module is required");
  }

  if (!signal.subject.trim()) {
    issues.push("subject is required");
  }

  if (!Array.isArray(signal.reasons)) {
    issues.push("reasons must be an array");
  }

  return issues;
}

function validateSignalScore(signal: ConsistencySignal): readonly string[] {
  const issues: string[] = [];

  if (signal.confidence < 0 || signal.confidence > 1) {
    issues.push("confidence must be between 0 and 1");
  }

  if (signal.score !== undefined && normalizeScore(signal.score) !== signal.score) {
    issues.push("score must be between 0 and 1 when provided");
  }

  return issues;
}

export function validateOutputs(input: ConsistencyInput): readonly ValidationResult[] {
  return Object.freeze(
    input.outputs.map((signal) => {
      const issues = [
        ...validateSignalStructure(signal),
        ...validateSignalScore(signal),
      ];

      return Object.freeze({
        module: signal.module,
        subject: signal.subject,
        valid: issues.length === 0,
        issues: Object.freeze(issues),
      });
    }),
  );
}
