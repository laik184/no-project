import type { CrashReport, CrashReason } from '../types.ts';
import { parseLines, lastLines } from '../utils.ts';
import { verifierLogger } from '../telemetry.ts';
import { verifierMetrics } from '../telemetry.ts';

const CRASH_SIGNATURES: Array<{ pattern: RegExp; reason: CrashReason }> = [
  { pattern: /javascript heap out of memory/i,        reason: 'oom'       },
  { pattern: /uncaughtexception|unhandledrejection/i, reason: 'exception' },
  { pattern: /killed|sigterm|sigkill|sighup/i,        reason: 'signal'    },
  { pattern: /timed? out|etimedout/i,                 reason: 'timeout'   },
];

const EXIT_CODE_PATTERN = /exited with code (\d+)/i;
const SIGNAL_PATTERN    = /killed by signal (\w+)/i;

export function parseRuntimeLogs(output: string): CrashReport {
  const tail = lastLines(output, 20);

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

  if (/fatal error|process\.exit\(\s*[1-9]/i.test(output)) {
    return { detected: true, reason: 'exception', lastLines: tail, detectedAt: new Date() };
  }

  return { detected: false, lastLines: tail };
}

export function extractCrashMessage(report: CrashReport): string {
  if (!report.detected) return 'No crash detected';
  const parts = [`Crash reason: ${report.reason ?? 'unknown'}`];
  if (report.exitCode !== undefined) parts.push(`Exit code: ${report.exitCode}`);
  if (report.signal) parts.push(`Signal: ${report.signal}`);
  return parts.join(' | ');
}

export interface CrashDetectionResult {
  crashed: boolean;
  report:  CrashReport;
}

export function detectCrash(runId: string, stdout: string, stderr: string): CrashDetectionResult {
  const report = parseRuntimeLogs(`${stdout}\n${stderr}`);
  if (report.detected) {
    verifierLogger.error(runId, '[crash-detector] Crash detected', { reason: report.reason, exitCode: report.exitCode });
    verifierMetrics.recordCrash(runId);
  }
  return { crashed: report.detected, report };
}

export function detectCrashFromExitCode(runId: string, exitCode: number, stderr: string): CrashDetectionResult {
  if (exitCode === 0) return { crashed: false, report: { detected: false, lastLines: [] } };
  const report: CrashReport = {
    detected:   true,
    reason:     'exception',
    exitCode,
    lastLines:  stderr.split('\n').filter(Boolean).slice(-10),
    detectedAt: new Date(),
  };
  verifierLogger.error(runId, '[crash-detector] Non-zero exit code', { exitCode });
  return { crashed: true, report };
}
