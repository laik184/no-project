/**
 * server/terminal/events/terminal-events.ts
 *
 * Terminal event names and typed factory functions.
 */

import type { StreamFrame } from '../contracts/terminal-state.ts';

export const TERMINAL_EVENT = {
  LINE_STDOUT:      'terminal:line:stdout',
  LINE_STDERR:      'terminal:line:stderr',
  LINE_SYSTEM:      'terminal:line:system',
  COMMAND_STARTED:  'terminal:command:started',
  COMMAND_ENDED:    'terminal:command:ended',
  COMMAND_TIMEOUT:  'terminal:command:timeout',
  SESSION_CREATED:  'terminal:session:created',
  SESSION_CLOSED:   'terminal:session:closed',
  RUNTIME_STARTED:  'terminal:runtime:started',
  RUNTIME_STOPPED:  'terminal:runtime:stopped',
  RUNTIME_CRASHED:  'terminal:runtime:crashed',
  HEALTH_OK:        'terminal:health:ok',
  HEALTH_FAIL:      'terminal:health:fail',
} as const;

export type TerminalEventName = typeof TERMINAL_EVENT[keyof typeof TERMINAL_EVENT];

export function makeLineFrame(
  sessionId: string,
  line:      string,
  type:      StreamFrame['type'],
): StreamFrame {
  return { type, sessionId, line, timestamp: Date.now() };
}

export function makeExitFrame(sessionId: string, exitCode: number): StreamFrame {
  return { type: 'exit', sessionId, line: '', timestamp: Date.now(), exitCode };
}

export function makeSystemFrame(sessionId: string, message: string): StreamFrame {
  return { type: 'system', sessionId, line: message, timestamp: Date.now() };
}

export function makeErrorFrame(sessionId: string, message: string): StreamFrame {
  return { type: 'error', sessionId, line: message, timestamp: Date.now() };
}
