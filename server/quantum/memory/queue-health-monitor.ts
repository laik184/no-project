/**
 * queue-health-monitor.ts
 *
 * Monitors all queue lanes for stalls, high failure rates, and depth spikes.
 * Runs a periodic health scan and emits telemetry on degraded lanes.
 *
 * Single responsibility: health observation only — no write execution.
 */

import type { QueueLaneManager } from "./queue-core.ts";
import { memoryTelemetryBridge }  from "./memory-telemetry-bridge.ts";
import type { QueueHealthSnapshot, LaneHealth } from "./queue.types.ts";

// ── Config ────────────────────────────────────────────────────────────────────

interface MonitorConfig {
  scanIntervalMs:  number;
  stallThresholdMs: number;   // lane considered stalled if active > this with no progress
  highFailureRate: number;    // 0–1 fraction of failures that triggers alert
  idleEvictMs:     number;    // evict idle lanes after this duration
}

const DEFAULT_CONFIG: MonitorConfig = {
  scanIntervalMs:   30_000,
  stallThresholdMs: 60_000,
  highFailureRate:  0.3,
  idleEvictMs:      10 * 60_000,
};

// ── Monitor ───────────────────────────────────────────────────────────────────

export class QueueHealthMonitor {
  private _interval:  ReturnType<typeof setInterval> | null = null;
  private _laneManager: QueueLaneManager | null             = null;
  private _config:    MonitorConfig;
  private _lastSnapshot: QueueHealthSnapshot | null         = null;

  constructor(config: Partial<MonitorConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Wire the monitor to a lane manager instance (called once at startup). */
  attach(laneManager: QueueLaneManager): void {
    this._laneManager = laneManager;
  }

  start(): void {
    if (this._interval) return;
    this._interval = setInterval(() => this._scan(), this._config.scanIntervalMs);
    // Unref so monitor doesn't prevent process exit
    if (typeof this._interval.unref === "function") this._interval.unref();
  }

  stop(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  /** Force an immediate scan and return the snapshot. */
  scan(): QueueHealthSnapshot {
    return this._scan();
  }

  lastSnapshot(): QueueHealthSnapshot | null {
    return this._lastSnapshot;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private _scan(): QueueHealthSnapshot {
    const now = Date.now();

    if (!this._laneManager) {
      const empty: QueueHealthSnapshot = {
        timestamp: now, totalLanes: 0, activeLanes: 0, stalledLanes: 0, totalPending: 0, lanes: [],
      };
      this._lastSnapshot = empty;
      return empty;
    }

    const allStats = this._laneManager.allStats();
    const lanes: LaneHealth[] = allStats.map(s => {
      const stalledMs   = s.active ? now - s.lastActivityTs : 0;
      const total       = s.processedTotal + s.failedTotal;
      const failureRate = total > 0 ? s.failedTotal / total : 0;
      const isStalled   = s.active && stalledMs > this._config.stallThresholdMs;
      const isHealthy   = !isStalled && failureRate < this._config.highFailureRate;

      return {
        queueKey:    s.queueKey,
        depth:       s.depth,
        active:      s.active,
        stalledMs,
        failureRate,
        isHealthy,
      };
    });

    const snapshot: QueueHealthSnapshot = {
      timestamp:    now,
      totalLanes:   lanes.length,
      activeLanes:  lanes.filter(l => l.active).length,
      stalledLanes: lanes.filter(l => l.stalledMs > this._config.stallThresholdMs).length,
      totalPending: lanes.reduce((sum, l) => sum + l.depth, 0),
      lanes,
    };

    this._lastSnapshot = snapshot;

    // Emit telemetry for unhealthy lanes
    for (const lane of lanes) {
      if (!lane.isHealthy) {
        memoryTelemetryBridge.emit({
          event:     "queue.backpressure",
          requestId: "health-monitor",
          queueKey:  String(lane.queueKey),
          meta: {
            stalledMs:   lane.stalledMs,
            failureRate: lane.failureRate,
            depth:       lane.depth,
          },
        });
      }
    }

    // Evict idle lanes
    this._laneManager.evictIdle(this._config.idleEvictMs);

    return snapshot;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const queueHealthMonitor = new QueueHealthMonitor();
