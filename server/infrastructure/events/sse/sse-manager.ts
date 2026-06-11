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
  readonly heartbeat: ReturnType<typeof setInterval>;
}

interface SseHistoryEntry {
  readonly id:        number;
  readonly topic:     string;
  readonly payload:   unknown;
  readonly projectId: number | null;
  readonly runId:     string | undefined;
}


// ── Internal store ─────────────────────────────────────────────────────────────

const connections = new Map<string, SseConnection>();
const history: SseHistoryEntry[] = [];
const MAX_HISTORY = 1_000;
const HEARTBEAT_MS = 15_000;
let   _seq = 0;
let   _eventSeq = 0;

function nextId(): string {
  return `sse-${Date.now()}-${++_seq}`;
}

function nextEventId(): number {
  return ++_eventSeq;
}

function remember(entry: SseHistoryEntry): void {
  history.push(entry);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
}

function matchesConnection(conn: SseConnection, topic: string, projectId: number | null, runId: string | undefined): boolean {
  if (!conn.topics.has(topic)) return false;
  if (projectId !== null && conn.projectId !== null && conn.projectId !== projectId) return false;
  if (runId && conn.runId && conn.runId !== runId) return false;
  return true;
}

function formatSse(entry: SseHistoryEntry): string {
  return `id: ${entry.id}\nevent: ${entry.topic}\ndata: ${JSON.stringify(entry.payload)}\n\n`;
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
  const entry: SseHistoryEntry = { id: nextEventId(), topic, payload, projectId, runId };
  remember(entry);
  const data = formatSse(entry);

  for (const conn of connections.values()) {
    if (!matchesConnection(conn, topic, projectId, runId)) continue;

    try {
      conn.res.write(data);
    } catch {
      clearInterval(conn.heartbeat);
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
    lastEventId?: string | number | null,
  ): () => void {
    const id = nextId();
    const heartbeat = setInterval(() => {
      try { res.write(`: heartbeat ${Date.now()}\n\n`); } catch {
        clearInterval(heartbeat);
        connections.delete(id);
      }
    }, HEARTBEAT_MS);

    const conn: SseConnection = { id, res, topics, projectId, runId, connectedAt: Date.now(), heartbeat };
    connections.set(id, conn);

    try {
      res.write(`: connected ${id}\n\n`);
      const lastSeen = Number(lastEventId ?? 0);
      if (Number.isFinite(lastSeen) && lastSeen > 0) {
        for (const entry of history) {
          if (entry.id <= lastSeen) continue;
          if (!matchesConnection(conn, entry.topic, entry.projectId, entry.runId)) continue;
          res.write(formatSse(entry));
        }
      }
    } catch {
      clearInterval(heartbeat);
      connections.delete(id);
    }

    return () => {
      clearInterval(heartbeat);
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
