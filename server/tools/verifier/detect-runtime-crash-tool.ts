/**
 * server/tools/verifier/detect-runtime-crash-tool.ts
 * Tool: detect_runtime_crash
 *
 * Detects whether a running process has crashed based on logs and exit codes.
 */

import type { ToolDefinition } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT } from '../registry/tool-metadata.ts';

interface CrashDetectionResult {
  crashed:    boolean;
  exitCode?:  number;
  reason?:    string;
  signals:    string[];
}

export const detectRuntimeCrashTool: ToolDefinition = {
  name:        'detect_runtime_crash',
  category:    'verifier',
  description: 'Detect if a runtime process has crashed based on logs and exit code.',
  inputSchema: {
    logs:      { type: 'string', description: 'Log output from the process',          required: false },
    exitCode:  { type: 'number', description: 'Process exit code (non-zero = crash)',  required: false },
    stderr:    { type: 'string', description: 'Standard error output',                 required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input): Promise<CrashDetectionResult> => {
    const text     = [input.logs, input.stderr].filter(Boolean).join('\n');
    const exitCode = input.exitCode !== undefined ? Number(input.exitCode) : undefined;
    const signals: string[] = [];

    const CRASH_PATTERNS: Array<{ pattern: RegExp; signal: string }> = [
      { pattern: /unhandled (promise rejection|exception)/i,  signal: 'unhandled_exception' },
      { pattern: /segmentation fault|sigsegv/i,               signal: 'segfault' },
      { pattern: /out of memory|heap out of memory/i,         signal: 'oom' },
      { pattern: /process exited with code [1-9]/i,           signal: 'nonzero_exit' },
      { pattern: /cannot read propert(y|ies) of (null|undefined)/i, signal: 'null_deref' },
      { pattern: /sigkill|killed/i,                           signal: 'killed' },
      { pattern: /sigterm/i,                                  signal: 'terminated' },
      { pattern: /\bpanic\b|\bfatal error\b/i,                signal: 'fatal_error' },
    ];

    for (const { pattern, signal } of CRASH_PATTERNS) {
      if (pattern.test(text)) signals.push(signal);
    }

    const crashed = signals.length > 0 || (exitCode !== undefined && exitCode !== 0);

    let reason: string | undefined;
    if (signals.includes('oom'))            reason = 'Out of memory';
    else if (signals.includes('segfault'))  reason = 'Segmentation fault';
    else if (signals.includes('killed'))    reason = 'Process was killed';
    else if (signals.includes('unhandled_exception')) reason = 'Unhandled exception';
    else if (signals.includes('null_deref'))          reason = 'Null/undefined dereference';
    else if (crashed)                                 reason = `Process exited with code ${exitCode ?? 1}`;

    return { crashed, exitCode, reason, signals };
  },
};
