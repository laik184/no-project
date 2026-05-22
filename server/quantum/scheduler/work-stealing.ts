/**
 * work-stealing.ts
 *
 * Work-stealing scheduler: idle workers steal tasks from busy workers' queues.
 * Prevents starvation when one path generates more tasks than others.
 * Each worker has a local deque; stealing takes from the back (tail).
 */

import type { WorkerTask } from "../types/quantum.types.ts";

// ── Worker deque (double-ended queue) ─────────────────────────────────────────

class WorkerDeque {
  private _tasks: WorkerTask[] = [];

  get size(): number { return this._tasks.length; }
  get isEmpty(): boolean { return this._tasks.length === 0; }

  pushFront(task: WorkerTask): void { this._tasks.unshift(task); }
  pushBack(task:  WorkerTask): void { this._tasks.push(task); }

  popFront(): WorkerTask | undefined { return this._tasks.shift(); }
  popBack():  WorkerTask | undefined { return this._tasks.pop(); }

  peek(): WorkerTask | undefined { return this._tasks[0]; }

  clear(): void { this._tasks = []; }
}

// ── Work-stealing pool ────────────────────────────────────────────────────────

export class WorkStealingScheduler {
  private readonly _deques = new Map<string, WorkerDeque>();
  private readonly _workerIds: string[] = [];

  constructor(workerIds: string[]) {
    this._workerIds = [...workerIds];
    for (const id of workerIds) {
      this._deques.set(id, new WorkerDeque());
    }
  }

  /**
   * Submit a task to a specific worker's local queue.
   */
  submit(workerId: string, task: WorkerTask): void {
    const deque = this._deques.get(workerId);
    if (!deque) throw new Error(`[work-stealing] Unknown worker: ${workerId}`);
    deque.pushBack(task);
  }

  /**
   * Worker takes a task from its own front queue.
   * If empty, steals from the back of the busiest worker's queue.
   */
  takeOrSteal(workerId: string): WorkerTask | undefined {
    const own = this._deques.get(workerId);
    if (!own) return undefined;

    // Take from own queue first
    if (!own.isEmpty) return own.popFront();

    // Steal from the worker with the most tasks
    return this._steal(workerId);
  }

  private _steal(thiefId: string): WorkerTask | undefined {
    let victim: WorkerDeque | undefined;
    let maxSize = 1;   // only steal if victim has > 1 task (avoid thrashing)

    for (const [id, deque] of this._deques) {
      if (id === thiefId) continue;
      if (deque.size > maxSize) {
        maxSize = deque.size;
        victim  = deque;
      }
    }

    return victim?.popBack();
  }

  /**
   * Find the least-loaded worker for initial task assignment.
   */
  leastLoadedWorker(): string {
    let bestId   = this._workerIds[0];
    let minSize  = Infinity;

    for (const [id, deque] of this._deques) {
      if (deque.size < minSize) {
        minSize = deque.size;
        bestId  = id;
      }
    }

    return bestId;
  }

  totalPending(): number {
    let total = 0;
    for (const deque of this._deques.values()) total += deque.size;
    return total;
  }

  clearAll(): void {
    for (const deque of this._deques.values()) deque.clear();
  }

  workerLoad(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [id, deque] of this._deques) result[id] = deque.size;
    return result;
  }
}
