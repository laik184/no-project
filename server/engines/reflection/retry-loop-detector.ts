/**
 * server/engines/reflection/retry-loop-detector.ts
 * Detects repeated identical tool usage patterns from message history.
 * Single responsibility: detect loops → RetryLoopReport. No side effects.
 */

import type { RetryLoopReport } from "./types.ts";

interface ToolMessage {
  role: string;
  tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
}

const LOOP_THRESHOLD = 3; // same tool + same args pattern N times = loop

// ── Fingerprint a tool call ───────────────────────────────────────────────────

function fingerprint(name: string, args: string): string {
  try {
    const parsed = JSON.parse(args);
    // Normalize: sort keys, trim long string values
    const normalized = Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [
          k,
          typeof v === "string" && v.length > 80 ? v.slice(0, 80) : v,
        ]),
    );
    return `${name}::${JSON.stringify(normalized)}`;
  } catch {
    return `${name}::${args.slice(0, 120)}`;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function detectRetryLoop(messages: ToolMessage[]): RetryLoopReport {
  const counts = new Map<string, number>();
  let detectedTool: string | undefined;
  let detectedPattern: string | undefined;
  let maxCount = 0;

  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.tool_calls) continue;
    for (const tc of msg.tool_calls) {
      const name = tc.function?.name;
      const args = tc.function?.arguments ?? "{}";
      if (!name) continue;

      const fp = fingerprint(name, args);
      const count = (counts.get(fp) ?? 0) + 1;
      counts.set(fp, count);

      if (count > maxCount) {
        maxCount = count;
        detectedTool    = name;
        detectedPattern = fp;
      }
    }
  }

  if (maxCount >= LOOP_THRESHOLD) {
    return {
      detected:       true,
      repeatedTool:   detectedTool,
      count:          maxCount,
      pattern:        detectedPattern,
    };
  }

  return { detected: false };
}
