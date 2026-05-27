import type { PlanTask } from '../types/executor.types.ts';

interface QueueEntry {
  task:       PlanTask;
  enqueuedAt: Date;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 4, high: 3, normal: 2, low: 1,
};

export class ExecutionQueue {
  private items: QueueEntry[] = [];

  enqueue(task: PlanTask): void {
    this.items.push({ task, enqueuedAt: new Date() });
    this.sort();
  }

  enqueueAll(tasks: PlanTask[]): void {
    for (const t of tasks) this.items.push({ task: t, enqueuedAt: new Date() });
    this.sort();
  }

  dequeue(): PlanTask | undefined {
    const entry = this.items.shift();
    return entry?.task;
  }

  peek(): PlanTask | undefined {
    return this.items[0]?.task;
  }

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  toArray(): PlanTask[] {
    return this.items.map((e) => e.task);
  }

  clear(): void {
    this.items = [];
  }

  private sort(): void {
    this.items.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.task.priority] ?? 2;
      const pb = PRIORITY_ORDER[b.task.priority] ?? 2;
      if (pb !== pa) return pb - pa;
      return a.enqueuedAt.getTime() - b.enqueuedAt.getTime();
    });
  }
}
