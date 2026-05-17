/**
 * tool-loop.agent.ts
 *
 * THE LLM TOOL-USE AGENT.
 * Calls OpenRouter in a step-by-step loop until task_complete or max steps.
 *
 * After every tool call, the ExecutionObserver (T4 fix) appends a structured
 * [OBSERVATION] block to the tool result so the AI can reason about what happened —
 * console errors, runtime health, failure class, and recommended next action.
 *
 * ── Verification gate ──────────────────────────────────────────────────────────
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
import { executeToolCall }           from "./tool-call.executor.ts";
import { executionObserver }         from "../../../tools/observation/index.ts";
import { checkpointStore }           from "../../../infrastructure/checkpoints/checkpoint.service.ts";
import { rollbackLatestForRun }      from "../../../infrastructure/checkpoints/rollback.service.ts";
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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentLoopInput {
  readonly projectId:      number;
  readonly runId:          string;
  readonly goal:           string;
  readonly maxSteps?:      number;
  readonly signal?:        AbortSignal;
  readonly systemPrompt?:  string;
  readonly initialMessages?: ToolMessage[];
  readonly skipVerification?: boolean;
  readonly memoryContext?: string;
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
  const maxSteps = input.maxSteps ?? 25;
  const resolvedSystemPrompt = buildSystemPrompt(input.systemPrompt) + "\n\n" + TOOL_REFERENCE;

  const messages: ToolMessage[] = input.initialMessages ?? buildInitialMessages(
    resolvedSystemPrompt, input.projectId, input.goal, input.memoryContext,
  );

  const ctx: ToolContext = { projectId: input.projectId, runId: input.runId, signal: input.signal };
  const retryCtrl = input.skipVerification ? null : getOrCreateRetryController(input.runId);

  // ── Pre-run checkpoint: create a safety snapshot before any changes ────────
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
        return { success: false, steps, summary: "Aborted by user.", stopReason: "aborted" };
      }

      steps++;
      emit(input.runId, "agent.thinking", "tool-loop", { step: steps, text: `Step ${steps}: thinking…` });

      // ── LLM call ──────────────────────────────────────────────────────────
      let response: Awaited<ReturnType<typeof llm.chatWithTools>>;
      try {
        response = await withRetry(
          () => llm.chatWithTools(messages, [...TOOL_DEFS], { signal: input.signal }),
          { maxAttempts: 3, runId: input.runId, operationName: "llm.chatWithTools", signal: input.signal },
        );
      } catch (e: any) {
        const msg = e?.message || String(e);
        emit(input.runId, "agent.message", "error", { text: `LLM error (all retries exhausted): ${msg}` });
        return { success: false, steps, summary: msg, stopReason: "error", error: msg };
      }

      if (response.content?.trim()) {
        emit(input.runId, "agent.message", "tool-loop", { text: response.content });
      }

      if (response.toolCalls.length === 0) {
        const summary = response.content?.trim() || lastSummary || "Done.";
        emit(input.runId, "agent.message", "complete", { text: summary });
        return { success: true, steps, summary, stopReason: "no_tool_calls" };
      }

      messages.push({
        role: "assistant",
        content: response.content || "",
        tool_calls: response.toolCalls.map((tc) => ({
          id: tc.id, type: "function" as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      });

      let saw_complete = false;

      // ── Execute all tool calls for this step ──────────────────────────────
      for (const call of response.toolCalls) {
        const output = await executeToolCall({
          callId: call.id, name: call.name, args: call.arguments, ctx,
        });

        messages.push({ role: "tool", tool_call_id: call.id, content: output.content });

        // ── Verification gate — only on terminal (task_complete) ───────────
        if (!output.isTerminal) continue;
        const summary = (output.parsedArgs["summary"] as string) || "Task complete.";

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
            role: "tool", tool_call_id: call.id,
            content: buildExhaustedFeedback(report, retryCtrl.maxRetries),
          };
          saw_complete = true;
          lastSummary = `${summary} (completed with verification warnings)`;
        } else {
          const attempt = retryCtrl.recordAttempt();
          emitVerificationFailed(report, attempt);
          messages[messages.length - 1] = {
            role: "tool", tool_call_id: call.id,
            content: buildVerificationFeedback(report, attempt, retryCtrl.maxRetries),
          };
        }
      }

      if (saw_complete) {
        return { success: true, steps, summary: lastSummary, stopReason: "complete" };
      }
    }

    return { success: false, steps, summary: `Reached step limit of ${maxSteps}.`, stopReason: "max_steps", messages };

  } finally {
    releaseRetryController(input.runId);
    executionObserver.release(input.runId);   // T4: release per-run observation memory
  }
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
