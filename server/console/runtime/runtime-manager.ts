/**
 * server/console/runtime/runtime-manager.ts
 *
 * Console-domain runtime manager.
 * Coordinates state transitions, supervisor lifecycle, and recovery.
 * State is owned by the shared runtime-state store (no repository import).
 */

import { runtimeStateStore }  from '../../shared/console/runtime-state.ts';
import { emitRuntimeState }   from '../events/console-events.ts';
import { spawnSupervised }    from './process-supervisor.ts';
import { crashRecovery }      from './crash-recovery.ts';
import { healthMonitor }      from './health-monitor.ts';
import type { RuntimeState, RuntimeStateEvent, RuntimeEntry } from '../../shared/console/types.ts';
import type { SupervisorHandle } from './process-supervisor.ts';

interface ManagedProcess {
  handle: SupervisorHandle;
  startedAt: number;
}

const processes = new Map<number, ManagedProcess>();

function transition(projectId: number, state: RuntimeState, message: string): void {
  const entry = runtimeStateStore.setState(projectId, state, message);
  const event: RuntimeStateEvent = {
    type:    'runtime.state',
    state,
    prev:    entry.prev,
    message,
    ts:      new Date().toISOString(),
  };
  emitRuntimeState(projectId, event);
}

export interface StartOptions {
  command: string;
  args?:   string[];
  cwd?:    string;
  env?:    Record<string, string>;
}

export const consoleRuntimeManager = {
  /**
   * Start a supervised process for a project.
   * Transitions: idle → starting → (ready on first heartbeat)
   */
  start(projectId: number, opts: StartOptions): void {
    const existing = processes.get(projectId);
    if (existing) {
      existing.handle.stop();
      processes.delete(projectId);
    }

    transition(projectId, 'starting', 'Starting process…');

    const spawned = spawnSupervised({ projectId, ...opts });
    processes.set(projectId, { handle: spawned, startedAt: Date.now() });

    setTimeout(() => {
      const entry = runtimeStateStore.getState(projectId);
      if (entry?.state === 'starting') {
        transition(projectId, 'ready', 'Development server ready');
      }
    }, 3_000);
  },

  stop(projectId: number): void {
    const proc = processes.get(projectId);
    if (!proc) return;
    proc.handle.stop();
    processes.delete(projectId);
    transition(projectId, 'idle', 'Process stopped');
  },

  restart(projectId: number, opts: StartOptions): void {
    transition(projectId, 'restarting', 'Restarting process…');
    const proc = processes.get(projectId);
    if (proc) {
      proc.handle.stop();
      processes.delete(projectId);
    }
    setTimeout(() => this.start(projectId, opts), 500);
  },

  setState(projectId: number, state: RuntimeState, message: string): void {
    transition(projectId, state, message);
  },

  getState(projectId: number): RuntimeEntry | undefined {
    return runtimeStateStore.getState(projectId);
  },

  getAllStates(): RuntimeEntry[] {
    return runtimeStateStore.all();
  },

  isRunning(projectId: number): boolean {
    return processes.has(projectId);
  },

  init(): void {
    healthMonitor.start();
    crashRecovery.init();
  },
};
