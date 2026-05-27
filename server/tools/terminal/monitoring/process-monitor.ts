import { watchProcess } from '../process/process-watch.ts';

interface MonitoredProcess {
  runId:    string;
  pid:      number;
  port?:    number;
  interval: NodeJS.Timeout;
}

const monitors = new Map<string, MonitoredProcess>();

export const processMonitor = {
  watch(runId: string, pid: number, port?: number, intervalMs = 5_000): void {
    if (monitors.has(runId)) return;
    const interval = setInterval(async () => {
      const status = await watchProcess(pid, port);
      if (!status.alive) {
        clearInterval(interval);
        monitors.delete(runId);
      }
    }, intervalMs);
    monitors.set(runId, { runId, pid, port, interval });
  },

  stop(runId: string): void {
    const m = monitors.get(runId);
    if (m) { clearInterval(m.interval); monitors.delete(runId); }
  },

  isWatching(runId: string): boolean { return monitors.has(runId); },
  watchedRuns(): string[] { return [...monitors.keys()]; },
};
