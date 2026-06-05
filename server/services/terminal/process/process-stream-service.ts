/**
 * server/services/terminal/process/process-stream-service.ts
 *
 * Attaches stdout/stderr listeners to a running ChildProcess
 * and fans out lines to registered subscriber callbacks.
 */

import { EventEmitter }                       from 'events';
import type { ChildProcess }                  from 'child_process';

export type LineHandler = (line: string, source: 'stdout' | 'stderr') => void;

export class StreamAttachError extends Error {
  constructor(message: string) {
    super(`[process-stream] ${message}`);
    this.name = 'StreamAttachError';
  }
}

interface Subscription {
  id:      string;
  handler: LineHandler;
}

const _emitters = new Map<string, EventEmitter>();
const _subs     = new Map<string, Subscription[]>();

let _counter = 0;
function nextId(): string { return `sub_${++_counter}`; }

export const processStreamService = {
  attach(sessionId: string, proc: ChildProcess): void {
    if (_emitters.has(sessionId)) return;

    const emitter = new EventEmitter();
    _emitters.set(sessionId, emitter);
    _subs.set(sessionId, []);

    const emit = (src: 'stdout' | 'stderr') => (chunk: Buffer) => {
      chunk.toString().split('\n').filter(Boolean).forEach(line => {
        emitter.emit('line', line, src);
      });
    };

    proc.stdout?.on('data', emit('stdout'));
    proc.stderr?.on('data', emit('stderr'));

    proc.on('close', () => { this.detach(sessionId); });

    emitter.on('line', (line: string, src: 'stdout' | 'stderr') => {
      (_subs.get(sessionId) ?? []).forEach(s => s.handler(line, src));
    });
  },

  subscribe(sessionId: string, handler: LineHandler): string {
    const id   = nextId();
    const subs = _subs.get(sessionId);
    if (!subs) throw new StreamAttachError(`No stream attached for session "${sessionId}".`);
    subs.push({ id, handler });
    return id;
  },

  unsubscribe(sessionId: string, subId: string): boolean {
    const subs = _subs.get(sessionId);
    if (!subs) return false;
    const idx = subs.findIndex(s => s.id === subId);
    if (idx === -1) return false;
    subs.splice(idx, 1);
    return true;
  },

  detach(sessionId: string): void {
    _emitters.get(sessionId)?.removeAllListeners();
    _emitters.delete(sessionId);
    _subs.delete(sessionId);
  },

  isAttached(sessionId: string): boolean {
    return _emitters.has(sessionId);
  },
};
