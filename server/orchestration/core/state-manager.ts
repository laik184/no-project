import type { OrchestrationPhase, OrchestrationStatus } from '../events/event-types.ts';
import { EventEmitter } from 'events';

export interface OrchestrationState {
  runId: string;
  status: OrchestrationStatus;
  phase: OrchestrationPhase | null;
  startedAt: Date | null;
  completedAt: Date | null;
  error: string | null;
  phaseHistory: Array<{ phase: OrchestrationPhase; enteredAt: Date }>;
  metadata: Record<string, unknown>;
}

type StateListener = (state: OrchestrationState) => void;

const VALID_TRANSITIONS: Record<OrchestrationStatus, OrchestrationStatus[]> = {
  pending:   ['running', 'cancelled'],
  running:   ['completed', 'failed', 'cancelled'],
  completed: [],
  failed:    [],
  cancelled: [],
};

class StateManager extends EventEmitter {
  private states = new Map<string, OrchestrationState>();

  init(runId: string): OrchestrationState {
    const state: OrchestrationState = {
      runId,
      status: 'pending',
      phase: null,
      startedAt: null,
      completedAt: null,
      error: null,
      phaseHistory: [],
      metadata: {},
    };
    this.states.set(runId, state);
    this.emit('state.init', state);
    return { ...state };
  }

  transition(runId: string, status: OrchestrationStatus): OrchestrationState {
    const state = this.states.get(runId);
    if (!state) throw new Error(`[state-manager] Unknown run: ${runId}`);

    const allowed = VALID_TRANSITIONS[state.status];
    if (!allowed.includes(status)) {
      throw new Error(`[state-manager] Invalid transition ${state.status} → ${status} for run ${runId}`);
    }

    state.status = status;
    if (status === 'running') state.startedAt ??= new Date();
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      state.completedAt = new Date();
    }

    this.emit('state.changed', { ...state });
    return { ...state };
  }

  setPhase(runId: string, phase: OrchestrationPhase): void {
    const state = this.states.get(runId);
    if (!state) throw new Error(`[state-manager] Unknown run: ${runId}`);
    state.phase = phase;
    state.phaseHistory.push({ phase, enteredAt: new Date() });
    this.emit('phase.changed', { runId, phase });
  }

  setError(runId: string, error: string): void {
    const state = this.states.get(runId);
    if (state) state.error = error;
  }

  setMeta(runId: string, key: string, value: unknown): void {
    const state = this.states.get(runId);
    if (state) state.metadata[key] = value;
  }

  get(runId: string): OrchestrationState | undefined {
    const s = this.states.get(runId);
    return s ? { ...s } : undefined;
  }

  snapshot(runId: string): OrchestrationState {
    const s = this.states.get(runId);
    if (!s) throw new Error(`[state-manager] No state for run: ${runId}`);
    return JSON.parse(JSON.stringify(s)) as OrchestrationState;
  }

  clear(runId: string): void {
    this.states.delete(runId);
  }

  activeRunIds(): string[] {
    return Array.from(this.states.entries())
      .filter(([, s]) => s.status === 'running')
      .map(([id]) => id);
  }

  onStateChange(listener: StateListener): void {
    this.on('state.changed', listener);
  }
}

export const stateManager = new StateManager();
stateManager.setMaxListeners(50);
