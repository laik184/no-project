/**
 * server/tools/verifier/verifier-failure-recovery-tool.ts
 * Tool: verifier_failure_recovery
 *
 * Produces a structured recovery suggestion for a verifier step failure.
 * Returns: { action, suggestion, phase, canRetry, context }
 */

import type { ToolDefinition, ToolExecutionContext } from '../registry/tool-types.ts';
import { RETRY_NONE, TIMEOUT }                       from '../registry/tool-metadata.ts';

export type RecoveryAction = 'retry' | 'skip' | 'escalate' | 'reinstall_deps' | 'fix_types';

export interface FailureRecoveryResult {
  action:     RecoveryAction;
  suggestion: string;
  phase:      string;
  canRetry:   boolean;
  context:    Record<string, unknown>;
}

const RECOVERY_MAP: Array<{ pattern: RegExp; action: RecoveryAction; suggestion: string }> = [
  {
    pattern:    /Cannot find module|Module not found|ERR_MODULE_NOT_FOUND/i,
    action:     'reinstall_deps',
    suggestion: 'Run `npm install` to restore missing dependencies.',
  },
  {
    pattern:    /error TS\d+|type error|TypeScript/i,
    action:     'fix_types',
    suggestion: 'Fix TypeScript errors surfaced by tsc --noEmit before re-running.',
  },
  {
    pattern:    /ENOENT|no such file/i,
    action:     'retry',
    suggestion: 'Required file missing — executor may not have written it yet. Retry after brief delay.',
  },
  {
    pattern:    /timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i,
    action:     'retry',
    suggestion: 'Operation timed out. Retry with a longer timeout.',
  },
  {
    pattern:    /ECONNREFUSED|connection refused/i,
    action:     'retry',
    suggestion: 'Server not yet accepting connections. Wait and retry health check.',
  },
];

export const verifierFailureRecoveryTool: ToolDefinition = {
  name:        'verifier_failure_recovery',
  category:    'verifier',
  description: 'Produce a structured recovery suggestion for a failed verification step.',
  inputSchema: {
    runId: { type: 'string', description: 'Execution run ID',             required: false },
    phase: { type: 'string', description: 'Verification phase that failed', required: false },
    error: { type: 'string', description: 'Error message from the step',  required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.FAST,
  retry:       RETRY_NONE,

  handler: async (input, _ctx: ToolExecutionContext): Promise<FailureRecoveryResult> => {
    const phase = String(input.phase ?? 'unknown');
    const error = String(input.error ?? '');

    for (const { pattern, action, suggestion } of RECOVERY_MAP) {
      if (pattern.test(error)) {
        return {
          action,
          suggestion,
          phase,
          canRetry: action !== 'escalate',
          context:  { matchedPattern: pattern.source, originalError: error.slice(0, 500) },
        };
      }
    }

    return {
      action:     'escalate',
      suggestion: `Unrecognized failure in phase "${phase}". Manual review required.`,
      phase,
      canRetry:   false,
      context:    { originalError: error.slice(0, 500) },
    };
  },
};
