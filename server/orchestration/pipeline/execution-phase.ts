import type { OrchestrationContext, PhaseResult } from '../events/event-types.ts';
import { runLogger } from '../telemetry/run-logger.ts';
import { emitPhaseStarted, emitMetric, emitTaskStarted, emitTaskCompleted, emitTaskFailed } from '../events/orchestration-events.ts';
import { timed, withTimeout, sleep } from '../utils/execution-utils.ts';
import { generateTaskId } from '../utils/orchestration-helpers.ts';
import type { ExecutionPlan, PlanTask } from './planning-phase.ts';

export interface ExecutionProgress {
  total: number;
  completed: number;
  failed: number;
  percentComplete: number;
}

export interface ExecutionPhaseResult {
  tasksCompleted: number;
  tasksFailed: number;
  progress: ExecutionProgress;
  errors: Array<{ taskId: string; error: string }>;
}

async function executeTask(
  runId: string,
  task: PlanTask,
  onProgress: (p: ExecutionProgress, total: number) => void,
  total: number
): Promise<boolean> {
  const payload = {
    taskId: generateTaskId(task.type),
    runId,
    type: task.type,
    priority: task.priority as 'high' | 'normal' | 'low' | 'critical',
    input: { description: task.description },
    retryCount: 0,
    createdAt: new Date(),
  };

  emitTaskStarted(payload);
  runLogger.log(runId, 'info', `[execution-phase] Running task "${task.type}": ${task.description}`);

  try {
    await withTimeout(() => sleep(200 + Math.random() * 300), { timeoutMs: 30_000 });
    emitTaskCompleted(payload, { taskId: task.id, status: 'completed' });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emitTaskFailed(payload, msg);
    runLogger.log(runId, 'error', `[execution-phase] Task "${task.type}" failed: ${msg}`);
    return false;
  }
}

function sortByDependencies(tasks: PlanTask[]): PlanTask[] {
  const resolved = new Set<string>();
  const sorted: PlanTask[] = [];
  const remaining = [...tasks];

  while (remaining.length > 0) {
    const before = remaining.length;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const task = remaining[i];
      if (task.dependsOn.every((dep) => resolved.has(dep))) {
        sorted.push(task);
        resolved.add(task.id);
        remaining.splice(i, 1);
      }
    }
    if (remaining.length === before) {
      sorted.push(...remaining);
      break;
    }
  }
  return sorted;
}

export async function runExecutionPhase(ctx: OrchestrationContext, plan: ExecutionPlan): Promise<PhaseResult> {
  emitPhaseStarted(ctx.runId, 'execution');
  runLogger.log(ctx.runId, 'info', `[execution-phase] Executing ${plan.tasks.length} tasks`);

  const { result, durationMs } = await timed(async (): Promise<ExecutionPhaseResult> => {
    const ordered = sortByDependencies(plan.tasks);
    let completed = 0;
    let failed = 0;
    const errors: Array<{ taskId: string; error: string }> = [];

    for (const task of ordered) {
      const ok = await executeTask(
        ctx.runId,
        task,
        (p, total) => runLogger.log(ctx.runId, 'info', `[execution-phase] Progress ${p.percentComplete}%`),
        ordered.length
      );
      if (ok) completed++;
      else {
        failed++;
        errors.push({ taskId: task.id, error: `Task "${task.type}" failed` });
      }

      emitMetric(ctx.runId, 'execution.tasks_completed', completed, 'count');
    }

    const progress: ExecutionProgress = {
      total: ordered.length,
      completed,
      failed,
      percentComplete: Math.round((completed / ordered.length) * 100),
    };

    return { tasksCompleted: completed, tasksFailed: failed, progress, errors };
  });

  const success = result.tasksFailed === 0;
  runLogger.log(ctx.runId, success ? 'info' : 'warn', `[execution-phase] Done — ${result.tasksCompleted} ok, ${result.tasksFailed} failed`);
  emitMetric(ctx.runId, 'execution.duration', durationMs);

  return {
    phase: 'execution',
    success,
    durationMs,
    output: result as unknown as Record<string, unknown>,
    error: success ? undefined : `${result.tasksFailed} tasks failed`,
  };
}
