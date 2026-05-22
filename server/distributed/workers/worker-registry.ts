/**
 * Responsibility: Central registry of all active WorkerSlots — single source of truth.
 * Dependencies: worker-slot.ts
 * Failure: stale or terminated slots evicted; getIdle() never returns terminated slots.
 * Telemetry: stats() exposed to worker-trace for instrumentation.
 */

import {
  WorkerSlot,
  WorkerType,
  WorkerSlotStatus,
  WorkerSlotOptions,
  createWorkerSlot,
} from "./worker-slot.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkerStats {
  total:      number;
  idle:       number;
  busy:       number;
  draining:   number;
  failed:     number;
  terminated: number;
}

// ── Registry ──────────────────────────────────────────────────────────────────

class WorkerRegistry {
  private readonly slots = new Map<string, WorkerSlot>();
  private seq = 0;

  /** Allocate and register a new worker slot. */
  register(type: WorkerType, opts: WorkerSlotOptions = {}): WorkerSlot {
    const id   = `worker-${type}-${++this.seq}`;
    const slot = createWorkerSlot(id, type, opts);
    this.slots.set(id, slot);
    return slot;
  }

  /** Replace a slot with its updated version (immutable update pattern). */
  update(slot: WorkerSlot): void {
    this.slots.set(slot.id, slot);
  }

  /** Remove a slot entirely (called after termination + cleanup). */
  remove(id: string): void {
    this.slots.delete(id);
  }

  /** Get slot by id. */
  get(id: string): WorkerSlot | undefined {
    return this.slots.get(id);
  }

  /** All registered slots (snapshot). */
  all(): ReadonlyArray<WorkerSlot> {
    return [...this.slots.values()];
  }

  /** Slots in a given status, optionally filtered by type. */
  byStatus(status: WorkerSlotStatus, type?: WorkerType): WorkerSlot[] {
    return [...this.slots.values()].filter(
      s => s.status === status && (!type || s.type === type),
    );
  }

  /** Available (idle) slots — never returns failed/terminated. */
  getIdle(type?: WorkerType): WorkerSlot[] {
    return this.byStatus("idle", type);
  }

  /** Busy slots — for timeout scanning. */
  getBusy(): WorkerSlot[] {
    return this.byStatus("busy");
  }

  /** Snapshot stats for telemetry. */
  stats(): WorkerStats {
    const all = [...this.slots.values()];
    return {
      total:      all.length,
      idle:       all.filter(s => s.status === "idle").length,
      busy:       all.filter(s => s.status === "busy").length,
      draining:   all.filter(s => s.status === "draining").length,
      failed:     all.filter(s => s.status === "failed").length,
      terminated: all.filter(s => s.status === "terminated").length,
    };
  }

  /** Remove all terminated slots (housekeeping). */
  evictTerminated(): number {
    let count = 0;
    for (const [id, slot] of this.slots) {
      if (slot.status === "terminated") {
        this.slots.delete(id);
        count++;
      }
    }
    return count;
  }
}

export const workerRegistry = new WorkerRegistry();
