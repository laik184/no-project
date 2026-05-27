import type { VerificationResult, PhaseResult, VerificationPhase } from '../types/verifier.types.ts';
import type { CrashReport, RuntimeCheckResult } from '../types/runtime.types.ts';
import {
  emitVerificationStarted,
  emitVerificationCompleted,
  emitVerificationFailed,
} from './verification-events.ts';
import {
  emitRuntimeCrashed,
  emitRuntimeHealthy,
  emitRuntimeCheckStarted,
} from './runtime-events.ts';

export const eventPublisher = {
  verificationStarted(runId: string, projectId: string, phases: VerificationPhase[]): void {
    emitVerificationStarted({ runId, projectId, phases });
  },

  verificationCompleted(runId: string, result: VerificationResult): void {
    emitVerificationCompleted({ runId, result });
  },

  verificationFailed(runId: string, errors: string[], phase?: VerificationPhase, phaseResult?: PhaseResult): void {
    emitVerificationFailed({ runId, phase, errors, result: phaseResult });
  },

  runtimeCrashed(runId: string, projectId: string, report: CrashReport): void {
    emitRuntimeCrashed({ runId, projectId, report });
  },

  runtimeHealthy(runId: string, projectId: string, check: RuntimeCheckResult): void {
    emitRuntimeHealthy({ runId, projectId, check });
  },

  runtimeCheckStarted(runId: string, projectId: string): void {
    emitRuntimeCheckStarted(runId, projectId);
  },
};
