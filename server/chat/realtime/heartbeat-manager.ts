import { SSE_HEARTBEAT_MS } from '../constants/stream.constants.ts';

interface HeartbeatEntry {
  connId:      string;
  projectId:   number;
  lastPingAt:  Date;
  missedPings: number;
}

const MAX_MISSED_PINGS = 3;
const _entries = new Map<string, HeartbeatEntry>();
let _interval: ReturnType<typeof setInterval> | null = null;

export const heartbeatManager = {
  start(): void {
    if (_interval) return;
    _interval = setInterval(() => {
      const now = new Date();
      for (const [id, entry] of _entries) {
        const elapsed = now.getTime() - entry.lastPingAt.getTime();
        if (elapsed > SSE_HEARTBEAT_MS * 1.5) {
          entry.missedPings++;
          if (entry.missedPings >= MAX_MISSED_PINGS) {
            console.warn(`[heartbeat] Stale connection ${id} (project ${entry.projectId}) — ${entry.missedPings} missed pings`);
          }
        }
      }
    }, SSE_HEARTBEAT_MS);
  },

  stop(): void {
    if (_interval) { clearInterval(_interval); _interval = null; }
  },

  register(connId: string, projectId: number): void {
    _entries.set(connId, { connId, projectId, lastPingAt: new Date(), missedPings: 0 });
  },

  unregister(connId: string): void {
    _entries.delete(connId);
  },

  recordPing(connId: string): void {
    const entry = _entries.get(connId);
    if (entry) { entry.lastPingAt = new Date(); entry.missedPings = 0; }
  },

  size(): number { return _entries.size; },
};
