/**
 * tool-loop.executor.ts
 * Tool-loop and memory agents removed — stubs inlined.
 */

import { ensureProjectDir }             from "../../infrastructure/sandbox/sandbox.util.ts";
import { emitAgentEvent, withRunLifecycle } from "./run-lifecycle.ts";
import { storeExecutionStats }          from "../../orchestration/execution/execution-result-registry.ts";
import type { RunHandle, RunInput }     from "./types.ts";

const DEFAULT_MAX_STEPS         = 25;
const DEFAULT_MAX_CONTINUATIONS = 3;

export async function executeToolLoopRun(handle: RunHandle, input: RunInput): Promise<void> {
  const { runId, projectId } = handle;

  emitAgentEvent({ runId, projectId, phase: "tool-loop", eventType: "phase.started", payload: { goal: input.goal, mode: "agent" }, ts: Date.now() });

  return withRunLifecycle(handle, "tool-loop", async () => {
    await ensureProjectDir(projectId);

    const maxSteps         = typeof input.context?.maxSteps === "number" ? (input.context.maxSteps as number) : DEFAULT_MAX_STEPS;
    const maxContinuations = typeof input.context?.maxContinuations === "number" ? (input.context.maxContinuations as number) : DEFAULT_MAX_CONTINUATIONS;

    console.warn(`[tool-loop] Tool-loop agent removed — run ${runId} cannot execute LLM steps. Set OPENROUTER_API_KEY and restore the tool-loop agent.`);

    const result = { success: false, finalOutput: "Tool-loop agent removed.", summary: "No execution.", steps: 0, stopReason: "agent_removed", error: "Tool-loop agent was removed from this deployment.", messages: [] as unknown[] };

    storeExecutionStats({
      runId, projectId,
      goal:                input.goal,
      success:             result.success,
      totalSteps:          result.steps,
      stopReason:          result.stopReason,
      summary:             result.summary,
      verificationRetries: 0,
      totalToolCalls:      0,
      unknownToolCalls:    0,
      failedToolCalls:     0,
      messages:            result.messages,
      error:               result.error,
    });

    emitAgentEvent({ runId, projectId, phase: "tool-loop", eventType: "phase.failed", payload: { steps: 0, stopReason: "agent_removed", error: result.error }, ts: Date.now() });

    return { success: false, result: { steps: 0, stopReason: "agent_removed", summary: result.summary, error: result.error } };
  });
}
