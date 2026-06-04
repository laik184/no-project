import type { WebSocket } from 'ws';
import { WS_PING_INTERVAL_MS } from '../constants/stream.constants.ts';

interface TypingPayload {
  type:      'chat.typing';
  projectId: number;
  runId?:    string;
  isTyping:  boolean;
}

const _clients = new Map<number, Set<WebSocket>>();
let _pingInterval: ReturnType<typeof setInterval> | null = null;

export const websocketManager = {
  initialize(_server: unknown): void {
    if (_pingInterval) return;
    _pingInterval = setInterval(() => {
      for (const sockets of _clients.values()) {
        for (const ws of sockets) {
          if ((ws as any).readyState === 1) {
            try { ws.ping(); } catch { /* ignore */ }
          }
        }
      }
    }, WS_PING_INTERVAL_MS);
  },

  stop(): void {
    if (_pingInterval) { clearInterval(_pingInterval); _pingInterval = null; }
  },

  register(projectId: number, ws: WebSocket): void {
    if (!_clients.has(projectId)) _clients.set(projectId, new Set());
    _clients.get(projectId)!.add(ws);
    ws.on('close', () => {
      _clients.get(projectId)?.delete(ws);
      if (_clients.get(projectId)?.size === 0) _clients.delete(projectId);
    });
  },

  sendTyping(projectId: number, runId: string | undefined, isTyping: boolean): void {
    const payload: TypingPayload = { type: 'chat.typing', projectId, runId, isTyping };
    this.broadcast(projectId, payload);
  },

  broadcast(projectId: number, payload: unknown): void {
    const sockets = _clients.get(projectId);
    if (!sockets) return;
    const data = JSON.stringify(payload);
    for (const ws of sockets) {
      if ((ws as any).readyState === 1) {
        try { ws.send(data); } catch { /* ignore */ }
      }
    }
  },
};
