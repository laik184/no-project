import { ValidationIssue, ValidationResult } from "../types";
import { computeScore, hasCriticalIssues } from "./scoring.util";

export function buildResult(
  issues: readonly ValidationIssue[],
  logs: readonly string[],
  error?: string
): ValidationResult {
  const score = computeScore(issues);
  const hasCritical = hasCriticalIssues(issues);
  const success = !error && !hasCritical && score >= 60;

  return Object.freeze({
    success,
    issues: Object.freeze([...issues]),
    score,
    logs: Object.freeze([...logs]),
    ...(error ? { error } : {}),
  });
}

export function buildErrorResult(
  error: string,
  logs: readonly string[]
): ValidationResult {
  return Object.freeze({
    success: false,
    issues: Object.freeze([]),
    score: 0,
    logs: Object.freeze([...logs]),
    error,
  });
}
