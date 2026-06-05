/**
 * server/console/runtime/health-monitor.ts
 *
 * Polls the runtime heartbeat for each project.
 * Uses shared runtime-state store (no repository import).
 */

import { runtimeStateStore } from '../../shared/console/runtime-state.ts';
import { emitRuntimeState }  from '../events/console-events.ts';

const POLL_INTERVAL_MS  = 10_000;
const HEARTBEAT_TIMEOUT = 30_000;

let _timer: ReturnType<typeof setInterval> | null = null;

function checkHeartbeats(): void {
  const now = Date.now();
  for (const entry of runtimeStateStore.all()) {
    const stale   = now - entry.heartbeatAt > HEARTBEAT_TIMEOUT;
    const running = entry.state === 'ready' || entry.state === 'starting' || entry.state === 'compiling';

    if (stale && running) {
      const prev = entry.state;
      runtimeStateStore.setState(entry.projectId, 'warning', 'Process heartbeat timeout');
      emitRuntimeState(entry.projectId, {
        type:    'runtime.state',
        state:   'warning',
        prev,
        message: 'Process heartbeat timeout',
        ts:      new Date().toISOString(),
      });
    }
  }
}

export const healthMonitor = {
  start(): void {
    if (_timer) return;
    _timer = setInterval(checkHeartbeats, POLL_INTERVAL_MS);
    if (_timer.unref) _timer.unref();
  },

  stop(): void {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  },

  /** Call this when a process sends a signal it's alive. */
  beat(projectId: number): void {
    runtimeStateStore.updateHeartbeat(projectId);
  },
};
