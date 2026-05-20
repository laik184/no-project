/**
 * stream-topics.ts — canonical SSE topic registry
 *
 * Single source of truth for topic names used by both the unified
 * /api/realtime endpoint (server) and the RealtimeProvider (client).
 *
 * Rules:
 *  - Each topic maps 1-to-1 with one or more bus event types.
 *  - SSE event name sent to the client EQUALS the topic string.
 *  - Never add a topic here without a corresponding bus handler in sse.ts.
 */

export const TOPIC = {
  AGENT:               "agent",
  LIFECYCLE:           "lifecycle",
  CONSOLE:             "console",
  FILE:                "file",
  RUNTIME_VERIFIED:    "runtime.verified",
  RUNTIME_OBSERVATION: "runtime.observation",
  RUNTIME_SYNC:        "runtime.sync",
  DIFF:                "diff",
  CHECKPOINT:          "checkpoint",
  PREVIEW_LIFECYCLE:   "preview.lifecycle",
  DEBUG_LIFECYCLE:     "debug.lifecycle",
  TOOL_EXECUTION:      "tool.execution",
} as const;

export type Topic = typeof TOPIC[keyof typeof TOPIC];

/** All topics — used by the server when no ?topics= filter is given. */
export const ALL_TOPICS: readonly Topic[] = Object.values(TOPIC) as Topic[];
