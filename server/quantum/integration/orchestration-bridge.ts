/**
 * server/quantum/integration/orchestration-bridge.ts
 *
 * Wires the orchestration engine's execution dispatch to the
 * centralWorkerPool. Provides priority inference from orchestration mode,
 * timeout defaults per mode, and telemetry emission.
 *
 * Usage
 * ─────
 *   import { orchestrationBridge } from "./integration/orchestration-bridge.ts";
 *   const result = await orchestrationBridge.submitTask(task, mode, ctx);
 */

import { centralWorkerPool }   from "../scheduler/worker-pool.ts";
import { TaskPriority }        from "../scheduler/worker-types.ts";
import type { PoolTask, PoolResult } from "../scheduler/worker-types.ts";
import { bus }                 from "../../infrastructure/events/bus.ts";

// ── Mode → priority mapping ───────────────────────────────────────────────────

type OrchestrationMode = "tool-loop" | "planned" | "dag" | "quantum" | "recovery";

const MODE_PRIORITY: Record<OrchestrationMode, TaskPriority> = {
  recovery:  TaskPriority.CRITICAL,
  quantum:   TaskPriority.HIGH,
  dag:       TaskPriority.HIGH,
  planned:   TaskPriority.NORMAL,
  "tool-loop": TaskPriority.NORMAL,
};

const MODE_TIMEOUT: Record<OrchestrationMode, number> = {
  recovery:    60_000,
  quantum:    300_000,
  dag:        180_000,
  planned:    120_000,
  "tool-loop": 90_000,
};

// ── Bridge task descriptor ────────────────────────────────────────────────────

export interface OrchestrationTaskDescriptor<T = unknown> {
  id:          string;
  runId:       string;
  mode:        OrchestrationMode;
  taskType?:   string;
  timeoutMs?:  number;
  maxRetries?: number;
  fn:          () => Promise<T>;
  signal?:     AbortSignal;
  metadata?:   Record<string, unknown>;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class OrchestrationBridge {
  /**
   * Submit an orchestration-level task through the centralWorkerPool.
   * Priority and timeout are inferred from the orchestration mode.
   */
  async submitTask<T>(
    descriptor: OrchestrationTaskDescriptor<T>,
  ): Promise<PoolResult<T>> {
    const priority  = MODE_PRIORITY[descriptor.mode]   ?? TaskPriority.NORMAL;
    const timeoutMs = descriptor.timeoutMs             ?? MODE_TIMEOUT[descriptor.mode] ?? 120_000;

    const task: PoolTask<T> = {
      id:            descriptor.id,
      runId:         descriptor.runId,
      priority,
      timeoutMs,
      maxRetries:    descriptor.maxRetries    ?? 1,
      taskType:      descriptor.taskType      ?? `orchestration.${descriptor.mode}`,
      executionMode: "parallel",
      fn:            descriptor.fn,
      signal:        descriptor.signal,
      metadata:      { mode: descriptor.mode, ...descriptor.metadata },
    };

    bus.emit("agent.event", {
      runId:     descriptor.runId,
      eventType: "orchestration.bridge.submit" as any,
      phase:     "orchestration-bridge",
      ts:        Date.now(),
      payload:   { taskId: descriptor.id, mode: descriptor.mode, priority, timeoutMs },
    });

    return centralWorkerPool.submit<T>(task);
  }

  /**
   * Submit multiple orchestration tasks in parallel.
   * All tasks are submitted concurrently and results collected.
   */
  async submitAll<T>(
    descriptors: OrchestrationTaskDescriptor<T>[],
  ): Promise<PoolResult<T>[]> {
    const submissions = descriptors.map(d => this.submitTask<T>(d));
    return Promise.all(submissions);
  }

  stats() {
    return centralWorkerPool.stats();
  }
}

export const orchestrationBridge = new OrchestrationBridge();
