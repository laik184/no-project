export const LATENCY_SPIKE_THRESHOLD_MS = 2000;
export const FAILURE_BURST_THRESHOLD = 3;
export const ERROR_RATE_HIGH_THRESHOLD = 0.20;
export const ERROR_RATE_CRITICAL_THRESHOLD = 0.50;
export const SUCCESS_STREAK_MIN = 10;
export const LATENCY_MEAN_SPIKE_MULTIPLIER = 2.5;
export const THROUGHPUT_DROP_THRESHOLD = 0.30;
export const MIN_EVENTS_FOR_TREND = 3;
export const ANOMALY_SLOPE_THRESHOLD = 0.05;

export function isSeverityCritical(errorRate: number): boolean {
  return errorRate >= ERROR_RATE_CRITICAL_THRESHOLD;
}

export function isSeverityHigh(errorRate: number): boolean {
  return errorRate >= ERROR_RATE_HIGH_THRESHOLD && errorRate < ERROR_RATE_CRITICAL_THRESHOLD;
}

export function isLatencySpike(latency: number, mean: number): boolean {
  return latency > mean * LATENCY_MEAN_SPIKE_MULTIPLIER && latency > LATENCY_SPIKE_THRESHOLD_MS;
}

export function isFailureBurst(failCount: number, windowSize: number): boolean {
  return failCount >= FAILURE_BURST_THRESHOLD && failCount / windowSize >= 0.5;
}

export function trendDirection(slope: number): "improving" | "degrading" | "stable" {
  if (Math.abs(slope) < ANOMALY_SLOPE_THRESHOLD) return "stable";
  return slope > 0 ? "improving" : "degrading";
}
