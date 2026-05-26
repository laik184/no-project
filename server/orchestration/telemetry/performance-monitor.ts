import { metricsCollector } from './metrics.ts';

interface ResourceSnapshot {
  timestamp: Date;
  memoryMb: number;
  uptimeSeconds: number;
  activeRuns: number;
}

interface MonitorConfig {
  intervalMs: number;
  memoryThresholdMb: number;
  onThresholdBreached?: (snapshot: ResourceSnapshot) => void;
}

const DEFAULT_CONFIG: MonitorConfig = {
  intervalMs: 15_000,
  memoryThresholdMb: 512,
};

const snapshots: ResourceSnapshot[] = [];
const MAX_SNAPSHOTS = 120;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let activeRunCount = 0;

function captureSnapshot(): ResourceSnapshot {
  const mem = process.memoryUsage();
  return {
    timestamp: new Date(),
    memoryMb: Math.round(mem.heapUsed / 1024 / 1024),
    uptimeSeconds: Math.round(process.uptime()),
    activeRuns: activeRunCount,
  };
}

export const performanceMonitor = {
  start(config: Partial<MonitorConfig> = {}): void {
    if (intervalHandle) return;
    const cfg = { ...DEFAULT_CONFIG, ...config };

    intervalHandle = setInterval(() => {
      const snap = captureSnapshot();
      if (snapshots.length >= MAX_SNAPSHOTS) snapshots.shift();
      snapshots.push(snap);

      metricsCollector.record('system', 'memory.heap', snap.memoryMb, 'MB');

      if (snap.memoryMb > cfg.memoryThresholdMb) {
        console.warn(`[perf-monitor] Memory threshold breached: ${snap.memoryMb}MB > ${cfg.memoryThresholdMb}MB`);
        cfg.onThresholdBreached?.(snap);
      }
    }, cfg.intervalMs);

    console.log(`[perf-monitor] Started — interval=${cfg.intervalMs}ms, threshold=${cfg.memoryThresholdMb}MB`);
  },

  stop(): void {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
      console.log('[perf-monitor] Stopped');
    }
  },

  trackRunStart(): void {
    activeRunCount++;
  },

  trackRunEnd(): void {
    activeRunCount = Math.max(0, activeRunCount - 1);
  },

  getLatestSnapshot(): ResourceSnapshot | null {
    return snapshots.at(-1) ?? null;
  },

  getSnapshots(count?: number): ResourceSnapshot[] {
    return count ? snapshots.slice(-count) : [...snapshots];
  },

  getActiveRuns(): number {
    return activeRunCount;
  },

  summarize(): { latestMemoryMb: number; uptimeSeconds: number; activeRuns: number; snapshotCount: number } {
    const latest = snapshots.at(-1);
    return {
      latestMemoryMb: latest?.memoryMb ?? 0,
      uptimeSeconds: Math.round(process.uptime()),
      activeRuns: activeRunCount,
      snapshotCount: snapshots.length,
    };
  },
};
