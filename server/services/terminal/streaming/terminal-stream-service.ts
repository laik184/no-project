/**
 * server/services/terminal/streaming/terminal-stream-service.ts
 *
 * Coordinator that routes stdout/stderr lines from a ChildProcess
 * into the separate stdout/stderr stream buffers and fan-out subscribers.
 */

import type { ChildProcess }    from 'child_process';
import { stdoutStreamService }  from './stdout-stream-service.ts';
import { stderrStreamService }  from './stderr-stream-service.ts';

export type StreamSource = 'stdout' | 'stderr';

export interface StreamLine {
  sessionId: string;
  source:    StreamSource;
  line:      string;
  index:     number;
  timestamp: number;
}

export class StreamServiceError extends Error {
  constructor(message: string) {
    super(`[terminal-stream] ${message}`);
    this.name = 'StreamServiceError';
  }
}

type LineCallback = (entry: StreamLine) => void;

const _subscribers = new Map<string, LineCallback[]>();

export const terminalStreamService = {
  attach(sessionId: string, proc: ChildProcess): void {
    if (!_subscribers.has(sessionId)) _subscribers.set(sessionId, []);

    const handle = (src: StreamSource) => (chunk: Buffer) => {
      chunk.toString().split('\n').filter(Boolean).forEach(line => {
        const stored = src === 'stdout'
          ? stdoutStreamService.push(sessionId, line)
          : stderrStreamService.push(sessionId, line);

        const entry: StreamLine = { sessionId, source: src, line, index: stored.index, timestamp: stored.timestamp };
        (_subscribers.get(sessionId) ?? []).forEach(cb => cb(entry));
      });
    };

    proc.stdout?.on('data', handle('stdout'));
    proc.stderr?.on('data', handle('stderr'));
    proc.on('close', () => this.detach(sessionId));
  },

  subscribe(sessionId: string, callback: LineCallback): () => void {
    if (!_subscribers.has(sessionId)) _subscribers.set(sessionId, []);
    _subscribers.get(sessionId)!.push(callback);
    return () => {
      const subs = _subscribers.get(sessionId);
      if (subs) {
        const idx = subs.indexOf(callback);
        if (idx !== -1) subs.splice(idx, 1);
      }
    };
  },

  detach(sessionId: string): void {
    _subscribers.delete(sessionId);
    stdoutStreamService.clear(sessionId);
    stderrStreamService.clear(sessionId);
  },

  getStdout(sessionId: string, limit = 200) {
    return stdoutStreamService.get(sessionId, limit);
  },

  getStderr(sessionId: string, limit = 100) {
    return stderrStreamService.get(sessionId, limit);
  },

  getMerged(sessionId: string, limit = 200): StreamLine[] {
    const out = stdoutStreamService.get(sessionId).map(c => ({
      sessionId, source: 'stdout' as StreamSource, line: c.line, index: c.index, timestamp: c.timestamp,
    }));
    const err = stderrStreamService.get(sessionId).map(c => ({
      sessionId, source: 'stderr' as StreamSource, line: c.line, index: c.index, timestamp: c.timestamp,
    }));
    return [...out, ...err]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);
  },
};
