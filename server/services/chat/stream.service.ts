/**
 * server/services/chat/stream.service.ts
 * Extracted from server/chat/orchestration/stream-manager.ts
 *
 * Token stream lifecycle only.
 * Owns: open/append/close a streaming session per run.
 * Publishes stream events via eventPublisher.
 */
import {
  makeStreamStartedEvent,
  makeStreamTokenEvent,
  makeStreamEndedEvent,
} from '../../chat/events/stream.events.ts';
import { eventPublisher }        from '../../chat/realtime/event-publisher.ts';
import { MAX_STREAM_DURATION_MS } from '../../chat/constants/stream.constants.ts';

interface StreamState {
  runId:       string;
  projectId:   number;
  startedAt:   number;
  tokenBuffer: string[];
  totalTokens: number;
  active:      boolean;
  timeoutId:   NodeJS.Timeout;
}

const _streams = new Map<string, StreamState>();

export class StreamError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'StreamError';
  }
}

export const streamManager = {
  /**
   * Open a new stream for a run. Publishes stream.started event.
   * Automatically times out after MAX_STREAM_DURATION_MS.
   */
  open(runId: string, projectId: number): void {
    if (_streams.has(runId)) {
      throw new StreamError(`Stream already open for run ${runId}`, 'ALREADY_OPEN');
    }

    const timeoutId = setTimeout(() => {
      streamManager.close(runId);
    }, MAX_STREAM_DURATION_MS);

    _streams.set(runId, {
      runId,
      projectId,
      startedAt:   Date.now(),
      tokenBuffer: [],
      totalTokens: 0,
      active:      true,
      timeoutId,
    });

    eventPublisher.publish(makeStreamStartedEvent(runId, projectId));
  },

  /**
   * Append a token to the stream. Publishes stream.token event.
   */
  append(runId: string, token: string): void {
    const state = _streams.get(runId);
    if (!state || !state.active) return;

    state.tokenBuffer.push(token);
    state.totalTokens += 1;

    eventPublisher.publish(makeStreamTokenEvent(runId, state.projectId, token));
  },

  /**
   * Close the stream and publish stream.ended event.
   * Returns the assembled full content.
   */
  close(runId: string): string {
    const state = _streams.get(runId);
    if (!state) return '';

    clearTimeout(state.timeoutId);
    state.active = false;

    const content    = state.tokenBuffer.join('');
    const durationMs = Date.now() - state.startedAt;

    eventPublisher.publish(
      makeStreamEndedEvent(runId, state.projectId, state.totalTokens, durationMs),
    );

    _streams.delete(runId);
    return content;
  },

  /** Whether a stream is currently active for a run. */
  isActive(runId: string): boolean {
    return _streams.get(runId)?.active === true;
  },

  /** Current buffered content for a run (for mid-stream inspection). */
  peek(runId: string): string {
    return _streams.get(runId)?.tokenBuffer.join('') ?? '';
  },

  /** Number of active streams. */
  activeCount(): number {
    return _streams.size;
  },
};

export const streamService = streamManager;
