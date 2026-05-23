export type WorkerStatus = "idle" | "busy" | "draining" | "failed" | "terminated";
export type WorkerTier   = "io-bound" | "cpu-bound" | "llm";

export interface WorkerCapacitySnapshot {
  tier:       WorkerTier;
  total:      number;
  idle:       number;
  busy:       number;
  failed:     number;
  saturated:  boolean;
  utilizationPct: number;
}

export interface WorkerPriorityPolicy {
  tier:           WorkerTier;
  minConcurrency: number;
  maxConcurrency: number;
  queueDepthLimit: number;
}

export interface CentralWorkerStats {
  tiers:       Record<WorkerTier, WorkerCapacitySnapshot>;
  totalActive: number;
  totalIdle:   number;
  pressure:    number;
}

export type WorkerEventType =
  | "worker.spawned"
  | "worker.started"
  | "worker.completed"
  | "worker.failed"
  | "worker.timeout"
  | "worker.evicted"
  | "worker.heartbeat"
  | "worker.backpressure";
