import { parseBuildErrors }   from '../lib/build-error-parser.ts';
import type { ParsedError }    from '../shared/verifier-types.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';
import { toToolOk }            from '../shared/verifier-result.ts';

export { parseBuildErrors };

export function classifyBuildErrors(output: string): { errors: ParsedError[]; count: number; hasFatal: boolean } {
  const errors   = parseBuildErrors(output);
  const hasFatal = errors.some((e) => e.severity === 'fatal' || e.severity === 'error');
  return { errors, count: errors.length, hasFatal };
}

export const buildErrorClassifierTool: ToolDefinition = {
  name:        'classify_build_errors',
  category:    'verifier',
  description: 'Classify and parse build errors from output',
  inputSchema: {
    output: { type: 'string', description: 'Combined stdout+stderr', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = classifyBuildErrors(input.output as string);
    return toToolOk(result, Date.now() - start);
  },
};
