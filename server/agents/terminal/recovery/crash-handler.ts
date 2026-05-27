import { processManager }    from '../process/process-manager.ts';
import { failureMonitor }    from '../monitoring/failure-monitor.ts';
import { runtimeLogger }     from '../telemetry/runtime-logger.ts';
import { publishEvent }      from '../events/event-publisher.ts';
import { evaluatePolicy }    from './recovery-policy.ts';
import type { RecoveryPolicy } from './recovery-policy.ts';

interface CrashState {
  runId:    string;
  attempts: number;
}

const crashStates = new Map<string, CrashState>();

export function onProcessCrashed(
  runId:     string,
  processId: string,
  pid:       number,
  command:   string,
  policy:    RecoveryPolicy,
): { action: string; backoffMs: number } {
  const state    = crashStates.get(runId) ?? { runId, attempts: 0 };
  state.attempts++;
  crashStates.set(runId, state);

  failureMonitor.record(runId, command, `Process crashed (pid=${pid})`);
  processManager.markCrashed(processId);

  publishEvent('process.crashed', {
    runId, processId, pid, exitCode: -1, timestamp: new Date(),
  });

  const { action, backoffMs } = evaluatePolicy(runId, state.attempts, policy);

  runtimeLogger.warn(runId, `[crash-handler] Crash #${state.attempts} action=${action}`, {
    pid, processId, backoffMs,
  });

  return { action, backoffMs };
}

export function resetCrashState(runId: string): void {
  crashStates.delete(runId);
}
