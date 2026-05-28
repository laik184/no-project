/**
 * server/agents/executor/execution/parallel-executor.ts
 *
 * Executes planner-defined execution waves in true parallel.
 * The planner already supports phases with canParallel=true and
 * dependency graphs — this module honours them.
 *
 * Flow:
 *   wave tasks
 *     ↓ Promise.allSettled()
 *     ↓ aggregate results
 *     ↓ partial failure handling
 *     ↓ optional rollback coordination
 *     ↓ telemetry aggregation
 *
 * ALL tool execution still goes through dispatcher-client.ts (via
 * task-executor.ts). This module only controls concurrency.
 */

import type {
  ExecutionTask,
  ExecutorExecutionContext,
  ExecutorRetryConfig,
  TaskOutput,
} from '../types/executor.types.ts';
import { executeTask }           from './task-executor.ts';
import { DEFAULT_RETRY_CONFIG }  from './retry-manager.ts';
import { executionTimeline }     from '../telemetry/execution-timeline.ts';
import { executorLogger }        from '../telemetry/executor-logger.ts';
import { rollbackManager }       from '../recovery/rollback-manager.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WaveResult {
  waveIndex:      number;
  tasks:          ExecutionTask[];
  outputs:        TaskOutput[];
  ok:             boolean;
  failedTaskIds:  string[];
  durationMs:     number;
  partialFailure: boolean;
}

export interface ParallelExecutorOptions {
  retry?:              ExecutorRetryConfig;
  stopWaveOnFailure?:  boolean;   // abort whole wave if any task fails
  rollbackOnFailure?:  boolean;   // trigger rollback if critical wave fails
  maxConcurrency?:     number;    // cap parallel slots (default unlimited)
}

// ── Concurrency limiter ───────────────────────────────────────────────────────

async function _limited<T>(
  fns:  Array<() => Promise<T>>,
  max?: number,
): Promise<Array<PromiseSettledResult<T>>> {
  if (!max || max <= 0 || max >= fns.length) {
    return Promise.allSettled(fns.map((fn) => fn()));
  }
  // Chunked concurrency
  const results: Array<PromiseSettledResult<T>> = [];
  for (let i = 0; i < fns.length; i += max) {
    const chunk = fns.slice(i, i + max);
    const settled = await Promise.allSettled(chunk.map((fn) => fn()));
    results.push(...settled);
  }
  return results;
}

// ── Wave executor ─────────────────────────────────────────────────────────────

/**
 * Execute a single wave of tasks in parallel.
 * Returns WaveResult with per-task outputs.
 */
export async function executeWave(
  waveIndex: number,
  tasks:     ExecutionTask[],
  context:   ExecutorExecutionContext,
  options:   ParallelExecutorOptions = {},
): Promise<WaveResult> {
  const {
    retry                = DEFAULT_RETRY_CONFIG,
    stopWaveOnFailure    = false,
    rollbackOnFailure    = false,
    maxConcurrency,
  } = options;

  const startedAt = Date.now();

  executionTimeline.record(
    context.runId, 'parallel.wave.started',
    `Wave ${waveIndex}: ${tasks.length} task(s) in parallel`,
    { waveIndex, taskCount: tasks.length },
  );

  executorLogger.info(
    context.runId,
    `[parallel] Wave ${waveIndex} starting — ${tasks.length} task(s)`,
    { waveIndex },
  );

  // Create a rollback checkpoint before the wave
  if (rollbackOnFailure) {
    rollbackManager.createCheckpoint(context.runId, `wave_${waveIndex}`, 'files');
  }

  // Build the parallel execution functions
  const fns = tasks.map((task) => () => executeTask(task, context, retry));

  // Execute with optional concurrency cap
  const settled = await _limited(fns, maxConcurrency);

  // Collect outputs
  const outputs:       TaskOutput[]  = [];
  const failedTaskIds: string[]      = [];

  for (let i = 0; i < settled.length; i++) {
    const s    = settled[i];
    const task = tasks[i];

    if (s.status === 'fulfilled') {
      outputs.push(s.value);
      if (!s.value.ok) failedTaskIds.push(task.taskId);
    } else {
      // Promise itself rejected (unexpected — executeTask never throws)
      const errOutput: TaskOutput = {
        taskId: task.taskId, kind: task.kind,
        ok: false, error: String(s.reason), attempts: 1,
      };
      outputs.push(errOutput);
      failedTaskIds.push(task.taskId);
    }
  }

  const ok            = failedTaskIds.length === 0;
  const partialFailure = !ok && failedTaskIds.length < tasks.length;
  const durationMs    = Date.now() - startedAt;

  executionTimeline.record(
    context.runId, 'parallel.wave.completed',
    `Wave ${waveIndex}: ${ok ? 'ok' : `${failedTaskIds.length} failed`}`,
    { waveIndex, failed: failedTaskIds.length },
    durationMs,
  );

  executorLogger.info(
    context.runId,
    `[parallel] Wave ${waveIndex} done — ok=${ok} failed=${failedTaskIds.length} dur=${durationMs}ms`,
    { waveIndex },
  );

  // Rollback if requested and wave failed
  if (!ok && rollbackOnFailure && failedTaskIds.length > 0) {
    rollbackManager.rollback(
      context.runId, tasks[0].kind,
      `Wave ${waveIndex} failed (${failedTaskIds.length}/${tasks.length} tasks)`,
    );
  }

  return { waveIndex, tasks, outputs, ok, failedTaskIds, durationMs, partialFailure };
}

/**
 * Execute all waves sequentially, each wave internally parallel.
 * Stops on wave failure if stopWaveOnFailure=true.
 */
export async function executeWaves(
  waves:   ExecutionTask[][],
  context: ExecutorExecutionContext,
  options: ParallelExecutorOptions = {},
): Promise<WaveResult[]> {
  const results: WaveResult[] = [];

  for (let i = 0; i < waves.length; i++) {
    const wave = waves[i];
    if (!wave || wave.length === 0) continue;

    const result = await executeWave(i, wave, context, options);
    results.push(result);

    if (!result.ok && options.stopWaveOnFailure) {
      executorLogger.warn(
        context.runId,
        `[parallel] Wave ${i} failed — stopping further waves`,
        { failedTaskIds: result.failedTaskIds },
      );
      break;
    }
  }

  return results;
}
