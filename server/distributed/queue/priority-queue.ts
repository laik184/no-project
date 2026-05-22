/**
 * Responsibility: Generic min-heap priority queue with deterministic ordering.
 *                 Lower priority number = higher urgency (CRITICAL=0, LOW=3).
 * Dependencies: none — pure data structure.
 * Failure: peek/dequeue on empty queue returns undefined; never throws.
 * Telemetry: none — pure data structure; queue-trace instruments the consumer.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export const TaskPriority = {
  CRITICAL: 0,
  HIGH:     1,
  NORMAL:   2,
  LOW:      3,
} as const;

export type TaskPriorityLevel = (typeof TaskPriority)[keyof typeof TaskPriority];

export interface PriorityItem<T> {
  priority:   TaskPriorityLevel;
  insertedAt: number;     // for FIFO within same priority
  value:      T;
}

// ── Heap ──────────────────────────────────────────────────────────────────────

export class PriorityQueue<T> {
  private readonly heap: PriorityItem<T>[] = [];

  get size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  enqueue(value: T, priority: TaskPriorityLevel): void {
    this.heap.push({ priority, insertedAt: Date.now(), value });
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0].value;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  peek(): T | undefined {
    return this.heap[0]?.value;
  }

  peekPriority(): TaskPriorityLevel | undefined {
    return this.heap[0]?.priority;
  }

  /** Drain all items in priority order. */
  drain(): T[] {
    const out: T[] = [];
    while (!this.isEmpty()) out.push(this.dequeue()!);
    return out;
  }

  /** Snapshot current items (for dead-letter / persistence). */
  snapshot(): ReadonlyArray<PriorityItem<T>> {
    return [...this.heap];
  }

  // ── Heap internals ─────────────────────────────────────────────────────────

  private compare(a: PriorityItem<T>, b: PriorityItem<T>): number {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.insertedAt - b.insertedAt; // FIFO within same priority
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.compare(this.heap[idx], this.heap[parent]) >= 0) break;
      [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = idx;
      const l = 2 * idx + 1;
      const r = 2 * idx + 2;
      if (l < n && this.compare(this.heap[l], this.heap[smallest]) < 0) smallest = l;
      if (r < n && this.compare(this.heap[r], this.heap[smallest]) < 0) smallest = r;
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}
