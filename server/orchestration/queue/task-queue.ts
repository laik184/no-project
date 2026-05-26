import { EventEmitter } from 'events';
import type { TaskPayload, TaskPriority } from '../events/event-types.ts';
import { priorityWeight } from '../utils/orchestration-helpers.ts';

interface QueueEntry {
  task: TaskPayload;
  weight: number;
  enqueuedAt: Date;
}

interface QueueStats {
  size: number;
  enqueuedTotal: number;
  dequeuedTotal: number;
}

export class TaskQueue extends EventEmitter {
  private queue: QueueEntry[] = [];
  private stats: QueueStats = { size: 0, enqueuedTotal: 0, dequeuedTotal: 0 };

  enqueue(task: TaskPayload): void {
    const entry: QueueEntry = {
      task,
      weight: priorityWeight(task.priority),
      enqueuedAt: new Date(),
    };
    this.queue.push(entry);
    this.queue.sort((a, b) => b.weight - a.weight);
    this.stats.size++;
    this.stats.enqueuedTotal++;
    this.emit('task.enqueued', task);
  }

  dequeue(): TaskPayload | undefined {
    const entry = this.queue.shift();
    if (!entry) return undefined;
    this.stats.size--;
    this.stats.dequeuedTotal++;
    this.emit('task.dequeued', entry.task);
    return entry.task;
  }

  peek(): TaskPayload | undefined {
    return this.queue[0]?.task;
  }

  peekByPriority(priority: TaskPriority): TaskPayload | undefined {
    return this.queue.find((e) => e.task.priority === priority)?.task;
  }

  remove(taskId: string): boolean {
    const before = this.queue.length;
    this.queue = this.queue.filter((e) => e.task.taskId !== taskId);
    const removed = this.queue.length < before;
    if (removed) {
      this.stats.size--;
      this.emit('task.removed', taskId);
    }
    return removed;
  }

  size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  drain(): TaskPayload[] {
    const all = this.queue.map((e) => e.task);
    this.queue = [];
    this.stats.size = 0;
    this.emit('queue.drained');
    return all;
  }

  getStats(): Readonly<QueueStats> {
    return { ...this.stats };
  }

  getAll(): TaskPayload[] {
    return this.queue.map((e) => e.task);
  }

  hasTask(taskId: string): boolean {
    return this.queue.some((e) => e.task.taskId === taskId);
  }
}

export const taskQueue = new TaskQueue();
taskQueue.setMaxListeners(20);
