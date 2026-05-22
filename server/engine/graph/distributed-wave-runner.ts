/**
 * Responsibility: Distributed wave runner — replaces the single-process parallel-runner
 *                 with a worker-pool-backed execution layer for DAG waves.
 *                 Each node in the wave gets its own worker slot with full lifecycle tracking.
 * Dependencies: worker-pool, distributed-sync-barrier, distributed-trace
 * Failure: node failures increment failed count; critical failures abort the wave early.
 * Telemetry: emits agent.parallel.started/completed per wave; worker.* per node.
 */

import { workerPool }             from "../../distributed/workers/worker-pool.ts";
import { distributedSyncBarrier } from "../../infrastructure/events/distributed-sync-barrier.ts";
import { distributedTrace }       from "../../distributed/telemetry/distributed-trace.ts";
import { bus }                    from "../../infrastructure/events/bus.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WaveNode {
  id:          string;
  workerType:  "io-bound" | "cpu-bound" | "llm";
  critical?:   boolean;
  timeoutMs?:  number;
  fn:          () => Promise<unknown>;
}

export interface WaveRunResult {
  succeeded:  string[];
  failed:     string[];
  aborted:    boolean;
  durationMs: number;
}

// ── Runner ────────────────────────────────────────────────────────────────────

class DistributedWaveRunner {
  /**
   * Run a wave of nodes through the worker pool.
   * Critical node failure → wave is aborted (remaining nodes skipped).
   */
  async runWave(
    runId:     string,
    projectId: number,
    waveIdx:   number,
    nodes:     WaveNode[],
  ): Promise<WaveRunResult> {
    const t0          = Date.now();
    const barrierName = `wave-${waveIdx}`;
    const spanId      = distributedTrace.startSpan(runId, `wave.${waveIdx}`, {
      projectId: String(projectId), nodeCount: String(nodes.length),
    });

    bus.emit("agent.event", {
      runId, projectId,
      phase:     "distributed.dag",
      agentName: "distributed-wave-runner",
      eventType: "agent.parallel.started",
      payload:   { waveIdx, nodeCount: nodes.length },
      ts:        t0,
    });

    const barrier = distributedSyncBarrier.create(runId, barrierName, nodes.length, 120_000);

    const succeeded: string[] = [];
    const failed:    string[] = [];
    let aborted = false;

    const nodePromises = nodes.map(async (node) => {
      if (aborted) {
        distributedSyncBarrier.arrive(runId, barrierName, node.id);
        failed.push(node.id);
        return;
      }

      const result = await workerPool.submit({
        taskId:    node.id,
        runId,
        projectId,
        type:      node.workerType,
        fn:        node.fn,
        timeoutMs: node.timeoutMs,
      });

      distributedSyncBarrier.arrive(runId, barrierName, node.id);

      if (result.success) {
        succeeded.push(node.id);
      } else {
        failed.push(node.id);
        if (node.critical) {
          aborted = true;
          console.error(`[distributed-wave-runner] Critical node "${node.id}" failed — aborting wave ${waveIdx}.`);
        }
      }
    });

    await Promise.allSettled(nodePromises);
    await barrier.catch(err => console.warn("[distributed-wave-runner] Barrier:", err.message));

    const durationMs = Date.now() - t0;
    distributedTrace.endSpan(spanId, failed.length > 0 ? "error" : "ok");

    bus.emit("agent.event", {
      runId, projectId,
      phase:     "distributed.dag",
      agentName: "distributed-wave-runner",
      eventType: "agent.parallel.completed",
      payload:   { waveIdx, succeeded: succeeded.length, failed: failed.length, aborted, durationMs },
      ts:        Date.now(),
    });

    return { succeeded, failed, aborted, durationMs };
  }
}

export const distributedWaveRunner = new DistributedWaveRunner();
