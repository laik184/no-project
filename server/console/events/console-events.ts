/**
 * server/console/events/console-events.ts
 *
 * Typed event names and bus integration for the console module.
 * All internal console events flow through the shared infrastructure bus.
 */

import { busAdapter } from '../../shared/events/bus-adapter.ts';
import type { LogLine, RuntimeStateEvent } from '../../shared/console/types.ts';

// ── Event name constants ───────────────────────────────────────────────────────

export const CONSOLE_EVENT = {
  LOG_LINE:      'console.log_line',
  RUNTIME_STATE: 'console.runtime_state',
  SESSION_OPEN:  'console.session_open',
  SESSION_CLOSE: 'console.session_close',
} as const;

export type ConsoleEventName = typeof CONSOLE_EVENT[keyof typeof CONSOLE_EVENT];

// ── Publish helpers ────────────────────────────────────────────────────────────

/** Emit a log line on the bus (consumed by StreamBroker). */
export function emitLogLine(projectId: number, log: LogLine): void {
  busAdapter.emit('console.log_line', { projectId, ...log });
}

/** Emit a runtime state change on the bus (consumed by StreamBroker). */
export function emitRuntimeState(projectId: number, event: RuntimeStateEvent): void {
  busAdapter.emit('console.runtime_state', { projectId, ...event });
}

/** Emit a session-opened event. */
export function emitSessionOpen(projectId: number, sessionId: string): void {
  busAdapter.emit('console.session_open', { projectId, sessionId });
}

/** Emit a session-closed event. */
export function emitSessionClose(projectId: number, sessionId: string): void {
  busAdapter.emit('console.session_close', { projectId, sessionId });
}

// ── Subscribe helpers ──────────────────────────────────────────────────────────

type Payload = Record<string, unknown>;

export function onLogLine(
  handler: (projectId: number, log: LogLine) => void,
): () => void {
  const listener = (payload: Payload) => {
    const { projectId, ...log } = payload;
    handler(projectId as number, log as unknown as LogLine);
  };
  busAdapter.on('console.log_line', listener);
  return () => busAdapter.off('console.log_line', listener);
}

export function onRuntimeState(
  handler: (projectId: number, event: RuntimeStateEvent) => void,
): () => void {
  const listener = (payload: Payload) => {
    const { projectId, ...event } = payload;
    handler(projectId as number, event as unknown as RuntimeStateEvent);
  };
  busAdapter.on('console.runtime_state', listener);
  return () => busAdapter.off('console.runtime_state', listener);
}
