/**
 * planned.executor.ts
 * Uses the kept Planner agent (agents/planner/) directly.
 */

import { buildTaskGraph }       from "../../agents/planner/planner-agent.ts";
import { ensureProjectDir }     from "../../infrastructure/sandbox/sandbox.util.ts";
import { emitAgentEvent, withRunLifecycle } from "./run-lifecycle.ts";
import type { RunHandle, RunInput } from "./types.ts";

export async function executePlannedRun(handle: RunHandle, input: RunInput): Promise<void> {
  const { runId, projectId } = handle;

  emitAgentEvent({ runId, projectId, phase: "planner", eventType: "phase.started", payload: { goal: input.goal, mode: "planned" }, ts: Date.now() });

  return withRunLifecycle(handle, "planner", async () => {
    await ensureProjectDir(projectId);

    const graph = buildTaskGraph(input.goal);

    emitAgentEvent({
      runId, projectId, phase: "planner",
      eventType: "phase.completed",
      payload: { phases: graph.tasks.length, totalSteps: graph.tasks.length, durationMs: 0 },
      ts: Date.now(),
    });

    return {
      success: true,
      result: { planned: true, phases: graph.tasks.length, totalSteps: graph.tasks.length, durationMs: 0, overallSuccess: true },
    };
  });
}
