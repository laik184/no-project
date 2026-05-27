import {
  parseStackTrace,
  extractFirstUserFrame,
  isNodeInternalFrame,
} from '../../../agents/verifier/diagnostics/stacktrace-parser.ts';
import type { ParsedStackTrace, StackFrame } from '../shared/verifier-types.ts';
import type { ToolDefinition }               from '../../registry/tool-types.ts';
import { toToolOk }                          from '../shared/verifier-result.ts';

export { parseStackTrace, extractFirstUserFrame, isNodeInternalFrame };
export type { ParsedStackTrace, StackFrame };

export const stacktraceParserTool: ToolDefinition = {
  name:        'parse_stacktrace',
  category:    'verifier',
  description: 'Parse a raw stack trace into structured frames',
  inputSchema: {
    raw: { type: 'string', description: 'Raw stack trace', required: true },
  },
  permissions: [],
  timeoutMs:   3_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start   = Date.now();
    const parsed  = parseStackTrace(input.raw as string);
    const topFrame = extractFirstUserFrame(parsed);
    return toToolOk({ ...parsed, topUserFrame: topFrame }, Date.now() - start);
  },
};
