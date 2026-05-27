import {
  parseTscOutput,
  extractErrorCount,
  rawToParseError,
} from '../../../agents/verifier/typecheck/type-error-parser.ts';
import type { ParsedError } from '../shared/verifier-types.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';
import { toToolOk }            from '../shared/verifier-result.ts';

export { parseTscOutput, extractErrorCount, rawToParseError };

export function parseTscErrors(rawOutput: string): { errors: ParsedError[]; count: number } {
  const raw    = parseTscOutput(rawOutput);
  const errors = raw.map(rawToParseError);
  const count  = extractErrorCount(rawOutput);
  return { errors, count };
}

export const typescriptParserTool: ToolDefinition = {
  name:        'parse_tsc_output',
  category:    'verifier',
  description: 'Parse TypeScript compiler output into structured errors',
  inputSchema: {
    output: { type: 'string', description: 'tsc output', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = parseTscErrors(input.output as string);
    return toToolOk(result, Date.now() - start);
  },
};
