/**
 * diagnostics/error-analyzer.ts
 * Analyzes raw error output and classifies error lines.
 * Called by server/tools/verifier/diagnostics/error-analyzer.ts and runtime-log-parser.ts.
 */

import type { ParsedError, DiagnosticsReport } from '../types/diagnostics.types.ts';
import { classifyError } from './error-classifier.ts';

export function analyzeOutput(runId: string, output: string): ParsedError[] {
  const lines = output.split('\n').map((l) => l.trim()).filter(Boolean);
  const errors: ParsedError[] = [];
  for (const line of lines) {
    if (!/error|fail|warn|exception/i.test(line)) continue;
    errors.push(classifyError(line));
  }
  return errors;
}

export function analyzeMultipleOutputs(runId: string, outputs: string[]): ParsedError[] {
  return outputs.flatMap((o) => analyzeOutput(runId, o));
}

export function buildDiagnosticsReport(runId: string, errors: ParsedError[]): DiagnosticsReport {
  const fatal    = errors.filter((e) => e.severity === 'fatal');
  const hasError = errors.some((e) => e.severity === 'error' || e.severity === 'fatal');
  const severity = fatal.length > 0 ? 'fatal' : hasError ? 'error' : 'warning';

  return {
    runId,
    errors,
    rootCauses:  [],
    summary:     errors.length === 0 ? 'No errors' : `${errors.length} error(s) found`,
    severity,
    generatedAt: new Date(),
  };
}
