import { onProcessCrashed, resetCrashState } from './crash-handler.ts';
import { restartProcess }                    from './process-restart.ts';
import { DEFAULT_POLICY }                    from './recovery-policy.ts';
import { runtimeLogger }                     from '../telemetry/runtime-logger.ts';
import { getWorkspaceRoot }                  from '../workspace/runtime-workspace.ts';
import type { RecoveryPolicy }               from './recovery-policy.ts';

export interface RecoveryResult {
  recovered: boolean;
  attempts:  number;
  aborted:   boolean;
  message:   string;
}

export async function attemptRecovery(
  runId:     string,
  projectId: string,
  processId: string,
  pid:       number,
  command:   string,
  policy     = DEFAULT_POLICY,
): Promise<RecoveryResult> {
  let attempts = 0;

  while (attempts < policy.maxRestarts) {
    attempts++;

    const { action, backoffMs } = onProcessCrashed(
      runId, processId, pid, command, policy,
    );

    if (action === 'abort') {
      runtimeLogger.error(runId, `[runtime-recovery] Aborting after ${attempts} attempts`);
      return { recovered: false, attempts, aborted: true, message: 'Max restarts exceeded' };
    }

    const cwd = getWorkspaceRoot(projectId);
    const { result } = await restartProcess(runId, command, cwd, attempts, policy);

    if (result.success) {
      resetCrashState(runId);
      runtimeLogger.info(runId, `[runtime-recovery] Recovered after ${attempts} attempts`);
      return { recovered: true, attempts, aborted: false, message: 'Process recovered' };
    }
  }

  return { recovered: false, attempts, aborted: true, message: 'Recovery failed' };
}
