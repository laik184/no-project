export interface ResourceSnapshot {
  projectId: string;
  ts: number;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  disk: DiskMetrics;
  network: NetworkMetrics;
}

export interface CpuMetrics {
  usagePercent: number;
  cores: number;
  loadAvg1m: number;
  loadAvg5m: number;
  loadAvg15m: number;
}

export interface MemoryMetrics {
  totalMb: number;
  usedMb: number;
  freeMb: number;
  usagePercent: number;
  swapTotalMb: number;
  swapUsedMb: number;
}

export interface DiskMetrics {
  totalGb: number;
  usedGb: number;
  freeGb: number;
  usagePercent: number;
  readBytesPerSec: number;
  writeBytesPerSec: number;
}

export interface NetworkMetrics {
  rxBytesPerSec: number;
  txBytesPerSec: number;
  activeConnections: number;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  cpuPercent: number;
  memoryMb: number;
  status: "running" | "sleeping" | "zombie" | "stopped";
  startedAt: Date;
}

export interface HttpMetrics {
  projectId: string;
  period: "1m" | "5m" | "1h" | "24h";
  requestCount: number;
  errorCount: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  statusCodes: Record<string, number>;
  topEndpoints: Array<{ path: string; count: number; avgMs: number }>;
}

export interface AlertRule {
  id: string;
  projectId: string;
  metric: "cpu" | "memory" | "disk" | "error_rate" | "latency";
  threshold: number;
  operator: "gt" | "lt" | "gte" | "lte";
  windowMinutes: number;
  notifyVia: Array<"email" | "webhook">;
  webhookUrl?: string;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  projectId: string;
  metric: string;
  currentValue: number;
  thresholdValue: number;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledged: boolean;
}
