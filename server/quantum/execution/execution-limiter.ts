/**
 * server/quantum/execution/execution-limiter.ts
 *
 * Per-runId (and optionally per-agentId) concurrency semaphore.
 * Prevents any single run from monopolising pool workers.
 * Fail-closed: acquire() rejects immediately if at limit — no queuing inside.
 */

import { PerRunLimitError } from "../scheduler/worker-errors.ts";

// ── Semaphore ─────────────────────────────────────────────────────────────────

class Semaphore {
  private active = 0;
  constructor(private readonly limit: number) {}

  /** Returns true if the slot was acquired, false if at limit. */
  tryAcquire(): boolean {
    if (this.active >= this.limit) return false;
    this.active++;
    return true;
  }

  release(): void {
    if (this.active > 0) this.active--;
  }

  get count(): number { return this.active; }
  get available(): boolean { return this.active < this.limit; }
}

// ── Limiter ───────────────────────────────────────────────────────────────────

export interface LimiterConfig {
  globalLimit:  number;
  perRunLimit:  number;
}

const DEFAULT_CONFIG: LimiterConfig = {
  globalLimit: 50,
  perRunLimit:  8,
};

class ExecutionLimiter {
  private config: LimiterConfig = { ...DEFAULT_CONFIG };
  private readonly runSemaphores = new Map<string, Semaphore>();
  private globalActive           = 0;

  configure(cfg: Partial<LimiterConfig>): void {
    this.config = { ...this.config, ...cfg };
  }

  /**
   * Try to acquire a slot for the given runId.
   * Throws PerRunLimitError if the per-run cap is reached.
   * Returns a release() function — always call it when the task finishes.
   */
  acquire(runId: string): () => void {
    const sem = this.getOrCreate(runId);

    if (!sem.tryAcquire()) {
      throw new PerRunLimitError(runId, sem.count, this.config.perRunLimit);
    }

    this.globalActive++;

    return () => {
      sem.release();
      if (this.globalActive > 0) this.globalActive--;
      if (sem.count === 0) this.runSemaphores.delete(runId);
    };
  }

  /** Read-only: current active count for a run. */
  activeFor(runId: string): number {
    return this.runSemaphores.get(runId)?.count ?? 0;
  }

  /** Whether the given runId has capacity available. */
  hasCapacity(runId: string): boolean {
    const sem = this.runSemaphores.get(runId);
    return !sem || sem.available;
  }

  /** Global metrics. */
  stats() {
    const perRun: Record<string, number> = {};
    for (const [runId, sem] of this.runSemaphores) {
      perRun[runId] = sem.count;
    }
    return {
      globalActive:  this.globalActive,
      activeRuns:    this.runSemaphores.size,
      perRun,
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private getOrCreate(runId: string): Semaphore {
    let sem = this.runSemaphores.get(runId);
    if (!sem) {
      sem = new Semaphore(this.config.perRunLimit);
      this.runSemaphores.set(runId, sem);
    }
    return sem;
  }
}

export const executionLimiter = new ExecutionLimiter();
