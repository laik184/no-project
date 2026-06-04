import type { RunStartedEvent, RunCompletedEvent, RunFailedEvent } from '../types/event.types.ts';

export function makeRunStartedEvent(
  runId:     string,
  projectId: number,
  goal:      string,
  mode:      string,
): RunStartedEvent {
  return { type: 'chat.run.started', runId, projectId, goal, mode, ts: Date.now() };
}

export function makeRunCompletedEvent(
  runId:      string,
  projectId:  number,
  durationMs: number,
): RunCompletedEvent {
  return { type: 'chat.run.completed', runId, projectId, durationMs, ts: Date.now() };
}

export function makeRunFailedEvent(
  runId:     string,
  projectId: number,
  error:     string,
): RunFailedEvent {
  return { type: 'chat.run.failed', runId, projectId, error, ts: Date.now() };
}

export function isTerminalStatus(status: string): boolean {
  return ['completed', 'failed', 'cancelled'].includes(status);
}
