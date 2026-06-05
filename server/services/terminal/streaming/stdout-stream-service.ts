/**
 * server/services/terminal/streaming/stdout-stream-service.ts
 *
 * Collects and replays stdout lines for a terminal session.
 */

export interface StdoutChunk {
  sessionId: string;
  line:      string;
  index:     number;
  timestamp: number;
}

const _buffers = new Map<string, StdoutChunk[]>();
const MAX_LINES = 1000;

export const stdoutStreamService = {
  push(sessionId: string, line: string): StdoutChunk {
    if (!_buffers.has(sessionId)) _buffers.set(sessionId, []);
    const buf   = _buffers.get(sessionId)!;

    const chunk: StdoutChunk = {
      sessionId,
      line,
      index:     buf.length,
      timestamp: Date.now(),
    };

    buf.push(chunk);
    if (buf.length > MAX_LINES) buf.splice(0, buf.length - MAX_LINES);
    return chunk;
  },

  get(sessionId: string, limit = 200): StdoutChunk[] {
    return (_buffers.get(sessionId) ?? []).slice(-limit);
  },

  since(sessionId: string, afterIndex: number): StdoutChunk[] {
    return (_buffers.get(sessionId) ?? []).filter(c => c.index > afterIndex);
  },

  clear(sessionId: string): void {
    _buffers.delete(sessionId);
  },

  size(sessionId: string): number {
    return _buffers.get(sessionId)?.length ?? 0;
  },
};
