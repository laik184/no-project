import { EventEmitter } from 'events';
import type { OrchestrationStatus, OrchestrationPhase } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { elapsed, formatDuration } from '../utils/orchestration-helpers.ts';

export enum LifecycleState {
  Idle      = 'idle',
  Starting  = 'starting',
  Running   = 'running',
  Completing = 'completing',
  Completed = 'completed',
  Failed    = 'failed',
  Cancelled = 'cancelled',
}

export interface RunLifecycle {
  runId: string;
  state: LifecycleState;
  startedAt: Date | null;
  endedAt: Date | null;
  durationMs: number | null;
  currentPhase: OrchestrationPhase | null;
}

const TERMINAL_STATES = new Set<LifecycleState>([
  LifecycleState.Completed,
  LifecycleState.Failed,
  LifecycleState.Cancelled,
]);

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  [LifecycleState.Idle]:       [LifecycleState.Starting],
  [LifecycleState.Starting]:   [LifecycleState.Running, LifecycleState.Failed, LifecycleState.Cancelled],
  [LifecycleState.Running]:    [LifecycleState.Completing, LifecycleState.Failed, LifecycleState.Cancelled],
  [LifecycleState.Completing]: [LifecycleState.Completed, LifecycleState.Failed],
  [LifecycleState.Completed]:  [],
  [LifecycleState.Failed]:     [],
  [LifecycleState.Cancelled]:  [],
};

class LifecycleManager extends EventEmitter {
  private lifecycles = new Map<string, RunLifecycle>();

  register(runId: string): RunLifecycle {
    const lc: RunLifecycle = {
      runId,
      state: LifecycleState.Idle,
      startedAt: null,
      endedAt: null,
      durationMs: null,
      currentPhase: null,
    };
    this.lifecycles.set(runId, lc);
    return { ...lc };
  }

  transition(runId: string, next: LifecycleState): RunLifecycle {
    const lc = this.lifecycles.get(runId);
    if (!lc) throw new Error(`[lifecycle-manager] No lifecycle for run: ${runId}`);

    const allowed = VALID_TRANSITIONS[lc.state];
    if (!allowed.includes(next)) {
      throw new Error(`[lifecycle-manager] Invalid transition ${lc.state} → ${next} for run ${runId}`);
    }

    lc.state = next;

    if (next === LifecycleState.Running) {
      lc.startedAt = new Date();
    }

    if (TERMINAL_STATES.has(next)) {
      lc.endedAt = new Date();
      lc.durationMs = lc.startedAt ? elapsed(lc.startedAt) : null;
      const dur = lc.durationMs !== null ? formatDuration(lc.durationMs) : '?';
      runLogger.log(runId, next === LifecycleState.Completed ? 'info' : 'warn',
        `[lifecycle] Run ${next} in ${dur}`);
    }

    this.emit(`lifecycle.${next}`, { ...lc });
    return { ...lc };
  }

  setPhase(runId: string, phase: OrchestrationPhase): void {
    const lc = this.lifecycles.get(runId);
    if (lc) {
      lc.currentPhase = phase;
      this.emit('lifecycle.phase', { runId, phase });
    }
  }

  get(runId: string): RunLifecycle | undefined {
    const lc = this.lifecycles.get(runId);
    return lc ? { ...lc } : undefined;
  }

  isTerminal(runId: string): boolean {
    const lc = this.lifecycles.get(runId);
    return lc ? TERMINAL_STATES.has(lc.state) : false;
  }

  isRunning(runId: string): boolean {
    return this.lifecycles.get(runId)?.state === LifecycleState.Running;
  }

  cleanup(runId: string): void {
    this.lifecycles.delete(runId);
    runLogger.log(runId, 'info', '[lifecycle] Lifecycle record cleared');
  }

  getActiveRuns(): string[] {
    return Array.from(this.lifecycles.entries())
      .filter(([, lc]) => !TERMINAL_STATES.has(lc.state))
      .map(([id]) => id);
  }

  statusOf(runId: string): OrchestrationStatus {
    const state = this.lifecycles.get(runId)?.state;
    const map: Partial<Record<LifecycleState, OrchestrationStatus>> = {
      [LifecycleState.Idle]:       'pending',
      [LifecycleState.Starting]:   'pending',
      [LifecycleState.Running]:    'running',
      [LifecycleState.Completing]: 'running',
      [LifecycleState.Completed]:  'completed',
      [LifecycleState.Failed]:     'failed',
      [LifecycleState.Cancelled]:  'cancelled',
    };
    return (state && map[state]) ?? 'pending';
  }
}

export const lifecycleManager = new LifecycleManager();
lifecycleManager.setMaxListeners(50);
