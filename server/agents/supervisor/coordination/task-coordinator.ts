import type { OrchestrationPhase, TaskPayload, TaskPriority } from '../../../orchestration/events/event-types.ts';
import { taskQueue } from '../../../orchestration/queue/task-queue.ts';
import { emitTaskQueued, emitTaskStarted, emitTaskCompleted, emitTaskFailed } from '../../../orchestration/events/orchestration-events.ts';
import type { ExecutionMode } from '../types/supervisor.types.ts';
import { generateTaskId } from '../utils/supervisor-helpers.ts';
import { supervisorLogger } from '../telemetry/supervisor-logger.ts';
import { supervisorMetrics } from '../telemetry/supervisor-metrics.ts';

export interface TaskSpec {
  runId: string;
  phase: OrchestrationPhase;
  type: string;
  priority: TaskPriority;
  input: Record<string, unknown>;
  mode: ExecutionMode;
}

export const taskCoordinator = {
  enqueue(spec: TaskSpec): TaskPayload {
    const task: TaskPayload = {
      taskId:     generateTaskId(spec.runId, spec.phase),
      runId:      spec.runId,
      type:       spec.type,
      priority:   spec.priority,
      input:      spec.input,
      retryCount: 0,
      createdAt:  new Date(),
    };

    taskQueue.enqueue(task);
    emitTaskQueued(task);
    supervisorLogger.info(spec.runId, `[task-coordinator] Enqueued task "${task.taskId}" type="${task.type}" priority=${task.priority}`);
    supervisorMetrics.increment(spec.runId, 'supervisor.tasks.enqueued');
    return task;
  },

  markStarted(task: TaskPayload): void {
    emitTaskStarted(task);
    supervisorMetrics.increment(task.runId, 'supervisor.tasks.started');
  },

  markCompleted(task: TaskPayload, result: unknown): void {
    emitTaskCompleted(task, result);
    taskQueue.remove(task.taskId);
    supervisorMetrics.increment(task.runId, 'supervisor.tasks.completed');
  },

  markFailed(task: TaskPayload, error: string): void {
    emitTaskFailed(task, error);
    taskQueue.remove(task.taskId);
    supervisorMetrics.increment(task.runId, 'supervisor.tasks.failed');
    supervisorLogger.error(task.runId, `[task-coordinator] Task "${task.taskId}" failed: ${error}`);
  },

  getQueueSize(): number {
    return taskQueue.size();
  },

  hasTask(taskId: string): boolean {
    return taskQueue.hasTask(taskId);
  },

  cancelRunTasks(runId: string): number {
    const tasks = taskQueue.getAll().filter((t) => t.runId === runId);
    tasks.forEach((t) => taskQueue.remove(t.taskId));
    supervisorLogger.info(runId, `[task-coordinator] Cancelled ${tasks.length} queued tasks`);
    return tasks.length;
  },
};
