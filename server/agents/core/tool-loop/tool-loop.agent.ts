/**
 * tool-loop.agent.ts
 *
 * THE LLM TOOL-USE AGENT.
 * Calls OpenRouter in a step-by-step loop until task_complete or max steps.
 *
 * ── Parallel execution (upgraded) ────────────────────────────────────────────
 * Tool calls are no longer executed sequentially. Each step's tool calls are:
 *   1. Classified: PARALLEL_SAFE | SERIAL_REQUIRED | EXCLUSIVE_RESOURCE
 *   2. Grouped into ordered execution batches (parallel + serial)
 *   3. Dispatched: safe reads run concurrently, mutations run sequentially
 * See server/agents/core/tool-loop/execution/ for the full implementation.
 *
 * ── Verification gate ─────────────────────────────────────────────────────────
 * On task_complete: run verification engine (runtime + TS + preview checks).
 * Pass → complete. Fail → inject failure so LLM self-heals. Exhaust → warn + done.
 */

import { llm, type ToolMessage }    from "../../../llm/openrouter.client.ts";
import { TOOL_DEFS }                from "../../../tools/orchestrator.ts";
import type { ToolContext }          from "../../../tools/orchestrator.ts";
import { bus }                       from "../../../infrastructure/events/bus.ts";
import { buildSystemPrompt }         from "../llm/prompt-builder/agents/system-prompt.agent.js";
import { TOOL_REFERENCE }            from "./tool-reference.ts";
import { withRetry }                 from "./retry.ts";
import { executionObserver }         from "../../../tools/observation/index.ts";
import { checkpointStore }           from "../../../infrastructure/checkpoints/checkpoint.service.ts";
import { getProjectDir }             from "../../../infrastructure/sandbox/sandbox.util.ts";
import {
  runVerificationEngine,
  buildVerificationFeedback,
  buildExhaustedFeedback,
  getOrCreateRetryController,
  releaseRetryController,
  emitVerificationStarted,
  emitVerificationPassed,
  emitVerificationFailed,
  emitVerificationExhausted,
}                                    from "../../../verification/index.ts";

// ── Parallel execution system ─────────────────────────────────────────────────
import { buildToolGroups }           from "./execution/tool-group-builder.ts";
import { executeParallelBatch }      from "./execution/parallel-tool-executor.ts";
import { executeSerialBatch }        from "./execution/serial-tool-executor.ts";
import {
  emitBatchStarted,
  emitBatchCompleted,
  emitBatchFailed,
}                                    from "./telemetry/tool-execution-telemetry.ts";
import type { ToolExecutionRecord }  from "./types/parallel-execution.types.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentLoopInput {
  readonly projectId:        number;
  readonly runId:            string;
  readonly goal:             string;
  readonly maxSteps?:        number;
  readonly signal?:          AbortSignal;
  readonly systemPrompt?:    string;
  readonly initialMessages?: ToolMessage[];
  readonly skipVerification?: boolean;
  readonly memoryContext?:   string;
}

export interface AgentLoopResult {
  readonly success:    boolean;
  readonly steps:      number;
  readonly summary:    string;
  readonly stopReason: "complete" | "max_steps" | "no_tool_calls" | "error" | "aborted";
  readonly error?:     string;
  readonly messages?:  ToolMessage[];
}

// ─── Agent loop ───────────────────────────────────────────────────────────────

