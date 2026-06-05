/**
 * server/terminal/streaming/terminal-sse-manager.ts
 *
 * Manages the lifecycle of SSE connections for terminal sessions.
 * Sets headers, registers in the pool, and cleans up on client disconnect.
 */

import type { Request, Response } from 'express';
import { connectionPool }         from './connection-pool.ts';
import { makeSystemFrame }        from '../events/terminal-events.ts';
import { terminalStreamBroker }   from './terminal-stream-broker.ts';

export const terminalSseManager = {
  attach(req: Request, res: Response, sessionId: string): () => void {
    res.writeHead(200, {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    (res as { flushHeaders?: () => void }).flushHeaders?.();

    const conn = connectionPool.add(sessionId, res);

    // Send immediate "connected" frame so client knows the pipe is open.
    const frame = makeSystemFrame(sessionId, `connected:${conn.id}`);
    res.write(`data: ${JSON.stringify(frame)}\n\n`);

    const cleanup = () => {
      connectionPool.remove(conn.id);
    };

    req.on('close',   cleanup);
    req.on('error',   cleanup);
    res.on('finish',  cleanup);
    res.on('error',   cleanup);

    return cleanup;
  },

  broadcast(sessionId: string, line: string, type: 'stdout' | 'stderr' | 'system' | 'error'): void {
    terminalStreamBroker.publishLine(sessionId, line, type);
  },

  connectionCount(sessionId?: string): number {
    return sessionId
      ? connectionPool.getBySession(sessionId).length
      : connectionPool.size();
  },
};
