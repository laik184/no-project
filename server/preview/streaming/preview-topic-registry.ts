/**
 * preview-topic-registry.ts — Preview-specific SSE topic constants.
 * Extends the infrastructure TOPIC registry with preview-specific topics.
 */

import { TOPIC as INFRA_TOPIC } from "../../infrastructure/index.ts";

export const PREVIEW_TOPIC = {
  // Core preview topics (mirrors client realtime-events.ts)
  LIFECYCLE:  INFRA_TOPIC.PREVIEW_LIFECYCLE,  // "preview.lifecycle"
  RUNTIME:    INFRA_TOPIC.PREVIEW_RUNTIME,
  HEALTH:     INFRA_TOPIC.PREVIEW_HEALTH,
  RELOAD:     INFRA_TOPIC.PREVIEW_RELOAD,
  DEVTOOLS:   INFRA_TOPIC.PREVIEW_DEVTOOLS,
} as const;

export type PreviewTopic = typeof PREVIEW_TOPIC[keyof typeof PREVIEW_TOPIC];

export const ALL_PREVIEW_TOPICS: PreviewTopic[] = Object.values(PREVIEW_TOPIC);
