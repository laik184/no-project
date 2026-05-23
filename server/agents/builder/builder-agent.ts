/**
 * server/agents/builder/builder-agent.ts
 *
 * BuilderAgent — top-level code generation coordinator.
 * Translates a BuildPlan into parallel DAG execution waves,
 * coordinating the generation sub-agents through the engine layer.
 *
 * Single responsibility: orchestrate code generation — no direct file I/O.
 */

import { bus }      from "../../infrastructure/events/bus.ts";
import { record }    from "../../telemetry/index.ts";
import { buildPlan } from "./builder-plan.ts";
import type {
  BuildRequest,
  BuildResult,
  BuildTask,
  BuildTaskResult,
} from "./types.ts";

const AGENT_NAME = "builder-agent";

// ── Telemetry ─────────────────────────────────────────────────────────────────

function emitEvent(
  eventType: string,
  runId: string,
  projectId: number,
  payload: Record<string, unknown>,
): void {
  bus.emit("agent.event", {
    runId,
    projectId,
    phase:     "build",
    agentName: AGENT_NAME,
    eventType,
    payload,
    ts:        Date.now(),
  });
}

// ── Task executor (defers to engine layer) ────────────────────────────────────
// Plan construction delegated to builder-plan.ts (Phase 1 split)

async function executeTask(
  task: BuildTask,
  runId: string,
  projectId: number,
): Promise<BuildTaskResult> {
  const t0 = Date.now();
  emitEvent("agent.parallel.started", runId, projectId, {
    taskId: task.id, phase: task.phase, goal: task.goal.slice(0, 80),
  });

  try {
    // Delegate to the engine node executor via dynamic import (avoids circular deps)
    const { createNodeExecutor } = await import("../../engine/execution/node-executor.ts");
    const executor = createNodeExecutor({ runId, projectId });

    const result = await executor({
      id:           task.id,
      label:        task.phase,
      type:         "agent",
      args:         { goal: task.goal, tools: task.tools, projectId },
      dependsOn:    task.dependsOn,
      maxRetries:   task.critical ? 2 : 1,
      retryCount:   0,
      retryStrategy: "exponential",
      isCheckpoint: task.critical,
      status:       "pending",
    });

    const success = result.status === "complete";
    emitEvent(success ? "agent.parallel.completed" : "agent.failed", runId, projectId, {
      taskId: task.id, success,
    });

    return {
      taskId:       task.id,
      phase:        task.phase,
      success,
      filesWritten: 0,
      toolsUsed:    task.tools,
      durationMs:   Date.now() - t0,
    };

  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    emitEvent("agent.failed", runId, projectId, { taskId: task.id, error });
    return {
      taskId:       task.id,
      phase:        task.phase,
      success:      false,
      filesWritten: 0,
      toolsUsed:    task.tools,
      durationMs:   Date.now() - t0,
      error,
    };
  }
}

// ── Parallel wave executor ────────────────────────────────────────────────────

async function executeWave(
  taskIds: string[],
  tasks: BuildTask[],
  runId: string,
  projectId: number,
): Promise<BuildTaskResult[]> {
  const waveTasks = tasks.filter(t => taskIds.includes(t.id));
  emitEvent("agent.parallel.started", runId, projectId, {
    wave: taskIds, count: waveTasks.length,
  });
  const results = await Promise.all(waveTasks.map(t => executeTask(t, runId, projectId)));
  emitEvent("agent.parallel.completed", runId, projectId, {
    wave: taskIds, succeeded: results.filter(r => r.success).length,
  });
  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function runBuilder(req: BuildRequest): Promise<BuildResult> {
  const { runId, projectId } = req;
  const t0 = Date.now();

  emitEvent("agent.started", runId, projectId, { goal: req.goal.slice(0, 80) });
  record("agent.started", runId, projectId, {
    agentName: AGENT_NAME, goal: req.goal.slice(0, 80),
  }, [AGENT_NAME]);

  const plan = buildPlan(req);
  emitEvent("agent.started", runId, projectId, {
    phases: plan.phases, parallelGroups: plan.parallelGroups.length,
  });

  const completedTasks: BuildTaskResult[] = [];
  const failedTasks:    BuildTaskResult[] = [];

  try {
    // Execute parallel waves in sequence
    for (const wave of plan.parallelGroups) {
      if (req.signal?.aborted) break;
      const results = await executeWave(wave, plan.tasks, runId, projectId);
      for (const r of results) {
        (r.success ? completedTasks : failedTasks).push(r);
      }
      // Fail-closed: if critical tasks failed, stop
      const criticalFailure = failedTasks.some(f =>
        plan.tasks.find(t => t.id === f.taskId)?.critical,
      );
      if (criticalFailure) {
        emitEvent("agent.blocked", runId, projectId, {
          reason: "critical_task_failed",
          failedTasks: failedTasks.map(f => f.taskId),
        });
        break;
      }
    }

    const success = failedTasks.length === 0;
    emitEvent(success ? "agent.completed" : "agent.failed", runId, projectId, {
      completed: completedTasks.length, failed: failedTasks.length,
    });

    record(success ? "agent.completed" : "verifier.failed", runId, projectId, {
      agentName: AGENT_NAME, completed: completedTasks.length, failed: failedTasks.length,
    }, [AGENT_NAME]);

    return {
      runId,
      projectId,
      success,
      completedTasks,
      failedTasks,
      filesCreated:    completedTasks.reduce((a, t) => a + t.filesWritten, 0),
      filesModified:   0,
      totalDurationMs: Date.now() - t0,
      ts:              Date.now(),
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emitEvent("agent.failed", runId, projectId, { error: msg });
    return {
      runId, projectId, success: false,
      completedTasks, failedTasks,
      filesCreated: 0, filesModified: 0,
      totalDurationMs: Date.now() - t0,
      ts: Date.now(),
    };
  }
}
