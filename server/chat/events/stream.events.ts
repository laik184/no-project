/**
 * stream.events.ts — Token stream event factories.
 * Pure factories — no side effects.
 */
import type { StreamStartedEvent, StreamTokenEvent, StreamEndedEvent } from '../types/event.types.ts';
import { CHAT_EVENT } from '../constants/event.constants.ts';

let _seqCounter = 0;

/** Monotonic sequence counter — resets on server restart (acceptable for UI ordering). */
export function nextSeq(): number {
  return ++_seqCounter;
}

export function makeStreamStartedEvent(runId: string, projectId: number): StreamStartedEvent {
  return { type: CHAT_EVENT.STREAM_STARTED, runId, projectId, ts: Date.now() };
}

export function makeStreamTokenEvent(
  runId:     string,
  projectId: number,
  token:     string,
): StreamTokenEvent {
  return {
    type:      CHAT_EVENT.STREAM_TOKEN,
    runId,
    projectId,
    token,
    seqIndex:  nextSeq(),
    ts:        Date.now(),
  };
}

export function makeStreamEndedEvent(
  runId:       string,
  projectId:   number,
  totalTokens: number,
  durationMs:  number,
): StreamEndedEvent {
  return { type: CHAT_EVENT.STREAM_ENDED, runId, projectId, totalTokens, durationMs, ts: Date.now() };
}
