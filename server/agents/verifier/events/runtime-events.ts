import type { CrashReport, RuntimeCheckResult } from '../types/runtime.types.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export interface RuntimeCrashedPayload {
  runId:    string;
  projectId: string;
  report:   CrashReport;
}

export interface RuntimeHealthyPayload {
  runId:    string;
  projectId: string;
  check:    RuntimeCheckResult;
}

export function emitRuntimeCrashed(payload: RuntimeCrashedPayload): void {
  verifierLogger.error(payload.runId, 'Runtime crash detected', {
    reason:   payload.report.reason,
    exitCode: payload.report.exitCode,
    lastLine: payload.report.lastLines.at(-1),
  });
}

export function emitRuntimeHealthy(payload: RuntimeHealthyPayload): void {
  verifierLogger.info(payload.runId, 'Runtime healthy', {
    responseTimeMs: payload.check.responseTimeMs,
  });
}

export function emitRuntimeCheckStarted(runId: string, projectId: string): void {
  verifierLogger.info(runId, 'Runtime check started', { projectId });
}