export async function runAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const maxSteps            = input.maxSteps ?? 25;
  const resolvedSystemPrompt = buildSystemPrompt(input.systemPrompt) + "\n\n" + TOOL_REFERENCE;

  const messages: ToolMessage[] = input.initialMessages ?? buildInitialMessages(
    resolvedSystemPrompt, input.projectId, input.goal, input.memoryContext,
  );

  const ctx: ToolContext = { projectId: input.projectId, runId: input.runId, signal: input.signal };
  const retryCtrl = input.skipVerification ? null : getOrCreateRetryController(input.runId);

  // ── Pre-run checkpoint ────────────────────────────────────────────────────
  const sandboxRoot = getProjectDir(input.projectId);
  checkpointStore.create({
    projectId:   input.projectId,
    sandboxRoot,
    trigger:     "run_start",
    runId:       input.runId,
    label:       `pre-run: ${input.goal.slice(0, 60)}`,
  }).catch((e) => console.warn("[tool-loop] Pre-run checkpoint failed (non-fatal):", e.message));

  emit(input.runId, "agent.thinking", "tool-loop", {
    text: `Starting agent loop for: ${input.goal.slice(0, 200)}`,
  });

  let steps = 0, lastSummary = "";

  try {
    while (steps < maxSteps) {
      if (input.signal?.aborted) {
        return { success: false, steps, summary: "Aborted by user.", stopReason: "aborted", messages };
      }

      steps++;
      emit(input.runId, "agent.thinking", "tool-loop", { step: steps, text: `Step ${steps}: thinking…` });

      // ── LLM call (streaming) ────────────────────────────────────────────
      let response: Awaited<ReturnType<typeof llm.chatWithTools>>;
      let streamedContent = false;
      try {
        response = await withRetry(
          () => llm.streamChatWithTools(messages, [...TOOL_DEFS], {
            signal:        input.signal,
            onStreamStart: () => emit(input.runId, "agent.stream.start", "tool-loop", {}),
            onToken:       (token) => {
              streamedContent = true;
              emit(input.runId, "agent.token", "tool-loop", { token });
            },
            onStreamEnd: (content) => emit(input.runId, "agent.stream.end", "tool-loop", { content }),
          }),
          { maxAttempts: 3, runId: input.runId, operationName: "llm.streamChatWithTools", signal: input.signal },
        );
      } catch (e: any) {
        const msg = e?.message || String(e);
        emit(input.runId, "agent.message", "error", { text: `LLM error (all retries exhausted): ${msg}` });
        return { success: false, steps, summary: msg, stopReason: "error", error: msg, messages };
      }

      if (response.content?.trim() && !streamedContent) {
        emit(input.runId, "agent.message", "tool-loop", { text: response.content });
      }

      if (response.toolCalls.length === 0) {
        const summary = response.content?.trim() || lastSummary || "Done.";
        emit(input.runId, "agent.message", "complete", { text: summary });
        return { success: true, steps, summary, stopReason: "no_tool_calls", messages };
      }

      messages.push({
        role:       "assistant",
        content:    response.content || "",
        tool_calls: response.toolCalls.map((tc) => ({
          id: tc.id, type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      // ── PARALLEL EXECUTION: classify → group → dispatch ─────────────────
      const allRecords = await dispatchToolCalls(response.toolCalls, ctx, input.runId);

      // ── Push tool results in original LLM call order ─────────────────────
      // Build a lookup map so we can restore original ordering.
      const recordByCallId = new Map<string, ToolExecutionRecord>(
        allRecords.map((r) => [r.callId, r]),
      );

      let saw_complete = false;

      for (const call of response.toolCalls) {
        const record = recordByCallId.get(call.id);
        if (!record) continue;  // should never happen

        messages.push({ role: "tool", tool_call_id: call.id, content: record.output.content });

        // ── Verification gate — only on terminal (task_complete / agent_fail) ──
        if (!record.output.isTerminal) continue;
        const summary = (record.output.parsedArgs["summary"] as string) || "Task complete.";

        if (!retryCtrl) {
          saw_complete = true; lastSummary = summary; continue;
        }

        emitVerificationStarted(input.projectId, input.runId);
        const report = await runVerificationEngine(input.projectId, input.runId);

        if (report.passed) {
          emitVerificationPassed(report);
          saw_complete = true; lastSummary = summary;
        } else if (retryCtrl.exhausted) {
          emitVerificationExhausted(input.projectId, input.runId, retryCtrl.maxRetries);
          messages[messages.length - 1] = {
            role:        "tool",
            tool_call_id: call.id,
            content:     buildExhaustedFeedback(report, retryCtrl.maxRetries),
          };
          saw_complete  = true;
          lastSummary   = `${summary} (completed with verification warnings)`;
        } else {
          const attempt = retryCtrl.recordAttempt();
          emitVerificationFailed(report, attempt);
          messages[messages.length - 1] = {
            role:        "tool",
            tool_call_id: call.id,
            content:     buildVerificationFeedback(report, attempt, retryCtrl.maxRetries),
          };
        }
      }

      if (saw_complete) {
        return { success: true, steps, summary: lastSummary, stopReason: "complete", messages };
      }
    }

    return {
      success:    false,
      steps,
      summary:    `Reached step limit of ${maxSteps}.`,
      stopReason: "max_steps",
      messages:   [...messages],
    };

  } finally {
    releaseRetryController(input.runId);
    executionObserver.release(input.runId);
  }
}

// ─── Parallel dispatch ────────────────────────────────────────────────────────

async function dispatchToolCalls(
  toolCalls: Array<{ id: string; name: string; arguments: string }>,
  ctx:       ToolContext,
  runId:     string,
): Promise<ToolExecutionRecord[]> {
  const rawCalls = toolCalls.map((tc) => ({ callId: tc.id, name: tc.name, args: tc.arguments }));
  const { batches } = buildToolGroups(rawCalls, runId);

  const allRecords: ToolExecutionRecord[] = [];

  for (const batch of batches) {
    emitBatchStarted(runId, batch.batchId, batch.mode, batch.calls.map((c) => c.name));

    let batchResult;
    try {
      if (batch.mode === "parallel") {
        batchResult = await executeParallelBatch(batch.batchId, batch.calls, ctx);
      } else {
        batchResult = await executeSerialBatch(batch.batchId, batch.calls, ctx);
      }
      emitBatchCompleted(runId, batchResult);
    } catch (err: any) {
      emitBatchFailed(runId, batch.batchId, err?.message ?? "unknown batch error");
      throw err; // fail-closed: propagate to outer loop
    }

    allRecords.push(...batchResult.records);
  }

  return allRecords;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialMessages(
  systemPrompt: string, projectId: number, goal: string, memoryContext?: string,
): ToolMessage[] {
  const msgs: ToolMessage[] = [{ role: "system", content: systemPrompt }];
  if (memoryContext) {
    msgs.push({ role: "user",      content: memoryContext });
    msgs.push({ role: "assistant", content: "I've reviewed the project memory. I'll build on existing work." });
  }
  msgs.push({ role: "user", content: `Project ID: ${projectId}\nGoal:\n${goal}` });
  return msgs;
}

function emit(runId: string, eventType: string, phase: string, payload: unknown): void {
  bus.emit("agent.event", { runId, eventType: eventType as any, phase, ts: Date.now(), payload });
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { TOOL_DEFS as TOOL_NAMES };
