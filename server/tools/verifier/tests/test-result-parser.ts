import {
  parseTestOutput,
  isTestRunPassed,
  type ParsedTestResults,
} from '../../../agents/verifier/testing/test-result-parser.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';
import { toToolOk }            from '../shared/verifier-result.ts';

export { parseTestOutput, isTestRunPassed };
export type { ParsedTestResults };

export function testSummary(parsed: ParsedTestResults): string {
  const parts = [`${parsed.passed} passed`, `${parsed.failed} failed`];
  if (parsed.skipped) parts.push(`${parsed.skipped} skipped`);
  return parts.join(', ');
}

export const testResultParserTool: ToolDefinition = {
  name:        'parse_test_results',
  category:    'verifier',
  description: 'Parse test output into structured results',
  inputSchema: {
    output: { type: 'string', description: 'Raw test output', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const parsed = parseTestOutput(input.output as string);
    return toToolOk({ ...parsed, summary: testSummary(parsed) }, Date.now() - start);
  },
};
