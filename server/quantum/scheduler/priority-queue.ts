/**
 * priority-queue.ts
 *
 * Min-heap priority queue for worker task scheduling.
 * Lower priority number = higher urgency (processed first).
 * O(log n) enqueue/dequeue.
 */

import type { WorkerTask } from "../types/quantum.types.ts";

// ── Heap node ─────────────────────────────────────────────────────────────────

interface HeapNode {
  priority:  number;
  insertedAt: number;   // tie-break: earlier insertion wins
  task:      WorkerTask;
}

// ── Min-heap implementation ───────────────────────────────────────────────────

export class PriorityQueue {
  private readonly _heap: HeapNode[] = [];
  private _insertionCounter          = 0;

  get size(): number {
    return this._heap.length;
  }

  get isEmpty(): boolean {
    return this._heap.length === 0;
  }

  enqueue(task: WorkerTask): void {
    const node: HeapNode = {
      priority:   task.priority,
      insertedAt: this._insertionCounter++,
      task,
    };
    this._heap.push(node);
    this._bubbleUp(this._heap.length - 1);
  }

  dequeue(): WorkerTask | undefined {
    if (this._heap.length === 0) return undefined;
    const top    = this._heap[0];
    const last   = this._heap.pop()!;
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._siftDown(0);
    }
    return top.task;
  }

  peek(): WorkerTask | undefined {
    return this._heap[0]?.task;
  }

  /**
   * Remove a specific task by taskId.
   * O(n) — only used for cancellation.
   */
  remove(taskId: string): boolean {
    const idx = this._heap.findIndex(n => n.task.taskId === taskId);
    if (idx === -1) return false;

    const last = this._heap.pop()!;
    if (idx < this._heap.length) {
      this._heap[idx] = last;
      this._bubbleUp(idx);
      this._siftDown(idx);
    }
    return true;
  }

  toArray(): WorkerTask[] {
    return [...this._heap]
      .sort((a, b) => a.priority - b.priority || a.insertedAt - b.insertedAt)
      .map(n => n.task);
  }

  clear(): void {
    this._heap.length = 0;
  }

  // ── Private heap operations ─────────────────────────────────────────────────

  private _compare(a: HeapNode, b: HeapNode): boolean {
    if (a.priority !== b.priority) return a.priority < b.priority;
    return a.insertedAt < b.insertedAt;
  }

  private _bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this._compare(this._heap[idx], this._heap[parent])) {
        [this._heap[idx], this._heap[parent]] = [this._heap[parent], this._heap[idx]];
        idx = parent;
      } else {
        break;
      }
    }
  }

  private _siftDown(idx: number): void {
    const n = this._heap.length;
    while (true) {
      let smallest = idx;
      const left   = 2 * idx + 1;
      const right  = 2 * idx + 2;
      if (left  < n && this._compare(this._heap[left],  this._heap[smallest])) smallest = left;
      if (right < n && this._compare(this._heap[right], this._heap[smallest])) smallest = right;
      if (smallest === idx) break;
      [this._heap[idx], this._heap[smallest]] = [this._heap[smallest], this._heap[idx]];
      idx = smallest;
    }
  }
}
