/**
 * server/quantum/integration/graph-engine-bridge.ts
 *
 * Adapts the QuantumDAGEngine's wave execution to route through the
 * centralized CentralWorkerPool instead of using raw workerPool.submit()
 * from server/distributed/workers/worker-pool.ts.
 *
 * Integration flow
 * ────────────────
 *   graph-engine
 *   → GraphEngineBridge.submitWave(wave, ctx)
 *   → CentralWorkerPool.submit() per node (priority-scheduled, backpressure-gated)
 *   → ExecutionBatch.collect() → WaveResult
 *
 * Usage
 * ─────
 *   import { graphEngineBridge } from "./integration/graph-engine-bridge.ts";
 *   const result = await graphEngineBridge.submitWave(runId, projectId, wave);
 */

import { v4 as uuidv4 }          from "uuid";
import { centralWorkerPool }     from "../scheduler/worker-pool.ts";
import { ExecutionBatch }        from "../execution/execution-batch.ts";
import { TaskPriority }          from "../scheduler/worker-types.ts";
import type { PoolTask }         from "../scheduler/worker-types.ts";
import type { BatchResult }      from "../execution/execution-batch.ts";
import { bus }                   from "../../infrastructure/events/bus.ts";

// ── Bridge types ──────────────────────────────────────────────────────────────

export interface BridgeNode<T = unknown> {
  id:          string;
  taskType:    string;
  priority?:   TaskPriority;
  timeoutMs?:  number;
  maxRetries?: number;
  fn:          () => Promise<T>;
  signal?:     AbortSignal;
}

export interface BridgeWave<T = unknown> {
  waveIdx:     number;
  nodes:       BridgeNode<T>[];
  barrierName: string;
}

export interface WaveResult<T = unknown> {
  waveIdx:    number;
  results:    Map<string, T>;
  failed:     string[];
  durationMs: number;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class GraphEngineBridge {
  /**
   * Submit a full wave of DAG nodes through the centralWorkerPool.
   * Returns a WaveResult with a per-node result Map and failed ID list.
   *
   * This replaces the Promise.allSettled() call in quantum-dag-engine.ts
   * with governed, priority-scheduled, backpressure-safe execution.
   */
  async submitWave<T>(
    runId:     string,
    projectId: number,
    wave:      BridgeWave<T>,
  ): Promise<WaveResult<T>> {
    const t0    = Date.now();
    const batch = new ExecutionBatch<T>(`wave-${runId}-${wave.waveIdx}`);

    bus.emit("agent.event", {
      runId, projectId,
      eventType: "graph.bridge.wave.started" as any,
      phase:     "graph-engine-bridge",
      ts:        t0,
      payload:   { waveIdx: wave.waveIdx, nodeCount: wave.nodes.length },
    });

    for (const node of wave.nodes) {
      const task: PoolTask<T> = {
        id:            node.id,
        runId,
        priority:      node.priority      ?? TaskPriority.NORMAL,
        timeoutMs:     node.timeoutMs     ?? 60_000,
        maxRetries:    node.maxRetries    ?? 1,
        taskType:      node.taskType,
        executionMode: "parallel",
        fn:            node.fn,
        signal:        node.signal,
        metadata:      { waveIdx: wave.waveIdx, barrier: wave.barrierName, projectId },
      };

      batch.add({
        taskId:  node.id,
        runId,
        promise: centralWorkerPool.submit<T>(task),
      });
    }

    const batchResult: BatchResult<T> = await batch.collect();

    const resultMap = new Map<string, T>();
    const failed:    string[] = [];

    for (const r of batchResult.succeeded) {
      if (r.data !== undefined) resultMap.set(r.taskId, r.data);
    }
    for (const r of batchResult.failed) {
      failed.push(r.taskId);
    }

    const durationMs = Date.now() - t0;

    bus.emit("agent.event", {
      runId, projectId,
      eventType: "graph.bridge.wave.completed" as any,
      phase:     "graph-engine-bridge",
      ts:        Date.now(),
      payload:   { waveIdx: wave.waveIdx, succeeded: resultMap.size, failed: failed.length, durationMs },
    });

    return { waveIdx: wave.waveIdx, results: resultMap, failed, durationMs };
  }

  /** Cancel all queued nodes in a wave. */
  cancelWave(runId: string, wave: BridgeWave): void {
    for (const node of wave.nodes) {
      centralWorkerPool.cancel(node.id, runId);
    }
  }

  stats() {
    return centralWorkerPool.stats();
  }
}

export const graphEngineBridge = new GraphEngineBridge();
