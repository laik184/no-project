import type { ParsedError, DiagnosticsReport } from '../types/diagnostics.types.ts';
import { classifyError } from './failure-classifier.ts';
import { deduplicateErrors, highestSeverity, summarizeErrors } from '../utils/diagnostics-utils.ts';
import { parseLines } from '../utils/parser-utils.ts';

const ERROR_LINE_PATTERN = /(?:error|exception|failed|cannot find).*$/im;

export function analyzeOutput(runId: string, output: string): ParsedError[] {
  const lines = parseLines(output);
  const errors: ParsedError[] = [];

  for (const line of lines) {
    if (ERROR_LINE_PATTERN.test(line)) {
      errors.push(classifyError(line));
    }
  }

  return deduplicateErrors(errors);
}

export function analyzeMultipleOutputs(
  runId:   string,
  outputs: string[],
): ParsedError[] {
  const all: ParsedError[] = outputs.flatMap((o) => analyzeOutput(runId, o));
  return deduplicateErrors(all);
}

export function buildDiagnosticsReport(
  runId:  string,
  errors: ParsedError[],
): DiagnosticsReport {
  const deduped   = deduplicateErrors(errors);
  const severity  = highestSeverity(deduped);
  const summary   = summarizeErrors(deduped);

  return {
    runId,
    errors:     deduped,
    rootCauses: [],
    summary,
    severity,
    generatedAt: new Date(),
  };
}
