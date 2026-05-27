import type { CrashReport, CrashReason } from '../types/runtime.types.ts';
import { parseLines, lastLines } from '../utils/parser-utils.ts';

const CRASH_SIGNATURES: Array<{ pattern: RegExp; reason: CrashReason }> = [
  { pattern: /javascript heap out of memory/i, reason: 'oom'       },
  { pattern: /uncaughtexception|unhandledrejection/i, reason: 'exception' },
  { pattern: /killed|sigterm|sigkill|sighup/i, reason: 'signal'    },
  { pattern: /timed? out|etimedout/i,          reason: 'timeout'   },
];

const EXIT_CODE_PATTERN = /exited with code (\d+)/i;
const SIGNAL_PATTERN    = /killed by signal (\w+)/i;

export function parseRuntimeLogs(output: string): CrashReport {
  const lines    = parseLines(output);
  const tail     = lastLines(output, 20);
  const combined = output.toLowerCase();

  for (const { pattern, reason } of CRASH_SIGNATURES) {
    if (pattern.test(output)) {
      const exitCodeMatch = output.match(EXIT_CODE_PATTERN);
      const signalMatch   = output.match(SIGNAL_PATTERN);
      return {
        detected:   true,
        reason,
        exitCode:   exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : undefined,
        signal:     signalMatch ? signalMatch[1] : undefined,
        lastLines:  tail,
        detectedAt: new Date(),
      };
    }
  }

  const hasFatalError = /fatal error|process\.exit\(\s*[1-9]/i.test(output);
  if (hasFatalError) {
    return { detected: true, reason: 'exception', lastLines: tail, detectedAt: new Date() };
  }

  return { detected: false, lastLines: tail };
}

export function extractCrashMessage(report: CrashReport): string {
  if (!report.detected) return 'No crash detected';
  const parts = [`Crash reason: ${report.reason ?? 'unknown'}`];
  if (report.exitCode !== undefined) parts.push(`Exit code: ${report.exitCode}`);
  if (report.signal)  parts.push(`Signal: ${report.signal}`);
  return parts.join(' | ');
}
