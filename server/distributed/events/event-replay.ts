/**
 * Responsibility: Replay-safe event buffer — stores recent replayable events
 *                 in a circular buffer so late subscribers can catch up.
 * Dependencies: none
 * Failure: buffer overflow silently drops oldest events; never throws.
 * Telemetry: none — pure buffer management.
 */

import type { DistributedEvent } from "./types/index.ts";

const MAX_BUFFER_SIZE = 1_000;
const DEFAULT_REPLAY_WINDOW_MS = 5 * 60 * 1_000; // 5 min

class EventReplay {
  private readonly buffer: DistributedEvent[] = [];

  record(event: DistributedEvent): void {
    if (!event.replayable) return;
    if (this.buffer.length >= MAX_BUFFER_SIZE) this.buffer.shift();
    this.buffer.push(event);
  }

  /** Return events for a channel since a given timestamp. */
  since(channel: string, sinceTs: number): DistributedEvent[] {
    const windowStart = sinceTs - DEFAULT_REPLAY_WINDOW_MS;
    return this.buffer.filter(e =>
      e.channel === channel && e.ts >= windowStart && e.ts >= sinceTs,
    );
  }

  /** Return the last N events for a channel. */
  last(channel: string, n: number): DistributedEvent[] {
    return this.buffer
      .filter(e => e.channel === channel)
      .slice(-n);
  }

  /** Evict events older than the window. */
  evictExpired(): number {
    const cutoff = Date.now() - DEFAULT_REPLAY_WINDOW_MS;
    const before = this.buffer.length;
    while (this.buffer.length > 0 && this.buffer[0].ts < cutoff) this.buffer.shift();
    return before - this.buffer.length;
  }

  size(): number { return this.buffer.length; }
  clear(): void  { this.buffer.length = 0; }
}

export const eventReplay = new EventReplay();
