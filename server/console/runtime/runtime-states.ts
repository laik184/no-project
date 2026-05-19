/**
 * IQ 2000 — Console · Runtime · State Machine
 *
 * Tracks per-project runtime state and transitions.
 * Emits 'console.state' bus events on every valid transition.
 * Uses intelligent parsing meta to drive most transitions.
 */

import { bus } from '../../infrastructure/events/bus.ts';
import type { RuntimeState, ConsoleLineMeta } from '../types.ts';

interface StateRecord {
  state:     RuntimeState;
  ts:        number;
  message?:  string;
}

// Valid forward transitions (prevents flip-flopping)
const TRANSITIONS: Partial<Record<RuntimeState, RuntimeState[]>> = {
  idle:         ['starting', 'installing', 'failed'],
  starting:     ['installing', 'compiling', 'ready', 'crashed', 'warning'],
  installing:   ['starting', 'compiling', 'ready', 'crashed', 'failed'],
  compiling:    ['ready', 'crashed', 'warning', 'failed'],
  ready:        ['restarting', 'crashed', 'warning', 'recovering'],
  restarting:   ['starting', 'installing', 'crashed', 'failed'],
  crashed:      ['recovering', 'restarting', 'failed'],
  recovering:   ['recovered', 'failed', 'crashed'],
  recovered:    ['ready', 'restarting'],
  warning:      ['ready', 'crashed', 'recovering'],
  reconnecting: ['starting', 'crashed'],
  failed:       ['starting', 'restarting'],
};

class RuntimeStateService {
  private states = new Map<number, StateRecord>();

  getState(projectId: number): RuntimeState {
    return this.states.get(projectId)?.state ?? 'idle';
  }

  /**
   * Transition to `next` state if allowed.
   * Returns true when a transition actually occurred.
   */
  transition(projectId: number, next: RuntimeState, message?: string): boolean {
    const current = this.getState(projectId);
    if (current === next) return false;

    const allowed = TRANSITIONS[current];
    if (allowed && !allowed.includes(next)) return false;

    this.states.set(projectId, { state: next, ts: Date.now(), message });

    // Emit bus event — subscription-manager fans it out via main SSE
    (bus as any).emit('console.state', {
      projectId,
      state:   next,
      prev:    current,
      message: message ?? '',
      ts:      Date.now(),
    });

    return true;
  }

  /**
   * Derive state transitions from parsed meta produced by the intelligence layer.
   * Called once per log line after parsing.
   */
  inferFromMeta(projectId: number, text: string, meta?: ConsoleLineMeta): void {
    if (meta?.vite) {
      const v = meta.vite;
      if (v.type === 'ready')         this.transition(projectId, 'ready', 'Development server ready');
      else if (v.type === 'build-start') this.transition(projectId, 'compiling', 'Building…');
      else if (v.type === 'compile-error') this.transition(projectId, 'warning', 'Compile error');
      return;
    }

    if (meta?.npm) {
      const n = meta.npm;
      if (n.type === 'install-start' || n.type === 'install-progress') {
        this.transition(projectId, 'installing', 'Installing packages…');
      } else if (n.type === 'install-done') {
        const cur = this.getState(projectId);
        if (cur === 'installing') this.transition(projectId, 'starting', 'Packages installed');
      } else if (n.type === 'install-error') {
        this.transition(projectId, 'failed', 'Package install failed');
      }
      return;
    }

    if (meta?.node) {
      const n = meta.node;
      if (n.type === 'uncaught' || n.type === 'unhandled') {
        this.transition(projectId, 'crashed', n.message ?? 'Runtime exception');
      }
      return;
    }

    // Text-based heuristics for common patterns not covered by parsers
    const s = text.toLowerCase();
    if (/(listening on|server running on port|ready on|api server running)/.test(s)) {
      this.transition(projectId, 'ready');
    }
  }

  /** Force-set state (e.g. when process exits). */
  force(projectId: number, state: RuntimeState, message?: string): void {
    const current = this.getState(projectId);
    this.states.set(projectId, { state, ts: Date.now(), message });
    if (current !== state) {
      (bus as any).emit('console.state', {
        projectId, state, prev: current, message: message ?? '', ts: Date.now(),
      });
    }
  }

  reset(projectId: number): void {
    this.states.delete(projectId);
  }
}

export const runtimeStates = new RuntimeStateService();
