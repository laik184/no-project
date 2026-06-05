/**
 * server/console/runtime/crash-recovery.ts
 *
 * Handles crash detection and initiates recovery sequences.
 * Listens to the bus for process.crashed events and coordinates
 * state transitions through recovering → recovered | failed.
 */

import { bus }                from '../../../server/infrastructure/events/bus.ts';
import { runtimeRepository }  from '../../repositories/console/runtime-repository.ts';
import { emitRuntimeState }   from '../events/console-events.ts';
import { healthMonitor }      from './health-monitor.ts';

const MAX_AUTO_RESTARTS = 3;
const RECOVERY_DELAY_MS = 2_000;

interface CrashRecord {
  count:     number;
  lastCrash: number;
}

const crashHistory = new Map<number, CrashRecord>();

function recordCrash(projectId: number): CrashRecord {
  const existing = crashHistory.get(projectId);
  const now      = Date.now();

  // Reset crash count if last crash was over 2 minutes ago
  if (existing && now - existing.lastCrash > 120_000) {
    existing.count    = 1;
    existing.lastCrash = now;
    return existing;
  }

  const record: CrashRecord = {
    count:     (existing?.count ?? 0) + 1,
    lastCrash: now,
  };
  crashHistory.set(projectId, record);
  return record;
}

function transitionState(
  projectId: number,
  state:     Parameters<typeof runtimeRepository.setState>[1],
  message:   string,
): void {
  const entry = runtimeRepository.setState(projectId, state, message);
  emitRuntimeState(projectId, {
    type:    'runtime.state',
    state,
    prev:    entry.prev,
    message,
    ts:      new Date().toISOString(),
  });
}

let _initialized = false;

export const crashRecovery = {
  init(): void {
    if (_initialized) return;
    _initialized = true;

    bus.on('process.crashed', (payload: Record<string, unknown>) => {
      const projectId = payload.projectId as number | undefined;
      if (!projectId) return;

      const record = recordCrash(projectId);
      transitionState(projectId, 'crashed', `Process exited (crash #${record.count})`);

      if (record.count > MAX_AUTO_RESTARTS) {
        setTimeout(() => {
          transitionState(projectId, 'failed', 'Exceeded max restart attempts');
        }, RECOVERY_DELAY_MS);
        return;
      }

      // Signal recovery attempt
      setTimeout(() => {
        transitionState(projectId, 'recovering', 'AI agent attempting recovery…');
        healthMonitor.beat(projectId);
      }, RECOVERY_DELAY_MS);
    });
  },

  /** Mark a project as fully recovered. */
  markRecovered(projectId: number): void {
    crashHistory.delete(projectId);
    transitionState(projectId, 'recovered', 'Runtime recovered successfully');
    // Transition to ready shortly after
    setTimeout(() => {
      transitionState(projectId, 'ready', 'Development server ready');
    }, 1_500);
  },

  getCrashCount(projectId: number): number {
    return crashHistory.get(projectId)?.count ?? 0;
  },
};
