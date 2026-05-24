/**
 * server/engine/swarm/swarm-dispatcher.ts
 *
 * Parallel agent dispatch via the existing worker pool + quantum DAG engine.
 * Executes wave tasks concurrently, integrates priority routing and barriers.
 * Single responsibility: task dispatch and wave execution only.
 */

import { workerPool }       from "../../distributed/workers/worker-pool.ts";
import type { SwarmTaskNode, SwarmTaskResult, SpawnedAgent, SwarmSession } from "./swarm-types.ts";
import { routeTask, releaseSlot } from "./swarm-priority-router.ts";
import { openWaveBarrier, arriveAtBarrier } from "./swarm-barrier.ts";
import { registerResult }   from "./swarm-result-aggregator.ts";
import { updateTaskStatus, updateAgentStatus } from "./swarm-state-store.ts";
import {
  emitAgentStarted,
  emitAgentCompleted,
  emitAgentFailed,
  emitAgentBlocked,
} from "./swarm-telemetry.ts";

// ── Wave execution ────────────────────────────────────────────────────────────

export interface WaveDispatchResult {
  waveIndex:  number;
  succeeded:  SwarmTaskResult[];
  failed:     SwarmTaskResult[];
  durationMs: number;
}

/**
 * Dispatch all tasks in a wave concurrently through the worker pool.
 * Opens a barrier, submits each task, waits for all to arrive.
 */
export async function dispatchWave(
  session:    SwarmSession,
  runId:      string,
  projectId:  number,
  tasks:      SwarmTaskNode[],
  agents:     SpawnedAgent[],
  waveIndex:  number,
): Promise<WaveDispatchResult> {
  const t0 = Date.now();
  const { swarmId } = session;

  // Open barrier for this wave
  const barrierPromise = openWaveBarrier(
    swarmId, runId, projectId, waveIndex, tasks.length, 200_000,
  );

  const submissions = tasks.map(async (task) => {
    const agent = agents.find(a => a.taskId === task.taskId);
    if (!agent) {
      arriveAtBarrier(swarmId, runId, projectId, waveIndex, task.taskId, "failed");
      return null;
    }

    // Priority admission control
    const routing = routeTask(task);
    if (!routing.allowed) {
      emitAgentBlocked(runId, projectId, swarmId, agent.agentId, routing.reason ?? "backpressure");
      // Wait and retry admission with backoff
      await new Promise(r => setTimeout(r, 2000));
    }

    emitAgentStarted(runId, projectId, swarmId, agent.agentId, agent.role, waveIndex);
    updateTaskStatus(swarmId, task.taskId, "started");
    updateAgentStatus(swarmId, agent.agentId, "running");

    try {
      const workerResult = await workerPool.submit<SwarmTaskResult>({
        taskId:    task.taskId,
        runId,
        projectId,
        type:      "llm",
        fn:        () => executeAgentViaCoordination(task, agent, runId, routing.timeoutMs ?? 60_000),
        timeoutMs: routing.timeoutMs,
      });

      const result: SwarmTaskResult = workerResult.success && workerResult.data
        ? workerResult.data
        : _failResult(task, agent, workerResult.error ?? "Worker failed");

      registerResult(swarmId, result);
      updateTaskStatus(swarmId, task.taskId, result.success ? "completed" : "failed", result);
      updateAgentStatus(swarmId, agent.agentId, result.success ? "completed" : "failed");

      if (result.success) {
        emitAgentCompleted(runId, projectId, swarmId, agent.agentId, agent.role, result.durationMs, true);
      } else {
        emitAgentFailed(runId, projectId, swarmId, agent.agentId, agent.role, result.error ?? "unknown");
      }

      arriveAtBarrier(swarmId, runId, projectId, waveIndex, agent.agentId, result.success ? "completed" : "failed");
      releaseSlot(task);
      return result;

    } catch (err) {
      const result = _failResult(task, agent, String(err));
      registerResult(swarmId, result);
      updateTaskStatus(swarmId, task.taskId, "failed", undefined, String(err));
      updateAgentStatus(swarmId, agent.agentId, "failed");
      emitAgentFailed(runId, projectId, swarmId, agent.agentId, agent.role, String(err));
      arriveAtBarrier(swarmId, runId, projectId, waveIndex, agent.agentId, "failed");
      releaseSlot(task);
      return result;
    }
  });

  // Wait for barrier (all agents arrived) — best-effort
  await barrierPromise.catch(() => { /* timeout handled by lifecycle manager */ });

  const settled = await Promise.allSettled(submissions);
  const succeeded: SwarmTaskResult[] = [];
  const failed:    SwarmTaskResult[] = [];

  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) {
      if (r.value.success) succeeded.push(r.value);
      else failed.push(r.value);
    }
  }

  return { waveIndex, succeeded, failed, durationMs: Date.now() - t0 };
}

// ── Real agent executor via specialist coordination dispatcher ─────────────────

async function executeAgentViaCoordination(
  task:       SwarmTaskNode,
  agent:      SpawnedAgent,
  runId:      string,
  timeoutMs:  number,
): Promise<SwarmTaskResult> {
  // Route swarm tasks through the parallel specialist coordination layer.
  // Each swarm agent maps to a specialist domain based on its role.
  const { specialistDispatcher } = await import(
    "../../coordination/specialist-dispatcher/index.ts"
  );
  const { mapSwarmRoleToDomain } = await import(
    "./swarm-domain-mapper.ts"
  );

  const t0     = Date.now();
  const domain = mapSwarmRoleToDomain(agent.role);
  const ac     = new AbortController();

  const specialistTask = {
    taskId:     task.taskId,
    runId,
    projectId:  agent.projectId,
    domain,
    goal:       task.description,
    priority:   task.priority === "critical" ? 0 : 1,
    dependsOn:  task.dependsOn,
    scope:      { exclusiveFiles: [], readonlyFiles: [] },
    context:    { agentRole: agent.role, swarmAgentId: agent.agentId },
    timeoutMs,
  } as import("../../coordination/contracts/specialist.contracts.ts").SpecialistTask;

  const result = await specialistDispatcher.dispatch(specialistTask, ac.signal);

  return {
    taskId:       task.taskId,
    agentId:      agent.agentId,
    role:         agent.role,
    success:      result.success,
    confidence:   result.success ? 0.85 : 0,
    output:       result.artifacts,
    filesWritten: result.patches.map(p => p.filePath),
    durationMs:   Date.now() - t0,
    retries:      task.retries,
    error:        result.error,
  };
}

function _failResult(task: SwarmTaskNode, agent: SpawnedAgent, error: string): SwarmTaskResult {
  return {
    taskId:       task.taskId,
    agentId:      agent.agentId,
    role:         agent.role,
    success:      false,
    confidence:   0,
    output:       null,
    filesWritten: [],
    durationMs:   0,
    retries:      task.retries,
    error,
  };
}
