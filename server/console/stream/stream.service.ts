/**
 * IQ 2000 — Console · Stream Service
 *
 * Manages SSE connections from browser clients.
 * Each client subscribes to a specific projectId; the orchestrator
 * calls broadcast() for every ConsoleLine — including structured meta.
 */

import { randomUUID } from 'crypto';
import type { Response } from 'express';
import type { ConsoleLine, SseClient, StreamSnapshot } from '../types.ts';

class StreamService {
  private clients = new Map<string, SseClient>();

  // ─── Client lifecycle ──────────────────────────────────────────────────

  addClient(projectId: number, res: Response): string {
    const id = randomUUID();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const client: SseClient = { id, projectId, res, connectedAt: new Date() };
    this.clients.set(id, client);

    this.sendToClient(client, { type: 'connected', clientId: id, projectId });
    return id;
  }

  removeClient(id: string): void {
    this.clients.delete(id);
  }

  // ─── Broadcasting ──────────────────────────────────────────────────────

  /**
   * Push a ConsoleLine (with optional meta) to all SSE clients watching
   * the same projectId. Meta is included so the frontend can render
   * install progress, runtime states, error badges, etc.
   */
  broadcast(line: ConsoleLine): void {
    const payload: Record<string, unknown> = {
      type:   'console',
      id:     line.id,
      kind:   line.kind,
      stream: line.kind === 'stderr' || line.kind === 'error' ? 'stderr' : 'stdout',
      line:   line.text,
      ts:     line.ts.toISOString(),
    };

    // Attach parsed meta when present so frontend can react to it
    if (line.meta && Object.keys(line.meta).length > 0) {
      payload['meta'] = line.meta;
    }

    for (const client of this.clients.values()) {
      if (client.projectId === line.projectId) {
        this.sendToClient(client, payload);
      }
    }
  }

  /**
   * Push a runtime state change event to all clients watching a project.
   * Called by runtimeStates when a transition occurs.
   */
  broadcastState(projectId: number, state: string, prev: string, message: string): void {
    const payload = { type: 'runtime.state', state, prev, message, ts: new Date().toISOString() };
    for (const client of this.clients.values()) {
      if (client.projectId === projectId) {
        this.sendToClient(client, payload);
      }
    }
  }

  /**
   * Send a raw system notification to all clients of a project.
   */
  notify(projectId: number, message: string): void {
    const line: ConsoleLine = {
      id:        `notify-${Date.now()}`,
      projectId,
      kind:      'system',
      text:      message,
      ts:        new Date(),
    };
    this.broadcast(line);
  }

  getSnapshot(): StreamSnapshot {
    return {
      clientCount: this.clients.size,
      clients: [...this.clients.values()].map(({ id, projectId, connectedAt }) => ({
        id, projectId, connectedAt,
      })),
    };
  }

  dispose(): void {
    for (const client of this.clients.values()) {
      try { client.res.end(); } catch {}
    }
    this.clients.clear();
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private sendToClient(client: SseClient, data: Record<string, unknown>): void {
    try {
      const event = data['type'] as string;
      client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.clients.delete(client.id);
    }
  }
}

export const streamService = new StreamService();
