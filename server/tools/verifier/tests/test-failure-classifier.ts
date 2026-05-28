import { analyzeTestFailures, failuresToParsedErrors } from '../lib/test-failure-analyzer.ts';
import { parseTestOutput }                              from '../lib/test-result-parser.ts';
import type { ParsedError }                             from '../shared/verifier-types.ts';
import type { ToolDefinition }                          from '../../registry/tool-types.ts';
import { toToolOk }                                     from '../shared/verifier-result.ts';

export { analyzeTestFailures, failuresToParsedErrors };

export function classifyTestFailures(rawOutput: string): { errors: ParsedError[]; count: number } {
  const parsed   = parseTestOutput(rawOutput);
  const failures = analyzeTestFailures(parsed);
  const errors   = failuresToParsedErrors(failures);
  return { errors, count: errors.length };
}

export const testFailureClassifierTool: ToolDefinition = {
  name:        'classify_test_failures',
  category:    'verifier',
  description: 'Classify test failures into structured errors',
  inputSchema: {
    output: { type: 'string', description: 'Raw test output', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = classifyTestFailures(input.output as string);
    return toToolOk(result, Date.now() - start);
  },
};
