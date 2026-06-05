/**
 * server/console/streaming/stream-broker.ts
 *
 * Routes console events from the bus to active SSE connections.
 * Handles: project-scoped fan-out, heartbeats, and reconnect support.
 */

import type { Response } from 'express';
import { connectionPool } from './connection-pool.ts';
import { onLogLine, onRuntimeState } from '../events/console-events.ts';
import { sessionRepository } from '../../repositories/console/session-repository.ts';
import type { LogLine, RuntimeStateEvent } from '../types/index.ts';

const HEARTBEAT_INTERVAL_MS = 20_000;

// ── SSE frame helpers ──────────────────────────────────────────────────────────

function sseFrame(eventName: string, data: unknown): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Publish to a project ───────────────────────────────────────────────────────

function publishToProject(projectId: number, frame: string): void {
  for (const conn of connectionPool.getByProject(projectId)) {
    const ok = connectionPool.write(conn, frame);
    if (!ok) {
      sessionRepository.delete(conn.sessionId);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Register a new SSE client for a project.
 * Returns a cleanup function — call it on request close.
 */
export function registerConnection(
  projectId: number,
  res:       Response,
  sessionId: string,
): () => void {
  const conn = connectionPool.add(projectId, res, sessionId);

  // Send `connected` event immediately
  connectionPool.write(conn, sseFrame('connected', {}));

  // Heartbeat to keep the TCP connection alive through proxies
  const hb = setInterval(() => {
    const ok = connectionPool.write(conn, ': heartbeat\n\n');
    if (!ok) {
      sessionRepository.update(sessionId, { closed: true });
      clearInterval(hb);
    } else {
      sessionRepository.update(sessionId, { lastHeartbeat: Date.now() });
    }
  }, HEARTBEAT_INTERVAL_MS);

  return () => {
    clearInterval(hb);
    connectionPool.remove(conn.id);
    sessionRepository.delete(sessionId);
  };
}

/**
 * Publish a log line to all clients subscribed to the given project.
 */
export function publishLogLine(projectId: number, log: LogLine): void {
  publishToProject(projectId, sseFrame('console', log));
}

/**
 * Publish a runtime state change to all clients subscribed to the given project.
 */
export function publishRuntimeState(
  projectId: number,
  event:     RuntimeStateEvent,
): void {
  publishToProject(projectId, sseFrame('runtime.state', event));
}

// ── Wire bus events to SSE connections ────────────────────────────────────────

let _initialized = false;

export function initStreamBroker(): void {
  if (_initialized) return;
  _initialized = true;

  onLogLine((projectId, log) => publishLogLine(projectId, log));
  onRuntimeState((projectId, event) => publishRuntimeState(projectId, event));
}

export function streamBrokerStats() {
  return connectionPool.stats();
}
