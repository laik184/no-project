/**
 * server/terminal/events/process-events.ts
 *
 * Process lifecycle event payloads and factory helpers.
 */

export interface ProcessStartedPayload {
  sessionId: string;
  pid:       number;
  command:   string;
  cwd:       string;
  timestamp: number;
}

export interface ProcessStoppedPayload {
  sessionId: string;
  pid:       number;
  exitCode:  number | null;
  signal:    string | null;
  timestamp: number;
}

export interface ProcessCrashedPayload {
  sessionId:  string;
  pid:        number;
  exitCode:   number | null;
  signal:     string | null;
  restarts:   number;
  timestamp:  number;
}

export function makeProcessStarted(
  sessionId: string,
  pid:       number,
  command:   string,
  cwd:       string,
): ProcessStartedPayload {
  return { sessionId, pid, command, cwd, timestamp: Date.now() };
}

export function makeProcessStopped(
  sessionId: string,
  pid:       number,
  exitCode:  number | null,
  signal:    string | null,
): ProcessStoppedPayload {
  return { sessionId, pid, exitCode, signal, timestamp: Date.now() };
}

export function makeProcessCrashed(
  sessionId: string,
  pid:       number,
  exitCode:  number | null,
  signal:    string | null,
  restarts:  number,
): ProcessCrashedPayload {
  return { sessionId, pid, exitCode, signal, restarts, timestamp: Date.now() };
}
