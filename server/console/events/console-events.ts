/**
 * server/console/events/console-events.ts
 *
 * Typed event names and bus integration for the console module.
 * All internal console events flow through the shared infrastructure bus.
 */

import { bus }   from '../../infrastructure/events/bus.ts';
import { TOPIC } from '../../infrastructure/realtime/stream-topics.ts';
import type { LogLine, RuntimeStateEvent } from '../types/index.ts';

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
  bus.emit(CONSOLE_EVENT.LOG_LINE as keyof typeof bus['on'] extends never ? string : any, {
    projectId,
    ...log,
  });
}

/** Emit a runtime state change on the bus (consumed by StreamBroker). */
export function emitRuntimeState(projectId: number, event: RuntimeStateEvent): void {
  bus.emit(CONSOLE_EVENT.RUNTIME_STATE as any, { projectId, ...event });
}

/** Emit a session-opened event. */
export function emitSessionOpen(projectId: number, sessionId: string): void {
  bus.emit(CONSOLE_EVENT.SESSION_OPEN as any, { projectId, sessionId });
}

/** Emit a session-closed event. */
export function emitSessionClose(projectId: number, sessionId: string): void {
  bus.emit(CONSOLE_EVENT.SESSION_CLOSE as any, { projectId, sessionId });
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
  bus.on(CONSOLE_EVENT.LOG_LINE as any, listener);
  return () => bus.off(CONSOLE_EVENT.LOG_LINE as any, listener);
}

export function onRuntimeState(
  handler: (projectId: number, event: RuntimeStateEvent) => void,
): () => void {
  const listener = (payload: Payload) => {
    const { projectId, ...event } = payload;
    handler(projectId as number, event as unknown as RuntimeStateEvent);
  };
  bus.on(CONSOLE_EVENT.RUNTIME_STATE as any, listener);
  return () => bus.off(CONSOLE_EVENT.RUNTIME_STATE as any, listener);
}
