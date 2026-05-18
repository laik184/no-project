/**
 * tool-loop.executor.ts
 *
 * Run lifecycle executor for the tool-loop agent (default execution mode).
 *
 * Uses runAgentLoopWithContinuation so that when the agent hits max_steps,
 * it automatically compresses context and continues rather than failing
 * permanently.
 *
 * ── Memory integration ────────────────────────────────────────────────────────
 *
 * BEFORE the loop:
 *   MemoryManager.loadContext() reads .nura/ files and returns a compressed
 *   context string injected into the LLM as memoryContext.
 *   Returns null on the very first run for a project (no-op).
 *
 * AFTER the loop (all fire-and-forget — never block or crash the run):
 *   1. saveRunSummary()      → run-history.jsonl, context.md, architecture.md,
 *                              decisions.json, failures.json
 *   2. persistConversation() → chat_messages DB table (user goal + assistant
 *                              text turns, enables session replay in the UI)
 *   3. trackTaskOutcome()    → tasks.md
 *                              success  → appends ✅ Done entry
 *                              max_steps → appends ⏳ Pending entry so the
 *                              agent resumes the task on the next run
 */

import { runAgentLoopWithContinuation } from "../../agents/core/tool-loop/index.ts";
import { ensureProjectDir }             from "../../infrastructure/sandbox/sandbox.util.ts";
import { emitAgentEvent, withRunLifecycle } from "./run-lifecycle.ts";
import { MemoryManager }                from "../../memory/index.ts";
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
        runId,
        projectId,
        phase:     "tool-loop",
        eventType: "agent.thinking" as any,
        payload:   {
          text: `[memory] Project context loaded — architecture, decisions, pending tasks, and run history injected.`,
        },
        ts: Date.now(),
      });
    }

    // ── Execute agent loop ────────────────────────────────────────────────────
    const result = await runAgentLoopWithContinuation(
      {
        projectId,
        runId,
        goal:          input.goal,
        systemPrompt:  input.systemPrompt,
        maxSteps,
        memoryContext: memoryContext ?? undefined,
      },
      { maxContinuations },
    );

    // ── Persist memory — all fire-and-forget ──────────────────────────────────
    // None of these may throw or affect the run outcome.

    // 1. .nura/ file-system memory (run log, architecture, decisions, failures)
    void memory.saveRunSummary(runId, input.goal, result);

    // 2. DB conversation persistence (chat_messages table → UI session replay)
    void memory.persistConversation(runId, input.goal, result.messages);

    // 3. tasks.md tracking (pending tasks visible to next run)
    void memory.trackTaskOutcome(runId, input.goal, result);

    emitAgentEvent({
      runId,
      projectId,
      phase:     "tool-loop",
      eventType: result.success ? "phase.completed" : "phase.failed",
      payload:   {
        steps:             result.steps,
        stopReason:        result.stopReason,
        summary:           result.summary,
        error:             result.error,
        memoryLoaded:      !!memoryContext,
        memoryWritten:     true,
        conversationSaved: true,
      },
      ts: Date.now(),
    });

    return {
      success: result.success,
      result:  {
        steps:      result.steps,
        stopReason: result.stopReason,
        summary:    result.summary,
        error:      result.error,
      },
    };
  });
}
