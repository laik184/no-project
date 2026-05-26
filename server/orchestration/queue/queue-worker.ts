import { taskQueue } from './task-queue.ts';
import type { TaskPayload } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { emitTaskStarted, emitTaskCompleted, emitTaskFailed } from '../events/orchestration-events.ts';
import { sleep } from '../utils/execution-utils.ts';

type TaskHandler = (task: TaskPayload) => Promise<unknown>;

interface WorkerConfig {
  concurrency: number;
  pollIntervalMs: number;
  runId: string;
}

export class QueueWorker {
  private handlers = new Map<string, TaskHandler>();
  private active = 0;
  private running = false;
  private config: WorkerConfig;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  registerHandler(type: string, handler: TaskHandler): void {
    this.handlers.set(type, handler);
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    runLogger.log(this.config.runId, 'info', `[queue-worker] Started (concurrency=${this.config.concurrency})`);
    this.poll();
  }

  stop(): void {
    this.running = false;
    runLogger.log(this.config.runId, 'info', '[queue-worker] Stopping — draining active tasks');
  }

  private async poll(): Promise<void> {
    while (this.running) {
      if (this.active < this.config.concurrency && !taskQueue.isEmpty()) {
        const task = taskQueue.dequeue();
        if (task) {
          this.active++;
          this.processTask(task).finally(() => { this.active--; });
        }
      } else {
        await sleep(this.config.pollIntervalMs);
      }
    }
  }

  private async processTask(task: TaskPayload): Promise<void> {
    const handler = this.handlers.get(task.type);
    if (!handler) {
      runLogger.log(task.runId, 'warn', `[queue-worker] No handler for task type "${task.type}"`);
      emitTaskFailed(task, `No handler registered for type: ${task.type}`);
      return;
    }

    emitTaskStarted(task);
    runLogger.log(task.runId, 'info', `[queue-worker] Processing task ${task.taskId} (${task.type})`);

    try {
      const result = await handler(task);
      emitTaskCompleted(task, result);
      runLogger.log(task.runId, 'info', `[queue-worker] Task ${task.taskId} completed`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitTaskFailed(task, msg);
      runLogger.log(task.runId, 'error', `[queue-worker] Task ${task.taskId} failed: ${msg}`);
    }
  }

  getActiveCount(): number { return this.active; }
  isRunning(): boolean { return this.running; }
}
