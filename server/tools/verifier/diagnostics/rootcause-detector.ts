import { detectRootCauses, primaryRootCause } from '../lib/rootcause-detector.ts';
import type { ParsedError, RootCause }         from '../shared/verifier-types.ts';
import type { ToolDefinition }                 from '../../registry/tool-types.ts';
import { toToolOk }                            from '../shared/verifier-result.ts';

export { detectRootCauses, primaryRootCause };

export const rootcauseDetectorTool: ToolDefinition = {
  name:        'detect_root_causes',
  category:    'verifier',
  description: 'Detect root causes from a set of parsed errors',
  inputSchema: {
    errors: { type: 'array', description: 'ParsedError array', required: true },
  },
  permissions: [],
  timeoutMs:   3_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start   = Date.now();
    const errors  = input.errors as ParsedError[];
    const causes  = detectRootCauses(errors);
    const primary = primaryRootCause(errors);
    return toToolOk({ causes, primary, count: causes.length }, Date.now() - start);
  },
};
