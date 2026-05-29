/**
 * run.events.ts — Run lifecycle event factories for the chat domain.
 * Wraps infrastructure bus payloads into typed chat-domain views.
 */
import type { RunStartedEvent, RunCompletedEvent, RunFailedEvent } from '../types/event.types.ts';
import { CHAT_EVENT } from '../constants/event.constants.ts';

export function makeRunStartedEvent(
  runId:     string,
  projectId: number,
  goal:      string,
  mode:      string,
): RunStartedEvent {
  return { type: CHAT_EVENT.RUN_STARTED, runId, projectId, goal, mode, ts: Date.now() };
}

export function makeRunCompletedEvent(
  runId:      string,
  projectId:  number,
  durationMs: number,
): RunCompletedEvent {
  return { type: CHAT_EVENT.RUN_COMPLETED, runId, projectId, durationMs, ts: Date.now() };
}

export function makeRunFailedEvent(
  runId:     string,
  projectId: number,
  error:     string,
): RunFailedEvent {
  return { type: CHAT_EVENT.RUN_FAILED, runId, projectId, error, ts: Date.now() };
}

/** Determine if an infra lifecycle status maps to terminal state. */
export function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
