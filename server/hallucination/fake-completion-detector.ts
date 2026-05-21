/**
 * server/hallucination/fake-completion-detector.ts
 * Detects task_complete calls made without meaningful prior progress.
 * Single responsibility: detect premature completions. No side effects.
 */

import type { HallucinationSignal } from "./types.ts";

interface ToolMessage {
  role: string;
  content?: string;
  tool_calls?: Array<{ function?: { name?: string } }>;
}

const MIN_MEANINGFUL_STEPS = 2; // at least 2 non-terminal tool calls before complete

export function detectFakeCompletion(messages: ToolMessage[]): HallucinationSignal[] {
  const signals: HallucinationSignal[] = [];

  let meaningfulSteps = 0;
  let sawComplete     = false;

  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.tool_calls) continue;

    for (const tc of msg.tool_calls) {
      const name = tc.function?.name ?? "";
      if (name === "task_complete") {
        sawComplete = true;
        if (meaningfulSteps < MIN_MEANINGFUL_STEPS) {
          signals.push({
            type:       "fake_completion",
            confidence: 0.85,
            evidence:   `task_complete called after only ${meaningfulSteps} meaningful action(s)`,
            location:   "task_complete",
          });
        }
      } else if (name) {
        meaningfulSteps++;
      }
    }
  }

  return signals;
}
