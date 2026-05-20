import type { ExecutionResult, EvaluationResult, Issue, IssueCode, Severity } from '../types.ts';
import { penaltyFromIssues, scoreFromPenalty } from '../utils/scoring.util.ts';
import { sortBySeverity, deduplicateIssues, topSeverity } from '../utils/issue-normalizer.util.ts';

function detectEmptyOutput(result: ExecutionResult): Issue | null {
  const out = result.output;
  if (out === null || out === undefined) {
    return { code: 'EMPTY_RESULT', message: 'Output is null or undefined', severity: 'critical' };
  }
  if (typeof out === 'string' && out.trim().length === 0) {
    return { code: 'EMPTY_RESULT', message: 'Output is an empty string', severity: 'high' };
  }
  if (Array.isArray(out) && out.length === 0) {
    return { code: 'EMPTY_RESULT', message: 'Output array is empty', severity: 'medium' };
  }
  return null;
}

function detectIncompleteOutput(result: ExecutionResult): Issue | null {
  const out = result.output;
  if (typeof out === 'object' && out !== null) {
    const keys = Object.keys(out as Record<string, unknown>);
    if (keys.length === 0) {
      return { code: 'INCOMPLETE_OUTPUT', message: 'Output object has no fields', severity: 'high' };
    }
    const required = (result.metadata?.requiredFields as string[] | undefined) ?? [];
    const missing = required.filter((k) => !(k in (out as Record<string, unknown>)));
    if (missing.length > 0) {
      return {
        code: 'INCOMPLETE_OUTPUT',
        message: `Missing required fields: ${missing.join(', ')}`,
        severity: 'high',
        field: missing.join(','),
      };
    }
  }
  return null;
}

function detectContractViolation(result: ExecutionResult): Issue | null {
  const contract = result.metadata?.outputContract as Record<string, string> | undefined;
  if (!contract) return null;
  const out = result.output as Record<string, unknown>;
  for (const [field, expectedType] of Object.entries(contract)) {
    const actual = typeof out[field];
    if (actual !== expectedType) {
      return {
        code: 'CONTRACT_VIOLATION',
        message: `Field "${field}" expected ${expectedType}, got ${actual}`,
        severity: 'high',
        field,
      };
    }
  }
  return null;
}

function detectLogicalErrors(result: ExecutionResult): Issue | null {
  const meta = result.metadata ?? {};
  if (meta['error']) {
    return {
      code: 'LOGICAL_ERROR',
      message: String(meta['error']),
      severity: 'high',
      context: 'metadata.error',
    };
  }
  if (typeof result.output === 'object' && result.output !== null) {
    const out = result.output as Record<string, unknown>;
    if (out['success'] === false && out['error']) {
      return {
        code: 'LOGICAL_ERROR',
        message: String(out['error']),
        severity: 'high',
        context: 'output.error',
      };
    }
  }
  return null;
}

function detectTimeout(result: ExecutionResult): Issue | null {
  const maxMs = (result.metadata?.timeoutMs as number | undefined) ?? 30000;
  if (result.durationMs > maxMs) {
    return {
      code: 'TIMEOUT',
      message: `Execution took ${result.durationMs}ms, exceeded limit ${maxMs}ms`,
      severity: 'medium',
    };
  }
  return null;
}

export function evaluateOutput(result: ExecutionResult): EvaluationResult {
  const rawIssues: (Issue | null)[] = [
    detectEmptyOutput(result),
    detectIncompleteOutput(result),
    detectContractViolation(result),
    detectLogicalErrors(result),
    detectTimeout(result),
  ];

  const issues = deduplicateIssues(
    sortBySeverity(rawIssues.filter((i): i is Issue => i !== null)),
  );

  const penalty = penaltyFromIssues(issues);
  const score = scoreFromPenalty(penalty);
  const severity = topSeverity(issues);
  const passed = issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length === 0;

  return Object.freeze({
    issues,
    score,
    severity,
    passed,
    evaluatedAt: Date.now(),
  });
}
