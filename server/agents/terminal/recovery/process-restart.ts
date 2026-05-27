import { shellExecute }      from '../execution/shell-executor.ts';
import { onProcessStarted }  from '../process/process-lifecycle.ts';
import { runtimeLogger }     from '../telemetry/runtime-logger.ts';
import { getBackoffMs }      from './recovery-policy.ts';
import type { RecoveryPolicy } from './recovery-policy.ts';
import type { ExecutionResult } from '../types/execution.types.ts';

export interface RestartResult {
  attempt:    number;
  result:     ExecutionResult;
  restarted:  boolean;
}

export async function restartProcess(
  runId:     string,
  command:   string,
  cwd:       string,
  attempt:   number,
  policy:    RecoveryPolicy,
  timeoutMs  = 30_000,
): Promise<RestartResult> {
  const backoff = getBackoffMs(attempt, policy);

  if (backoff > 0) {
    runtimeLogger.info(runId, `[process-restart] Waiting ${backoff}ms before restart #${attempt}`);
    await new Promise((r) => setTimeout(r, backoff));
  }

  runtimeLogger.info(runId, `[process-restart] Restarting (attempt ${attempt}): ${command}`);

  const result = await shellExecute(command, cwd, timeoutMs);
  return { attempt, result, restarted: true };
}
