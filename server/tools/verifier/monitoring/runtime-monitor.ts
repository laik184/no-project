import { checkServerHealth } from '../runtime/check-server-health.ts';
import type { RuntimeCheckResult } from '../shared/verifier-types.ts';

interface MonitoredServer {
  runId:    string;
  port:     number;
  interval: NodeJS.Timeout;
  lastCheck?: RuntimeCheckResult;
}

const monitors = new Map<string, MonitoredServer>();

export const verifierRuntimeMonitor = {
  watch(runId: string, port: number, intervalMs = 10_000): void {
    if (monitors.has(runId)) return;
    const interval = setInterval(async () => {
      const result = await checkServerHealth({ port, retries: 1 });
      const m = monitors.get(runId);
      if (m) m.lastCheck = result;
      if (!result.healthy) {
        clearInterval(interval);
        monitors.delete(runId);
      }
    }, intervalMs);
    monitors.set(runId, { runId, port, interval });
  },

  stop(runId: string): void {
    const m = monitors.get(runId);
    if (m) { clearInterval(m.interval); monitors.delete(runId); }
  },

  lastCheck(runId: string): RuntimeCheckResult | undefined {
    return monitors.get(runId)?.lastCheck;
  },

  isWatching(runId: string): boolean {
    return monitors.has(runId);
  },

  watchedRuns(): string[] {
    return [...monitors.keys()];
  },
};
