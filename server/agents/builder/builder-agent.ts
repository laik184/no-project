/**
 * server/agents/builder/builder-agent.ts
 *
 * BuilderAgent — top-level code generation coordinator.
 * Translates a BuildPlan into parallel DAG execution waves,
 * coordinating the generation sub-agents through the engine layer.
 *
 * Single responsibility: orchestrate code generation — no direct file I/O.
 */

import { bus }    from "../../infrastructure/events/bus.ts";
import { record } from "../../telemetry/index.ts";
import type {
  BuildRequest,
  BuildResult,
  BuildPlan,
  BuildTask,
  BuildTaskResult,
  BuildPhase,
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

// ── Plan builder ──────────────────────────────────────────────────────────────

function buildPlan(req: BuildRequest): BuildPlan {
  const { runId, projectId, goal, framework, features = [] } = req;

  const tasks: BuildTask[] = [];
  const phases: BuildPhase[] = ["scaffold", "dependencies", "backend", "frontend", "config"];

  // Scaffold is always first
  tasks.push({
    id:        "scaffold",
    phase:     "scaffold",
    goal:      `Scaffold project structure for: ${goal}`,
    tools:     ["write_file", "list_dir"],
    dependsOn: [],
    critical:  true,
    timeoutMs: 60_000,
  });

  // Dependencies and backend/frontend can run after scaffold
  tasks.push({
    id:        "dependencies",
    phase:     "dependencies",
    goal:      `Install and configure dependencies for ${framework ?? "the project"}`,
    tools:     ["install_package", "write_file"],
    dependsOn: ["scaffold"],
    critical:  true,
    timeoutMs: 90_000,
  });

  tasks.push({
    id:        "backend",
    phase:     "backend",
    goal:      `Generate backend API routes and server logic for: ${goal}`,
    tools:     ["write_file", "read_file", "shell_exec"],
    dependsOn: ["scaffold"],
    critical:  true,
    timeoutMs: 120_000,
  });

  tasks.push({
    id:        "frontend",
    phase:     "frontend",
    goal:      `Generate frontend components and UI for: ${goal}`,
    tools:     ["write_file", "read_file"],
    dependsOn: ["scaffold"],
    critical:  true,
    timeoutMs: 120_000,
  });

  // Database task if feature requested
  if (features.includes("database") || goal.toLowerCase().includes("database")) {
    tasks.push({
      id:        "database",
      phase:     "database",
      goal:      "Generate database schema and migration files",
      tools:     ["write_file", "shell_exec"],
      dependsOn: ["scaffold"],
      critical:  false,
      timeoutMs: 60_000,
    });
    phases.splice(2, 0, "database");
  }

  tasks.push({
    id:        "config",
    phase:     "config",
    goal:      "Generate environment configuration and build settings",
    tools:     ["write_file"],
    dependsOn: ["backend", "frontend"],
    critical:  false,
    timeoutMs: 30_000,
  });

  // Parallel groups: backend + frontend + database can run simultaneously
  const parallelGroups = [
    ["scaffold"],
    ["dependencies", "backend", "frontend", ...(phases.includes("database") ? ["database"] : [])],
    ["config"],
  ];

  return {
    runId,
    projectId,
    goal,
    tasks,
    phases,
    estimatedMs: tasks.reduce((acc, t) => acc + t.timeoutMs, 0) / parallelGroups.length,
    parallelGroups,
  };
}

// ── Task executor (defers to engine layer) ────────────────────────────────────

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
