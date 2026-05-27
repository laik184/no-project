import type { VerificationResult, PhaseResult, VerificationPhase } from '../types/verifier.types.ts';
import { verifierLogger } from '../telemetry/verifier-logger.ts';

export interface VerificationStartedPayload {
  runId:     string;
  projectId: string;
  phases:    VerificationPhase[];
}

export interface VerificationCompletedPayload {
  runId:   string;
  result:  VerificationResult;
}

export interface VerificationFailedPayload {
  runId:    string;
  phase?:   VerificationPhase;
  errors:   string[];
  result?:  PhaseResult;
}

export function emitVerificationStarted(payload: VerificationStartedPayload): void {
  verifierLogger.info(payload.runId, 'Verification started', {
    phases: payload.phases,
    projectId: payload.projectId,
  });
}

export function emitVerificationCompleted(payload: VerificationCompletedPayload): void {
  verifierLogger.info(payload.runId, 'Verification completed', {
    status:     payload.result.overallStatus,
    durationMs: payload.result.durationMs,
    errors:     payload.result.errorCount,
  });
}

export function emitVerificationFailed(payload: VerificationFailedPayload): void {
  verifierLogger.error(payload.runId, 'Verification failed', {
    phase:  payload.phase,
    errors: payload.errors,
  });
}
