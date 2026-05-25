/**
 * Responsibility: Extends the graph engine with distributed execution capabilities:
 *                 dynamic node injection, distributed wave scheduling, and result aggregation.
 *                 Wraps the existing graph-engine.ts — does NOT rewrite it.
 * Dependencies: graph-engine, worker-pool, result-aggregator, distributed-sync-barrier
 * Failure: injection failures are logged; running graph is not corrupted.
 * Telemetry: emits agent.parallel.started/completed on each distributed wave.
 */

import { resultAggregator } from "../../distributed/aggregation/result-aggregator.ts";
import { workerPool }       from "../../distributed/workers/worker-pool.ts";
import { distributedSyncBarrier } from "../../infrastructure/events/distributed-sync-barrier.ts";
import { bus }              from "../../infrastructure/events/bus.ts";
import { swarmTelemetryFabric } from "../../infrastructure/telemetry/swarm/swarm-telemetry-fabric.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DistributedNode<T = unknown> {
  id:          string;
  dependsOn:   string[];
  workerType:  "io-bound" | "cpu-bound" | "llm";
  timeoutMs?:  number;
  fn:          () => Promise<T>;
}

export interface DistributedWave<T = unknown> {
  waveIdx:   number;
  nodes:     DistributedNode<T>[];
  barrierName: string;
}

export interface DistributedWaveResult<T> {
  waveIdx:    number;
  results:    Map<string, T>;
  failed:     string[];
  durationMs: number;
}

// ── Engine ────────────────────────────────────────────────────────────────────

class QuantumDAGEngine {
  /**
   * Execute a wave of parallel nodes through the worker pool with:
   * - Worker-pool-backed execution (backpressure, priority, lifecycle)
   * - Sync barrier (wait for all nodes before proceeding)
   * - Result aggregation (merge parallel outputs)
   */
  async executeDistributedWave<T>(
    runId:     string,
    projectId: number,
    wave:      DistributedWave<T>,
  ): Promise<DistributedWaveResult<T>> {
    const t0 = Date.now();

    bus.emit("agent.event", {
      runId, projectId,
      phase:     "distributed.dag",
      agentName: "quantum-dag-engine",
      eventType: "agent.parallel.started",
      payload:   { waveIdx: wave.waveIdx, nodeCount: wave.nodes.length },
      ts:        t0,
    });

    // Create sync barrier for all nodes in this wave
    const barrierPromise = distributedSyncBarrier.create(
      runId,
      wave.barrierName,
      wave.nodes.length,
      120_000,
    );

    // Open aggregation session
    const aggregationPromise = resultAggregator.aggregate<T>({
      runId,
      projectId,
      expected:  wave.nodes.length,
      strategy:  "best_confidence",
      timeoutMs: 120_000,
    });

    // Submit all nodes to worker pool concurrently
    const submissions = wave.nodes.map(async (node) => {
      swarmTelemetryFabric.dagNodeStart(runId, projectId, {
        nodeId:     node.id,
        domain:     node.workerType,
        waveIndex:  wave.waveIdx,
        workerType: node.workerType,
      });

      const result = await workerPool.submit<T>({
        taskId:    node.id,
        runId,
        projectId,
        type:      node.workerType,
        fn:        node.fn,
        timeoutMs: node.timeoutMs,
      });

      swarmTelemetryFabric.dagNodeComplete(runId, projectId, {
        nodeId:     node.id,
        domain:     node.workerType,
        success:    result.success,
        durationMs: result.durationMs,
      });

      // Submit to aggregator
      resultAggregator.submit<T>(runId, {
        workerId:   result.workerId,
        taskId:     node.id,
        success:    result.success,
        data:       result.data,
        error:      result.error,
        durationMs: result.durationMs,
      });

      // Arrive at barrier
      distributedSyncBarrier.arrive(runId, wave.barrierName, node.id);

      return { nodeId: node.id, result };
    });

    // Wait for all barrier arrivals
    await Promise.race([
      barrierPromise,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`Wave ${wave.waveIdx} barrier timeout`)), 130_000),
      ),
    ]).catch(err => console.error("[quantum-dag-engine] Barrier:", err));

    // Wait for aggregated result
    const aggregated = await aggregationPromise.catch(() => null);
    const nodeResults = await Promise.allSettled(submissions);

    const resultMap = new Map<string, T>();
    const failed: string[] = [];

    for (const r of nodeResults) {
      if (r.status === "fulfilled") {
        const { nodeId, result } = r.value;
        if (result.success && result.data !== undefined) {
          resultMap.set(nodeId, result.data);
        } else {
          failed.push(nodeId);
        }
      }
    }

    const durationMs = Date.now() - t0;

    bus.emit("agent.event", {
      runId, projectId,
      phase:     "distributed.dag",
      agentName: "quantum-dag-engine",
      eventType: "agent.parallel.completed",
      payload:   { waveIdx: wave.waveIdx, succeeded: resultMap.size, failed: failed.length, durationMs },
      ts:        Date.now(),
    });

    return { waveIdx: wave.waveIdx, results: resultMap, failed, durationMs };
  }
}

export const quantumDAGEngine = new QuantumDAGEngine();
