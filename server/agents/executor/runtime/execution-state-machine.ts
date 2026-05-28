/**
 * server/agents/executor/runtime/execution-state-machine.ts
 *
 * Centralized RUN-level lifecycle governance for the executor agent.
 * Tracks macro execution state (IDLE → PLANNING → EXECUTING → … → COMPLETED)
 * and enforces valid transitions. Distinct from executor-state.ts which tracks
 * individual step statuses.
 *
 * No execution logic. No tool imports.
 */

// ── States ────────────────────────────────────────────────────────────────────

export type MachineState =
  | 'IDLE'
  | 'PLANNING'
  | 'EXECUTING'
  | 'VALIDATING'
  | 'RETRYING'
  | 'RECOVERING'
  | 'FAILED'
  | 'COMPLETED'
  | 'ESCALATED'
  | 'CANCELLED';

// ── Valid transitions ─────────────────────────────────────────────────────────
//   IDLE        → PLANNING
//   PLANNING    → EXECUTING | FAILED | CANCELLED
//   EXECUTING   → VALIDATING | RETRYING | RECOVERING | FAILED | COMPLETED | CANCELLED
//   VALIDATING  → COMPLETED | EXECUTING | RETRYING | RECOVERING | FAILED
//   RETRYING    → EXECUTING | FAILED | RECOVERING | CANCELLED
//   RECOVERING  → EXECUTING | RETRYING | FAILED | ESCALATED | CANCELLED
//   FAILED      → RECOVERING | ESCALATED   (terminal if no recovery)
//   COMPLETED   → (terminal)
//   ESCALATED   → (terminal)
//   CANCELLED   → (terminal)

const TRANSITIONS: Record<MachineState, MachineState[]> = {
  IDLE:       ['PLANNING'],
  PLANNING:   ['EXECUTING', 'FAILED', 'CANCELLED'],
  EXECUTING:  ['VALIDATING', 'RETRYING', 'RECOVERING', 'FAILED', 'COMPLETED', 'CANCELLED'],
  VALIDATING: ['COMPLETED', 'EXECUTING', 'RETRYING', 'RECOVERING', 'FAILED'],
  RETRYING:   ['EXECUTING', 'FAILED', 'RECOVERING', 'CANCELLED'],
  RECOVERING: ['EXECUTING', 'RETRYING', 'FAILED', 'ESCALATED', 'CANCELLED'],
  FAILED:     ['RECOVERING', 'ESCALATED'],
  COMPLETED:  [],
  ESCALATED:  [],
  CANCELLED:  [],
};

export const TERMINAL_STATES: ReadonlySet<MachineState> = new Set([
  'COMPLETED', 'FAILED', 'ESCALATED', 'CANCELLED',
]);

// ── Machine entry ─────────────────────────────────────────────────────────────

export interface StateMachineEntry {
  runId:      string;
  state:      MachineState;
  history:    Array<{ from: MachineState; to: MachineState; reason?: string; ts: number }>;
  startedAt:  number;
  updatedAt:  number;
  metadata:   Record<string, unknown>;
}

export class StateMachineError extends Error {
  constructor(
    public readonly runId: string,
    public readonly from: MachineState,
    public readonly to: MachineState,
  ) {
    super(`[execution-state-machine] Invalid transition [${from}→${to}] for run ${runId}. Allowed: [${TRANSITIONS[from].join(', ')}]`);
    this.name = 'StateMachineError';
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

const _machines = new Map<string, StateMachineEntry>();

// ── API ───────────────────────────────────────────────────────────────────────

export const executionStateMachine = {
  /** Initialize a machine for a run. Idempotent. */
  init(runId: string, meta: Record<string, unknown> = {}): StateMachineEntry {
    if (_machines.has(runId)) return _machines.get(runId)!;
    const entry: StateMachineEntry = {
      runId,
      state:     'IDLE',
      history:   [],
      startedAt: Date.now(),
      updatedAt: Date.now(),
      metadata:  meta,
    };
    _machines.set(runId, entry);
    return entry;
  },

  getState(runId: string): MachineState | undefined {
    return _machines.get(runId)?.state;
  },

  /** Attempt a state transition. Throws StateMachineError on invalid transition. */
  transition(runId: string, to: MachineState, reason?: string): StateMachineEntry {
    const entry = _machines.get(runId);
    if (!entry) throw new Error(`[execution-state-machine] No machine found for run ${runId}`);

    const allowed = TRANSITIONS[entry.state];
    if (!allowed.includes(to)) {
      throw new StateMachineError(runId, entry.state, to);
    }

    entry.history.push({ from: entry.state, to, reason, ts: Date.now() });
    entry.state     = to;
    entry.updatedAt = Date.now();
    return entry;
  },

  /** Transition only if valid — returns false instead of throwing. */
  tryTransition(runId: string, to: MachineState, reason?: string): boolean {
    try {
      this.transition(runId, to, reason);
      return true;
    } catch {
      return false;
    }
  },

  canTransition(runId: string, to: MachineState): boolean {
    const entry = _machines.get(runId);
    if (!entry) return false;
    return TRANSITIONS[entry.state].includes(to);
  },

  isTerminal(runId: string): boolean {
    const state = this.getState(runId);
    return state !== undefined && TERMINAL_STATES.has(state);
  },

  snapshot(runId: string): StateMachineEntry | undefined {
    return _machines.get(runId);
  },

  allActive(): StateMachineEntry[] {
    return [..._machines.values()].filter((e) => !TERMINAL_STATES.has(e.state));
  },

  setMetadata(runId: string, key: string, value: unknown): void {
    const entry = _machines.get(runId);
    if (entry) entry.metadata[key] = value;
  },

  deregister(runId: string): void { _machines.delete(runId); },
  reset():      void { _machines.clear(); },
  size():       number { return _machines.size; },
};
