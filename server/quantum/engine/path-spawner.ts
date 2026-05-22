/**
 * path-spawner.ts
 *
 * Creates isolated execution paths and assigns them to the worker pool.
 * Each path receives its own strategy, sandbox sub-directory, and abort signal.
 * Does NOT execute — delegates execution to quantum-runner.ts.
 */

import { v4 as uuid }           from "uuid";
import type { QuantumRunInput, WorkerTask } from "../types/quantum.types.ts";
import type { ExecutionPath }   from "../types/path.types.ts";
import type { ExecutionStrategy } from "../types/quantum.types.ts";
import { spawnPaths, markPathRunning, markPathCompleted, markPathFailed } from "../superposition/superposition-manager.ts";
import { workerPool }           from "../scheduler/worker-pool.ts";
import { recordPathResult }     from "../aggregation/result-aggregator.ts";
import { runPath }              from "./quantum-runner.ts";

// ── Spawn and submit all paths ────────────────────────────────────────────────

export interface SpawnResult {
  paths:     ExecutionPath[];
  taskIds:   string[];
}

export async function spawnAndSubmit(
  input:      QuantumRunInput,
  strategies: ExecutionStrategy[],
): Promise<SpawnResult> {
  const paths   = spawnPaths(input, strategies);
  const taskIds: string[] = [];

  for (const path of paths) {
    const taskId = `qtask-${uuid().slice(0, 8)}`;

    const task: WorkerTask = {
      taskId,
      pathId:    path.pathId,
      priority:  10 - path.priority,   // lower number = higher urgency
      timeoutMs: input.timeoutMs,
      signal:    path.abortController.signal,
      fn: async () => {
        // Mark as running
        const runningPath = markPathRunning(path, input.runId);

        try {
          const result = await runPath({
            path: runningPath,
            input,
          });

          recordPathResult(input.quantumRunId, result);

          if (result.success) {
            markPathCompleted(runningPath, input.runId);
          } else {
            markPathFailed(runningPath, input.runId, result.error ?? "unknown");
          }

          return result;
        } catch (err) {
          const errMsg = (err as Error).message;
          markPathFailed(path, input.runId, errMsg);
          throw err;
        }
      },
    };

    workerPool.submit(task);
    taskIds.push(taskId);
  }

  return { paths, taskIds };
}

// ── Cancel remaining path tasks ───────────────────────────────────────────────

export function cancelPathTasks(paths: ExecutionPath[]): void {
  for (const path of paths) {
    workerPool.cancelPath(path.pathId);
  }
}
