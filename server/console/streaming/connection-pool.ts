/**
 * server/console/streaming/connection-pool.ts
 *
 * Manages active SSE response objects per project.
 * Provides project-scoped fan-out with cleanup on disconnect.
 */

import type { Response } from 'express';

export interface PooledConnection {
  readonly id:          string;
  readonly res:         Response;
  readonly projectId:   number;
  readonly sessionId:   string;
  readonly connectedAt: number;
}

let _seq = 0;

function nextId(): string {
  return `cpool-${Date.now()}-${++_seq}`;
}

class ConnectionPool {
  /** projectId → Map<connId, PooledConnection> */
  private readonly byProject = new Map<number, Map<string, PooledConnection>>();

  add(projectId: number, res: Response, sessionId: string): PooledConnection {
    const conn: PooledConnection = {
      id:          nextId(),
      res,
      projectId,
      sessionId,
      connectedAt: Date.now(),
    };

    if (!this.byProject.has(projectId)) {
      this.byProject.set(projectId, new Map());
    }
    this.byProject.get(projectId)!.set(conn.id, conn);

    return conn;
  }

  remove(connId: string): void {
    for (const [projectId, conns] of this.byProject) {
      if (conns.delete(connId)) {
        if (conns.size === 0) this.byProject.delete(projectId);
        return;
      }
    }
  }

  getByProject(projectId: number): PooledConnection[] {
    return [...(this.byProject.get(projectId)?.values() ?? [])];
  }

  get totalConnections(): number {
    let total = 0;
    for (const conns of this.byProject.values()) total += conns.size;
    return total;
  }

  get projectCount(): number {
    return this.byProject.size;
  }

  /**
   * Write a raw SSE frame to one connection.
   * Returns false if the write fails (connection gone).
   */
  write(conn: PooledConnection, frame: string): boolean {
    try {
      conn.res.write(frame);
      return true;
    } catch {
      this.remove(conn.id);
      return false;
    }
  }

  stats(): { total: number; byProject: Record<number, number> } {
    const byProject: Record<number, number> = {};
    for (const [pid, conns] of this.byProject) {
      byProject[pid] = conns.size;
    }
    return { total: this.totalConnections, byProject };
  }
}

export const connectionPool = new ConnectionPool();
