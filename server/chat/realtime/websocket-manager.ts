/**
 * websocket-manager.ts — Chat WebSocket facade.
 *
 * The primary WebSocket server is owned by infrastructure (/ws/terminal).
 * This module provides a typed abstraction for chat-specific WS events
 * (e.g., presence pings, typing indicators) sent over the existing WS server.
 *
 * Currently: typing-indicator broadcast only.
 * Extend here as chat-specific WS needs grow.
 */
import type { WebSocket } from 'ws';
import { WS_PING_INTERVAL_MS } from '../constants/stream.constants.ts';

interface TypingPayload {
  type:      'chat.typing';
  projectId: number;
  runId?:    string;
  isTyping:  boolean;
}

/** Registry of WS clients per projectId for chat broadcast. */
const _clients = new Map<number, Set<WebSocket>>();

export const websocketManager = {
  /** Register a WS client for a project (called from ws route handler). */
  register(projectId: number, ws: WebSocket): void {
    if (!_clients.has(projectId)) _clients.set(projectId, new Set());
    _clients.get(projectId)!.add(ws);

    ws.on('close', () => {
      _clients.get(projectId)?.delete(ws);
    });

    ws.on('error', () => {
      _clients.get(projectId)?.delete(ws);
    });
  },

  /** Broadcast a typing indicator to all WS clients for a project. */
  broadcastTyping(projectId: number, isTyping: boolean, runId?: string): void {
    const clients = _clients.get(projectId);
    if (!clients || clients.size === 0) return;

    const payload: TypingPayload = {
      type:      'chat.typing',
      projectId,
      runId,
      isTyping,
    };
    const data = JSON.stringify(payload);

    for (const ws of clients) {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(data, (err) => {
          if (err) _clients.get(projectId)?.delete(ws);
        });
      }
    }
  },

  /** Connection count for a project (diagnostics). */
  connectionCount(projectId: number): number {
    return _clients.get(projectId)?.size ?? 0;
  },

  /** Global WS client count (diagnostics). */
  totalConnections(): number {
    let total = 0;
    for (const set of _clients.values()) total += set.size;
    return total;
  },
};

export { WS_PING_INTERVAL_MS };
