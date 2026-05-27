import type { CrashReport } from '../types/runtime.types.ts';
import { parseRuntimeLogs } from './runtime-log-parser.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';
import { verifierMetrics } from '../telemetry/verifier-metrics.ts';

export interface CrashDetectionResult {
  crashed: boolean;
  report:  CrashReport;
}

export function detectCrash(
  runId:  string,
  stdout: string,
  stderr: string,
): CrashDetectionResult {
  const combined = `${stdout}\n${stderr}`;
  const report   = parseRuntimeLogs(combined);

  if (report.detected) {
    verifierLogger.error(runId, '[crash-detector] Crash detected', {
      reason:   report.reason,
      exitCode: report.exitCode,
    });
    verifierMetrics.recordCrash(runId);
  }

  return { crashed: report.detected, report };
}

export function detectCrashFromExitCode(
  runId:    string,
  exitCode: number,
  stderr:   string,
): CrashDetectionResult {
  if (exitCode === 0) {
    return { crashed: false, report: { detected: false, lastLines: [] } };
  }

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
