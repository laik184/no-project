/**
 * server/services/terminal/streaming/stderr-stream-service.ts
 *
 * Collects and replays stderr lines for a terminal session.
 */

export interface StderrChunk {
  sessionId: string;
  line:      string;
  index:     number;
  timestamp: number;
}

const _buffers = new Map<string, StderrChunk[]>();
const MAX_LINES = 500;

export const stderrStreamService = {
  push(sessionId: string, line: string): StderrChunk {
    if (!_buffers.has(sessionId)) _buffers.set(sessionId, []);
    const buf   = _buffers.get(sessionId)!;

    const chunk: StderrChunk = {
      sessionId,
      line,
      index:     buf.length,
      timestamp: Date.now(),
    };

    buf.push(chunk);
    if (buf.length > MAX_LINES) buf.splice(0, buf.length - MAX_LINES);
    return chunk;
  },

  get(sessionId: string, limit = 100): StderrChunk[] {
    return (_buffers.get(sessionId) ?? []).slice(-limit);
  },

  since(sessionId: string, afterIndex: number): StderrChunk[] {
    return (_buffers.get(sessionId) ?? []).filter(c => c.index > afterIndex);
  },

  clear(sessionId: string): void {
    _buffers.delete(sessionId);
  },

  size(sessionId: string): number {
    return _buffers.get(sessionId)?.length ?? 0;
  },
};
