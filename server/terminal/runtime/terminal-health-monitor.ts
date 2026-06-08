/**
 * server/terminal/runtime/terminal-health-monitor.ts
 *
 * Periodic health polling for supervised terminal processes.
 * Detects zombie processes and emits health events.
 */

import { terminalLifecycle } from './terminal-lifecycle.ts';

export interface HealthReport {
  sessionId: string;
  alive:     boolean;
  checkedAt: number;
}

type HealthCallback = (report: HealthReport) => void;

const _interval  = 10_000; // 10s poll
const _callbacks: HealthCallback[] = [];
let   _timer:     ReturnType<typeof setInterval> | null = null;

export const terminalHealthMonitor = {
  start(): void {
    if (_timer) return;
    _timer = setInterval(() => this._poll(), _interval);
  },

  stop(): void {
    if (_timer) { clearInterval(_timer); _timer = null; }
  },

  _poll(): void {
    for (const sessionId of terminalLifecycle.listRunning()) {
      const alive  = terminalLifecycle.isRunning(sessionId);
      const report: HealthReport = { sessionId, alive, checkedAt: Date.now() };
      _callbacks.forEach(cb => cb(report));
    }
  },

  check(sessionId: string): HealthReport {
    return {
      sessionId,
      alive:     terminalLifecycle.isRunning(sessionId),
      checkedAt: Date.now(),
    };
  },

  onHealth(cb: HealthCallback): () => void {
    _callbacks.push(cb);
    return () => {
      const idx = _callbacks.indexOf(cb);
      if (idx !== -1) _callbacks.splice(idx, 1);
    };
  },

  isRunning(): boolean { return _timer !== null; },
};
