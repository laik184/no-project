import type { StreamStartedEvent, StreamTokenEvent, StreamEndedEvent } from '../types/event.types.ts';

let _seq = 0;

export function nextSeq(): number { return ++_seq; }

export function makeStreamStartedEvent(runId: string, projectId: number): StreamStartedEvent {
  return { eventType: 'agent.stream.start', runId, projectId, ts: Date.now() };
}

export function makeStreamTokenEvent(
  runId:     string,
  projectId: number,
  token:     string,
): StreamTokenEvent {
  return {
    eventType: 'agent.token',
    payload:   { token },
    runId,
    projectId,
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
  return { eventType: 'agent.stream.end', runId, projectId, totalTokens, durationMs, ts: Date.now() };
}
