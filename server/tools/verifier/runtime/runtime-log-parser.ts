import { analyzeOutput }   from '../../../agents/verifier/diagnostics/error-analyzer.ts';
import type { ParsedError } from '../shared/verifier-types.ts';
import type { ToolDefinition } from '../../registry/tool-types.ts';
import { toToolOk }            from '../shared/verifier-result.ts';

export interface RuntimeLogAnalysis {
  errors:      ParsedError[];
  hasErrors:   boolean;
  hasCrash:    boolean;
  crashLines:  string[];
  readyLines:  string[];
}

const CRASH_PATTERNS = [
  /unhandled (promise )?rejection/i,
  /process\.exit\s*\(/i,
  /uncaughtException/i,
  /EADDRINUSE/,
  /Cannot find module/i,
  /SyntaxError:/,
];

const READY_PATTERNS = [
  /listening on/i,
  /server (started|ready)/i,
  /\bport\b.*\d{4,}/i,
];

export function parseRuntimeLogs(logs: string): RuntimeLogAnalysis {
  const lines     = logs.split('\n').filter(Boolean);
  const errors    = analyzeOutput('runtime', logs);
  const hasCrash  = CRASH_PATTERNS.some(p => p.test(logs));
  const crashLines = lines.filter(l => CRASH_PATTERNS.some(p => p.test(l)));
  const readyLines = lines.filter(l => READY_PATTERNS.some(p => p.test(l)));
  return { errors, hasErrors: errors.length > 0, hasCrash, crashLines, readyLines };
}

export const runtimeLogParserTool: ToolDefinition = {
  name:        'parse_runtime_logs',
  category:    'verifier',
  description: 'Parse runtime logs to detect crashes and errors',
  inputSchema: {
    logs: { type: 'string', description: 'Runtime log output', required: true },
  },
  permissions: [],
  timeoutMs:   5_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = parseRuntimeLogs(input.logs as string);
    return toToolOk(result, Date.now() - start);
  },
};
