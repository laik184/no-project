import { runLogger } from '../telemetry/run-logger.ts';

interface FabricConfig {
  maxConcurrentRuns: number;
  capacityCheckIntervalMs: number;
}

const DEFAULT_CONFIG: FabricConfig = {
  maxConcurrentRuns: 3,
  capacityCheckIntervalMs: 5_000,
};

interface FabricStats {
  activeRuns: number;
  maxConcurrentRuns: number;
  capacityPct: number;
  running: boolean;
}

class ParallelOrchestrationFabric {
  private config: FabricConfig = DEFAULT_CONFIG;
  private running = false;
  private activeRuns = new Set<string>();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  start(config: Partial<FabricConfig> = {}): void {
    if (this.running) return;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.running = true;

    this.intervalHandle = setInterval(() => {
      const capacity = this.getCapacityPct();
      if (capacity > 80) {
        runLogger.log('system', 'warn', `[parallel-fabric] Capacity at ${capacity}% — throttling new runs`);
      }
    }, this.config.capacityCheckIntervalMs);

    console.log(`[parallel-fabric] Started — maxConcurrentRuns=${this.config.maxConcurrentRuns}`);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    console.log(`[parallel-fabric] Stopped — ${this.activeRuns.size} active runs abandoned`);
  }

  canAcceptRun(): boolean {
    return this.running && this.activeRuns.size < this.config.maxConcurrentRuns;
  }

  registerRun(runId: string): boolean {
    if (!this.canAcceptRun()) {
      runLogger.log('system', 'warn', `[parallel-fabric] Cannot accept run ${runId} — at capacity (${this.activeRuns.size}/${this.config.maxConcurrentRuns})`);
      return false;
    }
    this.activeRuns.add(runId);
    runLogger.log('system', 'info', `[parallel-fabric] Run ${runId} registered (${this.activeRuns.size}/${this.config.maxConcurrentRuns})`);
    return true;
  }

  unregisterRun(runId: string): void {
    this.activeRuns.delete(runId);
    runLogger.log('system', 'info', `[parallel-fabric] Run ${runId} unregistered (${this.activeRuns.size}/${this.config.maxConcurrentRuns})`);
  }

  getCapacityPct(): number {
    return Math.round((this.activeRuns.size / this.config.maxConcurrentRuns) * 100);
  }

  stats(): FabricStats {
    return {
      activeRuns: this.activeRuns.size,
      maxConcurrentRuns: this.config.maxConcurrentRuns,
      capacityPct: this.getCapacityPct(),
      running: this.running,
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  getActiveRunIds(): string[] {
    return Array.from(this.activeRuns);
  }
}

export const parallelOrchestrationFabric = new ParallelOrchestrationFabric();
