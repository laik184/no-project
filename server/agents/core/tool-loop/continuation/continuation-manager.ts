/**
 * continuation-manager.ts
 *
 * Wraps runAgentLoop with an autonomous continuation system.
 *
 * When the inner loop hits max_steps:
 *   1. Emits agent.replanning — surface to frontend
 *   2. Compresses accumulated message history (context-compressor)
 *   3. Emits agent.context_compressed
 *   4. Restarts loop with compressed context as initialMessages
 *   5. Emits agent.continuation — signals new run started
 *   6. Tracks totalSteps across all continuation rounds
 *   7. Enforces a hard cap to prevent runaway loops
 *
 * Safety limits:
 *   - Default 3 continuations, configurable via ContinuationOptions
 *   - Hard ceiling of 5 regardless of configuration
 *   - Each continuation gets the same maxSteps budget as the initial run
 *   - Non-max_steps exits (complete, error, aborted, no_tool_calls)
 *     are returned immediately without continuation
 */

import { runAgentLoop } from "../tool-loop.agent.ts";
import { compressMessages } from "./context-compressor.ts";
import { bus } from "../../../../infrastructure/events/bus.ts";
import type { AgentLoopInput, AgentLoopResult } from "../tool-loop.agent.ts";
import type { ToolMessage } from "../../../../llm/openrouter.client.ts";

const DEFAULT_MAX_CONTINUATIONS = 3;
const HARD_CONTINUATION_CEILING = 5;

export interface ContinuationOptions {
  /** Maximum number of automatic continuations before stopping. Default: 3. */
  maxContinuations?: number;
}

function emitEvent(
  runId: string,
  eventType: "agent.replanning" | "agent.continuation" | "agent.context_compressed",
  payload: unknown
): void {
  bus.emit("agent.event", {
    runId,
    eventType: eventType as any,
    phase: "tool-loop",
    ts: Date.now(),
    payload,
  });
}

/**
 * Run the agent loop with automatic continuation when max_steps is reached.
 * Accumulates totalSteps across all rounds and returns them in the final result.
 */
export async function runAgentLoopWithContinuation(
  input: AgentLoopInput,
  options?: ContinuationOptions
): Promise<AgentLoopResult> {
  const maxContinuations = Math.min(
    options?.maxContinuations ?? DEFAULT_MAX_CONTINUATIONS,
    HARD_CONTINUATION_CEILING
  );

  let currentInput: AgentLoopInput = input;
  let continuationCount = 0;
  let totalSteps = 0;
  let lastMessages: ToolMessage[] | undefined;

  while (true) {
    const result = await runAgentLoop(currentInput);
    totalSteps += result.steps;

    // Any exit other than max_steps is terminal — return immediately
    if (result.stopReason !== "max_steps") {
      return { ...result, steps: totalSteps };
    }

    // Capture messages before they are lost
    lastMessages = result.messages;

    // Hard cap reached — surface a clear message and stop
    if (continuationCount >= maxContinuations) {
      emitEvent(input.runId, "agent.replanning", {
        text: `Continuation limit reached (${maxContinuations}). Task stopped after ${totalSteps} total steps.`,
        continuationCount,
        totalSteps,
        limitReached: true,
      });
      return {
        success: false,
        steps: totalSteps,
        summary: `Stopped after ${continuationCount} continuation(s) and ${totalSteps} total steps — continuation limit reached.`,
        stopReason: "max_steps",
        messages: lastMessages,
      };
    }

    continuationCount++;

    emitEvent(input.runId, "agent.replanning", {
      text: `Step limit reached — compressing context and continuing (${continuationCount}/${maxContinuations})…`,
      continuationCount,
      maxContinuations,
      totalSteps,
    });

    const { messages: compressedMessages } = compressMessages({
      messages: lastMessages ?? [],
      originalGoal: input.goal,
      stepsTaken: result.steps,
      continuationCount,
    });

    emitEvent(input.runId, "agent.context_compressed", {
      originalMessageCount: lastMessages?.length ?? 0,
      compressedMessageCount: compressedMessages.length,
      continuationCount,
    });

    emitEvent(input.runId, "agent.continuation", {
      text: `Continuation ${continuationCount}/${maxContinuations} starting…`,
      continuationCount,
      maxContinuations,
      totalSteps,
    });

    currentInput = { ...input, initialMessages: compressedMessages };
  }
}
