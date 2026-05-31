/**
 * server/infrastructure/events/sse/sse-manager.ts
 *
 * Infrastructure SSE connection pool.
 * Manages SSE connections across all topics, projects, and runs.
 * The chat module delegates to this for actual SSE fan-out.
 *
 * API:
 *   register(res, topics, projectId, runId?)  → cleanup fn
 *   publish(topic, event, filter?)            → broadcast to matching connections
 *   connectionCount                           → number of open connections
 *   stats()                                   → topic distribution snapshot
 */
import type { Response } from 'express';
import { bus }   from '../bus.ts';
import { TOPIC } from '../../realtime/stream-topics.ts';

// ── Connection record ─────────────────────────────────────────────────────────

interface SseConnection {
  readonly id:        string;
  readonly res:       Response;
  readonly topics:    ReadonlySet<string>;
  readonly projectId: number | null;
  readonly runId:     string | undefined;
  readonly connectedAt: number;
}

// ── Internal store ─────────────────────────────────────────────────────────────

const connections = new Map<string, SseConnection>();
let   _seq = 0;

function nextId(): string {
  return `sse-${Date.now()}-${++_seq}`;
}

// ── Fan-out from bus ──────────────────────────────────────────────────────────

bus.on('agent.event', (payload) => {
  const projectId = (payload as Record<string, unknown>).projectId as number | undefined;
  const runId     = (payload as Record<string, unknown>).runId     as string | undefined;
  broadcastToTopic(TOPIC.AGENT, payload, projectId ?? null, runId);
});

bus.on('run.lifecycle', (payload) => {
  const projectId = (payload as Record<string, unknown>).projectId as number | undefined;
  const runId     = (payload as Record<string, unknown>).runId     as string | undefined;
  broadcastToTopic(TOPIC.LIFECYCLE, payload, projectId ?? null, runId);
});

bus.on(TOPIC.CHECKPOINT, (payload) => {
  const projectId = (payload as Record<string, unknown>).projectId as number | undefined;
  broadcastToTopic(TOPIC.CHECKPOINT, payload, projectId ?? null, undefined);
});

// ── Internal broadcast ────────────────────────────────────────────────────────

function broadcastToTopic(
  topic:     string,
  payload:   unknown,
  projectId: number | null,
  runId:     string | undefined,
): void {
  // Named SSE event so addEventListener(topic, cb) fires on the client.
  // Format: "event: <topic>\ndata: <json>\n\n"
  const data = `event: ${topic}\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const conn of connections.values()) {
    if (!conn.topics.has(topic)) continue;
    if (projectId !== null && conn.projectId !== null && conn.projectId !== projectId) continue;
    if (runId && conn.runId && conn.runId !== runId) continue;

    try {
      conn.res.write(data);
    } catch {
      connections.delete(conn.id);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const sseManager = {
  /**
   * Register an SSE connection.
   * Returns a cleanup function — call on request close.
   */
  register(
    res:       Response,
    topics:    ReadonlySet<string>,
    projectId: number | null,
    runId?:    string,
  ): () => void {
    const id   = nextId();
    const conn: SseConnection = { id, res, topics, projectId, runId, connectedAt: Date.now() };
    connections.set(id, conn);

    // Send initial keep-alive comment
    try { res.write(': connected\n\n'); } catch { /* ignore */ }

    return () => {
      connections.delete(id);
    };
  },

  /**
   * Manually publish an event to a topic (bypass bus if needed).
   */
  publish(
    topic:     string,
    payload:   unknown,
    projectId: number | null = null,
    runId?:    string,
  ): void {
    broadcastToTopic(topic, payload, projectId, runId);
  },

  get connectionCount(): number {
    return connections.size;
  },

  stats(): { total: number; byTopic: Record<string, number> } {
    const byTopic: Record<string, number> = {};

    for (const conn of connections.values()) {
      for (const topic of conn.topics) {
        byTopic[topic] = (byTopic[topic] ?? 0) + 1;
      }
    }

    return { total: connections.size, byTopic };
  },
};
