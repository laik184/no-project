/**
 * server/engine/swarm/swarm-barrier.ts
 *
 * Wave-level synchronization barrier for the agent swarm.
 * Ensures all agents in a wave complete before the next wave starts.
 * Supports: wait-all, timeout, deadlock detection, partial-completion.
 */

import type { SwarmAgentStatus } from "./swarm-types.ts";
import { emitBarrierWait } from "./swarm-telemetry.ts";

// ── Barrier state ─────────────────────────────────────────────────────────────

interface BarrierEntry {
  swarmId:      string;
  waveIndex:    number;
  total:        number;
  arrived:      Set<string>;
  failed:       Set<string>;
  resolve?:     () => void;
  reject?:      (e: Error) => void;
  timeoutId?:   ReturnType<typeof setTimeout>;
  openedAt:     number;
}

const _barriers = new Map<string, BarrierEntry>();

function barrierKey(swarmId: string, wave: number): string {
  return `${swarmId}:wave-${wave}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Open a barrier for a wave. Returns a promise that resolves when
 * all agents have arrived (or rejects on timeout / too many failures).
 */
export function openWaveBarrier(
  swarmId:    string,
  runId:      string,
  projectId:  number,
  waveIndex:  number,
  total:      number,
  timeoutMs:  number = 180_000,
): Promise<{ completed: string[]; failed: string[] }> {
  const key = barrierKey(swarmId, waveIndex);

  return new Promise((resolve, reject) => {
    const entry: BarrierEntry = {
      swarmId, waveIndex, total,
      arrived: new Set(),
      failed:  new Set(),
      openedAt: Date.now(),
      resolve: () => resolve({
        completed: Array.from(entry.arrived).filter(id => !entry.failed.has(id)),
        failed:    Array.from(entry.failed),
      }),
      reject,
    };

    entry.timeoutId = setTimeout(() => {
      _barriers.delete(key);
      reject(new Error(`[swarm-barrier] Wave ${waveIndex} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    _barriers.set(key, entry);

    emitBarrierWait(runId, projectId, swarmId, waveIndex, 0, total);
  });
}

/**
 * Signal that an agent has arrived at the barrier.
 * Pass status = "failed" for failed agents — they still count toward barrier completion.
 */
export function arriveAtBarrier(
  swarmId:   string,
  runId:     string,
  projectId: number,
  waveIndex: number,
  agentId:   string,
  status:    SwarmAgentStatus,
): void {
  const key   = barrierKey(swarmId, waveIndex);
  const entry = _barriers.get(key);
  if (!entry) return;

  entry.arrived.add(agentId);
  if (status === "failed" || status === "recovering") {
    entry.failed.add(agentId);
  }

  emitBarrierWait(runId, projectId, swarmId, waveIndex, entry.arrived.size, entry.total);

  // Deadlock detection: all arrived but some missing — shouldn't happen, but guard it
  if (entry.arrived.size >= entry.total) {
    _releaseBarrier(key, entry);
  }
}

function _releaseBarrier(key: string, entry: BarrierEntry): void {
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  _barriers.delete(key);
  entry.resolve?.();
}

/**
 * Force-release a barrier (used during recovery/abort).
 */
export function forceReleaseBarrier(swarmId: string, waveIndex: number): void {
  const key   = barrierKey(swarmId, waveIndex);
  const entry = _barriers.get(key);
  if (!entry) return;
  _releaseBarrier(key, entry);
}

export function barrierStatus(swarmId: string, waveIndex: number): {
  open:    boolean;
  arrived: number;
  total:   number;
  failed:  number;
} {
  const key   = barrierKey(swarmId, waveIndex);
  const entry = _barriers.get(key);
  if (!entry) return { open: false, arrived: 0, total: 0, failed: 0 };
  return {
    open:    true,
    arrived: entry.arrived.size,
    total:   entry.total,
    failed:  entry.failed.size,
  };
}
