import {
  decideRecovery,
  clearRecoveryState,
  type RecoveryAction,
  type RecoveryDecision,
} from '../lib/failure-recovery.ts';
import type { VerificationPhase } from '../shared/verifier-types.ts';
import type { ToolDefinition }    from '../../registry/tool-types.ts';
import { toToolOk }               from '../shared/verifier-result.ts';

export type { RecoveryAction, RecoveryDecision };

export const verifierFailureRecovery = {
  handle(runId: string, phase: VerificationPhase, error: string): RecoveryDecision {
    return decideRecovery(runId, phase, error);
  },
  clear(runId: string): void {
    clearRecoveryState(runId);
  },
};

export const failureRecoveryTool: ToolDefinition = {
  name:        'verifier_failure_recovery',
  category:    'verifier',
  description: 'Decide recovery action (retry / skip / abort) for a failed verification phase',
  inputSchema: {
    runId: { type: 'string', description: 'Run ID',            required: true },
    phase: { type: 'string', description: 'Failed phase name', required: true },
    error: { type: 'string', description: 'Error message',     required: true },
  },
  permissions: [],
  timeoutMs:   2_000,
  retry:       { maxAttempts: 1, delayMs: 0, backoff: 'none' },
  handler:     async (input: Record<string, unknown>) => {
    const start  = Date.now();
    const result = decideRecovery(
      input.runId as string,
      input.phase as VerificationPhase,
      input.error as string,
    );
    return toToolOk(result, Date.now() - start);
  },
};
