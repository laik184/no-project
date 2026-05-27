import { bus } from '../../infrastructure/events/bus.ts';
import type { StartupVerificationResult } from '../verification/startup-verifier.ts';

export function emitVerificationResult(result: StartupVerificationResult): void {
  bus.emit('runtime.verification.result', {
    projectId: result.projectId,
    passed:    result.passed,
    port:      result.port,
    ts:        result.ts,
  });
}
