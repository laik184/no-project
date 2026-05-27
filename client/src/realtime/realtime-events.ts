/**
 * realtime-events.ts — client-side topic registry
 *
 * Must stay in sync with server/infrastructure/realtime/stream-topics.ts.
 * These are the SSE event names sent by /api/realtime.
 */

export const TOPIC = {
  AGENT:               "agent",
  LIFECYCLE:           "lifecycle",
  CONSOLE:             "console",
  FILE:                "file",
  RUNTIME_VERIFIED:    "runtime.verified",
  RUNTIME_OBSERVATION: "runtime.observation",
  DIFF:                "diff",
  CHECKPOINT:          "checkpoint",
  PREVIEW_LIFECYCLE:   "preview.lifecycle",
  DEBUG_LIFECYCLE:     "debug.lifecycle",
  TOOL_EXECUTION:      "tool.execution",
  BROWSER_SESSION:     "browser.session",
} as const;

export type RealtimeTopic = typeof TOPIC[keyof typeof TOPIC];

/** Full list — used to attach listeners in the RealtimeProvider. */
export const ALL_TOPICS: readonly RealtimeTopic[] = Object.values(TOPIC) as RealtimeTopic[];
