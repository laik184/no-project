/**
 * server/infrastructure/realtime/stream-topics.ts
 *
 * Canonical SSE topic names for the application.
 * All modules that publish or subscribe to SSE streams MUST use these constants.
 */

export const TOPIC = {
  AGENT:      'agent',
  LIFECYCLE:  'lifecycle',
  CHECKPOINT: 'checkpoint',
} as const;

export type Topic = typeof TOPIC[keyof typeof TOPIC];
