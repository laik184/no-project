/**
 * server/terminal/streaming/terminal-stream-broker.ts
 *
 * Fan-out broker: takes StreamFrames and pushes them to all
 * SSE connections in the pool registered for that session.
 */

import { connectionPool }  from './connection-pool.ts';
import type { StreamFrame } from '../contracts/terminal-state.ts';

export const terminalStreamBroker = {
  publish(frame: StreamFrame): void {
    const conns = connectionPool.getBySession(frame.sessionId);
    if (!conns.length) return;

    const data = `data: ${JSON.stringify(frame)}\n\n`;

    for (const conn of conns) {
      try {
        if (!conn.res.writableEnded && !conn.res.destroyed) {
          conn.res.write(data);
          (conn.res as { flushHeaders?: () => void }).flushHeaders?.();
        }
      } catch { /* connection dropped — will be pruned */ }
    }

    connectionPool.pruneDeadConnections();
  },

  publishMany(frames: StreamFrame[]): void {
    frames.forEach(f => this.publish(f));
  },

  publishLine(sessionId: string, line: string, type: StreamFrame['type']): void {
    this.publish({ type, sessionId, line, timestamp: Date.now() });
  },

  subscriberCount(sessionId: string): number {
    return connectionPool.getBySession(sessionId).length;
  },
};
