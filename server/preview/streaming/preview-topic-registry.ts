/**
 * preview-topic-registry.ts — Preview-specific SSE topic constants.
 * Extends the infrastructure TOPIC registry with preview-specific topics.
 */

import { TOPIC as INFRA_TOPIC } from "../../infrastructure/index.ts";

export const PREVIEW_TOPIC = {
  // Core preview topics (mirrors client realtime-events.ts)
  LIFECYCLE:  INFRA_TOPIC.PREVIEW_LIFECYCLE,  // "preview.lifecycle"
  RUNTIME:    "preview.runtime",
  HEALTH:     "preview.health",
  RELOAD:     "preview.reload",
  DEVTOOLS:   "preview.devtools",
} as const;

export type PreviewTopic = typeof PREVIEW_TOPIC[keyof typeof PREVIEW_TOPIC];

export const ALL_PREVIEW_TOPICS: PreviewTopic[] = Object.values(PREVIEW_TOPIC);
