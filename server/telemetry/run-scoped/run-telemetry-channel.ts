/**
 * server/telemetry/run-scoped/run-telemetry-channel.ts
 *
 * RunTelemetryChannel — isolated telemetry buffer and SSE stream for one run.
 *
 * Responsibilities:
 *   - Buffer all telemetry events for a single runId
 *   - Support multiple SSE subscriber connections per run
 *   - Replay buffer to late subscribers
 *   - Enforce max buffer size to prevent memory growth
 *   - Expose typed event emission API
 *
 * Single responsibility: one run's telemetry stream. No cross-run logic.
 */

import type { Response } from "express";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TelemetryEvent {
  readonly id:        string;
  readonly runId:     string;
  readonly projectId: number;
  readonly eventType: string;
  readonly phase:     string;
  readonly payload:   unknown;
  readonly ts:        number;
}

export interface ChannelStats {
  runId:        string;
  projectId:    number;
  buffered:     number;
  subscribers:  number;
  createdAt:    number;
  lastEventAt:  number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_BUFFER   = 500;
const HEARTBEAT_MS = 15_000;

// ── Channel ───────────────────────────────────────────────────────────────────

export class RunTelemetryChannel {
  private readonly runId:     string;
  private readonly projectId: number;
  private readonly createdAt: number;
  private readonly buffer:    TelemetryEvent[]  = [];
  private readonly sseClients: Set<Response>    = new Set();
  private heartbeat: NodeJS.Timeout | null       = null;
  private lastEventAt: number | null             = null;
  private seq = 0;

  constructor(runId: string, projectId: number) {
    this.runId     = runId;
    this.projectId = projectId;
    this.createdAt = Date.now();
    this._startHeartbeat();
  }

  // ── Event emission ──────────────────────────────────────────────────────────

  emit(eventType: string, phase: string, payload: unknown): TelemetryEvent {
    const event: TelemetryEvent = {
      id:        `${this.runId}:${++this.seq}`,
      runId:     this.runId,
      projectId: this.projectId,
      eventType,
      phase,
      payload,
      ts: Date.now(),
    };

    // Ring buffer: drop oldest if full
    if (this.buffer.length >= MAX_BUFFER) this.buffer.shift();
    this.buffer.push(event);
    this.lastEventAt = event.ts;

    this._broadcastSSE(event);
    return event;
  }

  // ── SSE subscriber management ───────────────────────────────────────────────

  attachSSE(res: Response, replaySince = 0): void {
    res.setHeader("Content-Type",  "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection",    "keep-alive");
    res.setHeader("X-Run-Id",      this.runId);
    res.flushHeaders?.();

    // Replay missed events
    const missed = replaySince > 0
      ? this.buffer.filter(e => e.ts >= replaySince)
      : this.buffer;
    for (const e of missed) this._writeSSE(res, e);

    this.sseClients.add(res);
    res.on("close", () => this.sseClients.delete(res));
  }

  // ── Read API ────────────────────────────────────────────────────────────────

  getBuffer(sinceTs = 0): TelemetryEvent[] {
    return sinceTs > 0 ? this.buffer.filter(e => e.ts >= sinceTs) : [...this.buffer];
  }

  stats(): ChannelStats {
    return {
      runId:       this.runId,
      projectId:   this.projectId,
      buffered:    this.buffer.length,
      subscribers: this.sseClients.size,
      createdAt:   this.createdAt,
      lastEventAt: this.lastEventAt,
    };
  }

  // ── Teardown ────────────────────────────────────────────────────────────────

  destroy(): void {
    this._stopHeartbeat();
    for (const res of this.sseClients) {
      try { res.end(); } catch {}
    }
    this.sseClients.clear();
    this.buffer.length = 0;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private _broadcastSSE(event: TelemetryEvent): void {
    for (const res of this.sseClients) {
      try { this._writeSSE(res, event); } catch { this.sseClients.delete(res); }
    }
  }

  private _writeSSE(res: Response, event: TelemetryEvent): void {
    res.write(`id: ${event.id}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event)}\n\n`);
  }

  private _startHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      const ping = `event: ping\ndata: ${JSON.stringify({ runId: this.runId, ts: Date.now() })}\n\n`;
      for (const res of this.sseClients) {
        try { res.write(ping); } catch { this.sseClients.delete(res); }
      }
    }, HEARTBEAT_MS);
    this.heartbeat.unref?.();
  }

  private _stopHeartbeat(): void {
    if (this.heartbeat) { clearInterval(this.heartbeat); this.heartbeat = null; }
  }
}
