import type { CrashReport, CrashReason } from '../shared/verifier-types.ts';
import type { ToolDefinition }           from '../../registry/tool-types.ts';
import { toToolOk }                      from '../shared/verifier-result.ts';

const CRASH_SIGNATURES: Array<{ pattern: RegExp; reason: CrashReason }> = [
  { pattern: /JavaScript heap out of memory/i, reason: 'oom' },
  { pattern: /unhandled (promise )?rejection/i, reason: 'exception' },
  { pattern: /uncaughtException/i,              reason: 'exception' },
  { pattern: /timed out/i,                      reason: 'timeout' },
  { pattern: /SIGKILL|SIGTERM|SIGABRT/,         reason: 'signal' },
];

export function detectCrash(
  logs:     string,
  exitCode?: number,
): CrashReport {
  const lines   = logs.split('\n').filter(Boolean);
  const lastLines = lines.slice(-20);
  let detected = false;
  let reason: CrashReason = 'unknown';

  for (const { pattern, reason: r } of CRASH_SIGNATURES) {
    if (pattern.test(logs)) { detected = true; reason = r; break; }
  }

  if (!detected && exitCode !== undefined && exitCode !== 0) {
    detected = true;
    reason   = exitCode === 137 ? 'oom'
      : exitCode > 128 ? 'signal'
      : 'exception';
  }

  return { detected, reason: detected ? reason : undefined, exitCode, lastLines, detectedAt: detected ? new Date() : undefined };
}

export const crashDetectorTool: ToolDefinition = {
  name:        'detect_runtime_crash',
  category:    'verifier',
  description: 'Detect runtime crashes from logs and exit code',
  inputSchema: {
    logs:     { type: 'string', description: 'Runtime logs',  required: true },
    exitCode: { type: 'number', description: 'Process exit code' },
  },
  permissions: [],
  timeoutMs:   3_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = detectCrash(
      input.logs     as string,
      input.exitCode !== undefined ? Number(input.exitCode) : undefined,
    );
    return toToolOk(result, Date.now() - start);
  },
};
