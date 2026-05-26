import type { TaskPayload, TaskPriority } from '../events/event-types.ts';
import { taskQueue } from '../queue/task-queue.ts';
import { priorityManager } from '../queue/priority-manager.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { generateTaskId } from '../utils/orchestration-helpers.ts';

export type QueueCategory = 'critical' | 'standard' | 'background';

export interface TaskRouteResult {
  taskId: string;
  category: QueueCategory;
  priority: TaskPriority;
}

function resolveCategory(priority: TaskPriority): QueueCategory {
  if (priority === 'critical') return 'critical';
  if (priority === 'high' || priority === 'normal') return 'standard';
  return 'background';
}

export const taskRouter = {
  route(runId: string, type: string, input: Record<string, unknown> = {}): TaskRouteResult {
    const priority = priorityManager.resolve({ type });
    const category = resolveCategory(priority);
    const taskId = generateTaskId(type);

    const task: TaskPayload = {
      taskId,
      runId,
      type,
      priority,
      input,
      retryCount: 0,
      createdAt: new Date(),
    };

    taskQueue.enqueue(task);
    runLogger.log(runId, 'info', `[task-router] Routed task "${type}" → ${category} queue (${priority})`, { taskId });

    return { taskId, category, priority };
  },

  routeWithPriority(
    runId: string,
    type: string,
    priority: TaskPriority,
    input: Record<string, unknown> = {}
  ): TaskRouteResult {
    if (!priorityManager.validate(priority)) {
      runLogger.log(runId, 'warn', `[task-router] Invalid priority "${priority}" — defaulting to normal`);
      priority = 'normal';
    }

    const category = resolveCategory(priority);
    const taskId = generateTaskId(type);

    const task: TaskPayload = {
      taskId,
      runId,
      type,
      priority,
      input,
      retryCount: 0,
      createdAt: new Date(),
    };

    taskQueue.enqueue(task);
    runLogger.log(runId, 'info', `[task-router] Force-routed task "${type}" → ${category} (${priority})`, { taskId });

    return { taskId, category, priority };
  },

  routeAll(runId: string, tasks: Array<{ type: string; input?: Record<string, unknown> }>): TaskRouteResult[] {
    return tasks.map((t) => this.route(runId, t.type, t.input ?? {}));
  },

  getQueueSize(): number {
    return taskQueue.size();
  },

  validateTaskType(type: unknown): type is string {
    return typeof type === 'string' && type.trim().length > 0;
  },
};
