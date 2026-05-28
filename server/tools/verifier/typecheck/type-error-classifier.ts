import { classifyError }    from '../lib/failure-classifier.ts';
import type { ParsedError }  from '../shared/verifier-types.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';
import { toToolOk }            from '../shared/verifier-result.ts';

export { classifyError };

export function classifyTypeErrors(errors: ParsedError[]): Record<string, ParsedError[]> {
  const byCode: Record<string, ParsedError[]> = {};
  for (const err of errors) {
    const key = err.code ?? 'unknown';
    if (!byCode[key]) byCode[key] = [];
    byCode[key]!.push(err);
  }
  return byCode;
}

export const typeErrorClassifierTool: ToolDefinition = {
  name:        'classify_type_errors',
  category:    'verifier',
  description: 'Group TypeScript errors by error code',
  inputSchema: {
    errors: { type: 'array', description: 'ParsedError array', required: true },
  },
  permissions: [],
  timeoutMs:   2_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = classifyTypeErrors(input.errors as ParsedError[]);
    return toToolOk(result, Date.now() - start);
  },
};
