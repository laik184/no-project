/**
 * server/terminal/streaming/connection-pool.ts
 *
 * Registry of active SSE Response objects keyed by connection ID.
 */

import type { Response } from 'express';
import { randomBytes }  from 'crypto';

export interface PooledConnection {
  id:        string;
  sessionId: string;
  res:       Response;
  openedAt:  number;
}

const _pool = new Map<string, PooledConnection>();

function genId(): string {
  return `conn_${randomBytes(4).toString('hex')}`;
}

export const connectionPool = {
  add(sessionId: string, res: Response): PooledConnection {
    const conn: PooledConnection = {
      id:        genId(),
      sessionId,
      res,
      openedAt:  Date.now(),
    };
    _pool.set(conn.id, conn);
    return conn;
  },

  remove(connId: string): boolean {
    return _pool.delete(connId);
  },

  getBySession(sessionId: string): PooledConnection[] {
    return [..._pool.values()].filter(c => c.sessionId === sessionId);
  },

  all(): PooledConnection[] {
    return [..._pool.values()];
  },

  size(): number { return _pool.size; },

  pruneDeadConnections(): number {
    let pruned = 0;
    for (const [id, conn] of _pool) {
      if (conn.res.writableEnded || conn.res.destroyed) {
        _pool.delete(id);
        pruned++;
      }
    }
    return pruned;
  },
};
