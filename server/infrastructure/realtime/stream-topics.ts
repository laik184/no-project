/**
 * server/infrastructure/realtime/stream-topics.ts
 *
 * Canonical SSE topic names for the application.
 * All modules that publish or subscribe to SSE streams MUST use these constants.
 * Must stay in sync with client/src/realtime/realtime-events.ts.
 */

export const TOPIC = {
  AGENT:               'agent',
  LIFECYCLE:           'lifecycle',
  CHECKPOINT:          'checkpoint',
  CONSOLE:             'console',
  FILE:                'file',
  RUNTIME_VERIFIED:    'runtime.verified',
  RUNTIME_OBSERVATION: 'runtime.observation',
  DIFF:                'diff',
  PREVIEW_LIFECYCLE:   'preview.lifecycle',
  PREVIEW_RUNTIME:     'preview.runtime',
  PREVIEW_HEALTH:      'preview.health',
  PREVIEW_RELOAD:      'preview.reload',
  PREVIEW_DEVTOOLS:    'preview.devtools',
  DEBUG_LIFECYCLE:     'debug.lifecycle',
  TOOL_EXECUTION:      'tool.execution',
  BROWSER_SESSION:     'browser.session',
} as const;

export type Topic = typeof TOPIC[keyof typeof TOPIC];
