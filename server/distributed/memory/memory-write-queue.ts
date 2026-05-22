/**
 * Responsibility: Serializes concurrent memory writes per projectId.
 *                 Prevents race conditions on project memory files (context.md, decisions.json).
 * Dependencies: none — pure async queue using promise chaining.
 * Failure: write fn throws → error propagated to caller; queue continues for other callers.
 * Telemetry: queue depth per projectId exposed for distributed-trace.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WriteOperation<T> {
  projectId:  number;
  key:        string;   // which memory file/key to write
  fn:         () => Promise<T>;
  queuedAt:   number;
}

// ── Queue ────────────────────────────────────────────────────────────────────

class MemoryWriteQueue {
  /** projectId → tail of the promise chain (serialization anchor) */
  private readonly chains = new Map<number, Promise<unknown>>();
  /** projectId → current queue depth */
  private readonly depths = new Map<number, number>();

  /**
   * Enqueue a write operation for a projectId.
   * Writes for the same projectId execute in FIFO order; different projectIds run in parallel.
   */
  enqueue<T>(op: Omit<WriteOperation<T>, "queuedAt">): Promise<T> {
    const { projectId, fn } = op;
    const depth  = (this.depths.get(projectId) ?? 0) + 1;
    this.depths.set(projectId, depth);

    const tail = this.chains.get(projectId) ?? Promise.resolve();

    const next = tail
      .catch(() => { /* previous failure must not block next write */ })
      .then(() => fn())
      .finally(() => {
        const d = (this.depths.get(projectId) ?? 1) - 1;
        this.depths.set(projectId, d);
        if (d === 0) {
          this.chains.delete(projectId);
          this.depths.delete(projectId);
        }
      });

    this.chains.set(projectId, next);
    return next as Promise<T>;
  }

  /** Queue depth for a projectId (0 if idle). */
  depth(projectId: number): number {
    return this.depths.get(projectId) ?? 0;
  }

  /** All project IDs with active queues. */
  activeProjects(): number[] {
    return [...this.depths.keys()];
  }

  stats() {
    return {
      activeProjects: this.depths.size,
      depths:         Object.fromEntries([...this.depths.entries()].map(([k, v]) => [String(k), v])),
    };
  }
}

export const memoryWriteQueue = new MemoryWriteQueue();
