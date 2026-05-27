import { runtimeLogger } from '../telemetry/runtime-logger.ts';
import { publishEvent }  from '../events/event-publisher.ts';

interface FailureRecord {
  runId:     string;
  command:   string;
  error:     string;
  timestamp: Date;
}

const failures: FailureRecord[] = [];
const MAX_FAILURES = 200;

const ALERT_THRESHOLD_PER_RUN = 5;
const failureCountByRun       = new Map<string, number>();

export const failureMonitor = {
  record(runId: string, command: string, error: string): void {
    if (failures.length >= MAX_FAILURES) failures.shift();
    failures.push({ runId, command, error, timestamp: new Date() });

    const count = (failureCountByRun.get(runId) ?? 0) + 1;
    failureCountByRun.set(runId, count);

    runtimeLogger.error(runId, `[failure-monitor] cmd="${command}" err="${error.slice(0, 200)}"`);

    if (count >= ALERT_THRESHOLD_PER_RUN) {
      runtimeLogger.warn(runId, `[failure-monitor] Run has ${count} failures — check process health`);
    }
  },

  getForRun(runId: string): FailureRecord[] {
    return failures.filter((f) => f.runId === runId);
  },

  countForRun(runId: string): number {
    return failureCountByRun.get(runId) ?? 0;
  },

  isRunFailing(runId: string): boolean {
    return (failureCountByRun.get(runId) ?? 0) >= ALERT_THRESHOLD_PER_RUN;
  },

  clear(runId: string): void {
    failureCountByRun.delete(runId);
    const toRemove = failures.filter((f) => f.runId === runId);
    for (const f of toRemove) failures.splice(failures.indexOf(f), 1);
  },
};
