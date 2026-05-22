/**
 * Responsibility: Distributed synchronization barrier — blocks downstream execution
 *                 until all expected parallel workers have "arrived" at the barrier.
 *                 Implements the classic barrier synchronization primitive in-process.
 * Dependencies: bus
 * Failure: timeout resolves the barrier with partial results; caller handles incomplete state.
 * Telemetry: emits sync.wait when a worker arrives; distributed.recovery on timeout.
 */

import { bus } from "./bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BarrierState {
  runId:     string;
  name:      string;
  expected:  number;
  arrived:   Set<string>;
  resolve:   () => void;
  reject:    (err: Error) => void;
  promise:   Promise<void>;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

// ── Barrier ───────────────────────────────────────────────────────────────────

class DistributedSyncBarrier {
  private readonly barriers = new Map<string, BarrierState>();

  /** Create a barrier for `expected` workers. Returns a promise that resolves when all arrive. */
  create(runId: string, name: string, expected: number, timeoutMs = 60_000): Promise<void> {
    const key = `${runId}::${name}`;

    let resolve!: () => void;
    let reject!:  (e: Error) => void;
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });

    const timeoutId = setTimeout(() => {
      const b = this.barriers.get(key);
      if (!b) return;
      this.barriers.delete(key);

      bus.emit("agent.event", {
        runId, projectId: 0,
        phase:     "distributed.sync",
        agentName: "sync-barrier",
        eventType: "distributed.recovery",
        payload:   { barrier: name, expected, arrived: b.arrived.size, reason: "barrier_timeout" },
        ts:        Date.now(),
      });

      reject(new Error(`[sync-barrier] Barrier "${name}" timeout (arrived ${b.arrived.size}/${expected})`));
    }, timeoutMs);

    this.barriers.set(key, { runId, name, expected, arrived: new Set(), resolve, reject, promise, timeoutId });
    return promise;
  }

  /** Mark a worker as arrived. Resolves the barrier promise if all expected workers have arrived. */
  arrive(runId: string, name: string, workerId: string): void {
    const key     = `${runId}::${name}`;
    const barrier = this.barriers.get(key);
    if (!barrier) return;

    barrier.arrived.add(workerId);

    bus.emit("agent.event", {
      runId, projectId: 0,
      phase:     "distributed.sync",
      agentName: "sync-barrier",
      eventType: "sync.wait",
      payload:   { barrier: name, workerId, arrived: barrier.arrived.size, expected: barrier.expected },
      ts:        Date.now(),
    });

    if (barrier.arrived.size >= barrier.expected) {
      if (barrier.timeoutId) clearTimeout(barrier.timeoutId);
      this.barriers.delete(key);
      barrier.resolve();
    }
  }

  /** Cancel an in-flight barrier (e.g. run aborted). */
  cancel(runId: string, name: string): void {
    const key     = `${runId}::${name}`;
    const barrier = this.barriers.get(key);
    if (!barrier) return;
    if (barrier.timeoutId) clearTimeout(barrier.timeoutId);
    this.barriers.delete(key);
    barrier.reject(new Error(`[sync-barrier] Barrier "${name}" cancelled`));
  }

  activeCount(): number {
    return this.barriers.size;
  }
}

export const distributedSyncBarrier = new DistributedSyncBarrier();
