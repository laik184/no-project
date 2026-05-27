import { recordEvent, getEvents, clearEvents } from '../telemetry-collector.ts';
import type { Response } from 'express';

export interface RunScopedTelemetry {
  record(type: string, payload: unknown): void;
  getAll(): unknown[];
  clear(): void;
}

export function createRunScopedTelemetry(runId: string): RunScopedTelemetry {
  return {
    record(type: string, payload: unknown): void {
      recordEvent({ runId, type, payload, ts: Date.now() });
    },
    getAll(): unknown[] {
      return getEvents(runId);
    },
    clear(): void {
      clearEvents(runId);
    },
  };
}

export { recordEvent, getEvents, clearEvents };

// ── SSE channel infrastructure ────────────────────────────────────────────────

interface Channel {
  id:          string;
  clients:     Set<Response>;
  buffer:      unknown[];
  createdAt:   number;
}

const channels = new Map<string, Channel>();

export function getOrCreateChannel(id: string): Channel {
  if (!channels.has(id)) {
    channels.set(id, { id, clients: new Set(), buffer: [], createdAt: Date.now() });
  }
  return channels.get(id)!;
}

export function getBuffer(id: string): unknown[] {
  return channels.get(id)?.buffer ?? [];
}

export function attachSSE(id: string, res: Response): void {
  const channel = getOrCreateChannel(id);
  channel.clients.add(res);

  res.on('close', () => {
    channel.clients.delete(res);
    if (channel.clients.size === 0) {
      channels.delete(id);
    }
  });

  for (const event of channel.buffer) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

export function broadcastToChannel(id: string, event: unknown): void {
  const channel = channels.get(id);
  if (!channel) return;

  channel.buffer.push(event);
  if (channel.buffer.length > 500) channel.buffer.shift();

  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of channel.clients) {
    try { client.write(payload); } catch { channel.clients.delete(client); }
  }
}

export interface ChannelStats {
  id:      string;
  clients: number;
  buffered: number;
}

export function allChannelStats(): ChannelStats[] {
  return [...channels.values()].map(ch => ({
    id:       ch.id,
    clients:  ch.clients.size,
    buffered: ch.buffer.length,
  }));
}
