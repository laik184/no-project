/**
 * server/services/chat/stream.service.ts
 *
 * Token stream lifecycle for active chat runs.
 * Handles open/append/close + timeout enforcement.
 *
 * Owns: stream open, token append (SSE events), stream close, timeout handling.
 */

import {
  makeStreamStartedEvent,
  makeStreamTokenEvent,
  makeStreamEndedEvent,
} from '../../chat/events/stream.events.ts';
import { eventPublisher }        from '../../chat/realtime/event-publisher.ts';
import { MAX_STREAM_DURATION_MS } from '../../chat/constants/stream.constants.ts';

export class StreamError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'StreamError';
  }
}

interface StreamState {
  projectId:  number;
  tokenCount: number;
  openedAt:   number;
  timeoutId?: ReturnType<typeof setTimeout>;
}

const _streams = new Map<string, StreamState>();

export const streamManager = {
  open(runId: string, projectId: number): void {
    if (_streams.has(runId)) return;

    const timeoutId = setTimeout(() => {
      if (_streams.has(runId)) streamManager.close(runId);
    }, MAX_STREAM_DURATION_MS);

    _streams.set(runId, { projectId, tokenCount: 0, openedAt: Date.now(), timeoutId });
    eventPublisher.publish(makeStreamStartedEvent(runId, projectId));
  },

  append(runId: string, token: string): void {
    const s = _streams.get(runId);
    if (!s) return;
    s.tokenCount++;
    eventPublisher.publish(makeStreamTokenEvent(runId, s.projectId, token));
  },

  close(runId: string): void {
    const s = _streams.get(runId);
    if (!s) return;
    if (s.timeoutId) clearTimeout(s.timeoutId);
    const durationMs = Date.now() - s.openedAt;
    _streams.delete(runId);
    eventPublisher.publish(makeStreamEndedEvent(runId, s.projectId, s.tokenCount, durationMs));
  },

  isActive(runId: string): boolean {
    return _streams.has(runId);
  },

  getTokenCount(runId: string): number {
    return _streams.get(runId)?.tokenCount ?? 0;
  },

  size(): number { return _streams.size; },
};

export const streamService = streamManager;
