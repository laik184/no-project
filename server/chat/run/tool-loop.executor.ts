/**
 * tool-loop.executor.ts
 *
 * Run lifecycle executor for the tool-loop agent (default execution mode).
 *
 * Uses runAgentLoopWithContinuation so that when the agent hits max_steps,
 * it automatically compresses context and continues rather than failing
 * permanently.
 *
 * After the loop: writes ExecutionStats to the registry so the orchestration
 * engine can run real post-execution engines (reflection, scoring, learning).
 */

import { runAgentLoopWithContinuation } from "../../agents/core/tool-loop/index.ts";
import { ensureProjectDir }             from "../../infrastructure/sandbox/sandbox.util.ts";
import { emitAgentEvent, withRunLifecycle } from "./run-lifecycle.ts";
import { MemoryManager }                from "../../agents/memory/index.ts";
import { storeExecutionStats }          from "../../orchestration/execution/execution-result-registry.ts";
import type { RunHandle, RunInput }     from "./types.ts";

const DEFAULT_MAX_STEPS        = 25;
const DEFAULT_MAX_CONTINUATIONS = 3;

export async function executeToolLoopRun(handle: RunHandle, input: RunInput): Promise<void> {
  const { runId, projectId } = handle;

  emitAgentEvent({
    runId,
    projectId,
    phase:     "tool-loop",
    eventType: "phase.started",
    payload:   { goal: input.goal, mode: "agent" },
    ts:        Date.now(),
  });

  return withRunLifecycle(handle, "tool-loop", async () => {
    await ensureProjectDir(projectId);

    const maxSteps = typeof input.context?.maxSteps === "number"
      ? (input.context.maxSteps as number)
      : DEFAULT_MAX_STEPS;

    const maxContinuations = typeof input.context?.maxContinuations === "number"
      ? (input.context.maxContinuations as number)
      : DEFAULT_MAX_CONTINUATIONS;

    // ── Load cross-run project memory ─────────────────────────────────────────
    const memory        = MemoryManager.for(projectId);
    const memoryContext = await memory.loadContext();

    if (memoryContext) {
      emitAgentEvent({
        runId, projectId,
        phase:     "tool-loop",
        eventType: "agent.thinking" as any,
        payload:   { text: `[memory] Project context loaded — architecture, decisions, pending tasks, and run history injected.` },
        ts: Date.now(),
      });
    }

    // ── Execute agent loop ────────────────────────────────────────────────────
    const result = await runAgentLoopWithContinuation(
      { projectId, runId, goal: input.goal, systemPrompt: input.systemPrompt,
        maxSteps, memoryContext: memoryContext ?? undefined },
      { maxContinuations },
    );

    // ── Compute tool call stats from message history ──────────────────────────
    const { totalToolCalls, unknownToolCalls, failedToolCalls } =
      extractToolStats(result.messages ?? []);

    // ── Publish execution stats for post-execution engines ────────────────────
    // Fire-and-forget: never block or crash the run.
    storeExecutionStats({
      runId, projectId,
      goal:                input.goal,
      success:             result.success,
      totalSteps:          result.steps,
      stopReason:          result.stopReason,
      summary:             result.summary,
      verificationRetries: 0,   // retry controller tracks this separately
      totalToolCalls,
      unknownToolCalls,
      failedToolCalls,
      messages:            result.messages ?? [],
      error:               result.error,
    });

    // ── Persist memory — all fire-and-forget ──────────────────────────────────
    void memory.saveRunSummary(runId, input.goal, result);
    void memory.persistConversation(runId, input.goal, result.messages);
    void memory.trackTaskOutcome(runId, input.goal, result);

    emitAgentEvent({
      runId, projectId,
      phase:     "tool-loop",
      eventType: result.success ? "phase.completed" : "phase.failed",
      payload:   {
        steps: result.steps, stopReason: result.stopReason,
        summary: result.summary, error: result.error,
        memoryLoaded: !!memoryContext, memoryWritten: true, conversationSaved: true,
      },
      ts: Date.now(),
    });

    return {
      success: result.success,
      result:  { steps: result.steps, stopReason: result.stopReason,
                 summary: result.summary, error: result.error },
    };
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractToolStats(messages: unknown[]): {
  totalToolCalls:   number;
  unknownToolCalls: number;
  failedToolCalls:  number;
} {
  let totalToolCalls = 0, unknownToolCalls = 0, failedToolCalls = 0;

  for (const msg of messages as any[]) {
    if (msg?.role === "tool") {
      totalToolCalls++;
      try {
        const parsed = JSON.parse(msg.content ?? "{}");
        if (parsed?.ok === false) {
          if (/unknown tool/i.test(parsed?.error ?? "")) unknownToolCalls++;
          else failedToolCalls++;
        }
      } catch { /* non-JSON tool result — count as success */ }
    }
  }

  return { totalToolCalls, unknownToolCalls, failedToolCalls };
}
