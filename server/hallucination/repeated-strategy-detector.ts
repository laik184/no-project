/**
 * server/hallucination/repeated-strategy-detector.ts
 * Detects when the LLM repeats the same failing approach N+ times.
 * Single responsibility: detect repeated strategies. No side effects.
 */

import type { HallucinationSignal } from "./types.ts";

interface ToolMessage {
  role: string;
  tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
}

const REPEAT_THRESHOLD = 3;

function fingerprint(name: string, args: string): string {
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    const keys   = Object.keys(parsed).sort().join(",");
    return `${name}[${keys}]`;
  } catch {
    return name;
  }
}

export function detectRepeatedStrategy(messages: ToolMessage[]): HallucinationSignal[] {
  const counts = new Map<string, number>();
  const signals: HallucinationSignal[] = [];
  const reported = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.tool_calls) continue;

    for (const tc of msg.tool_calls) {
      const name = tc.function?.name;
      const args = tc.function?.arguments ?? "{}";
      if (!name || name === "task_complete") continue;

      const fp    = fingerprint(name, args);
      const count = (counts.get(fp) ?? 0) + 1;
      counts.set(fp, count);

      if (count >= REPEAT_THRESHOLD && !reported.has(fp)) {
        reported.add(fp);
        signals.push({
          type:       "repeated_strategy",
          confidence: Math.min(0.5 + (count - REPEAT_THRESHOLD) * 0.1, 0.95),
          evidence:   `Tool "${name}" called ${count}x with same argument shape — strategy is not progressing`,
          location:   name,
        });
      }
    }
  }

  return signals;
}
