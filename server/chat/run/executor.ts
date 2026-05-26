/**
 * executor.ts — pipeline mode executor.
 * Pipeline agent removed — returns a stub failure for pipeline mode.
 */

import { ensureProjectDir }  from "../../infrastructure/sandbox/sandbox.util.ts";
import { emitAgentEvent, withRunLifecycle } from "./run-lifecycle.ts";
import type { RunHandle, RunInput } from "./types.ts";

export async function executePipelineRun(handle: RunHandle, input: RunInput): Promise<void> {
  const { runId, projectId } = handle;

  emitAgentEvent({ runId, projectId, phase: "routing", eventType: "phase.started", payload: { goal: input.goal, mode: "pipeline" }, ts: Date.now() });

  return withRunLifecycle(handle, "routing", async () => {
    await ensureProjectDir(projectId);

    emitAgentEvent({ runId, projectId, phase: "routing", eventType: "phase.failed", payload: { error: "Pipeline agent removed." }, ts: Date.now() });

    return { success: false, result: { finalPhase: "stub", totalDurationMs: 0, error: "Pipeline agent removed." } };
  });
}
