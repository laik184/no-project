const counters = new Map<string, number>();
const durations = new Map<string, number[]>();

export function incrementCounter(metric: string, by = 1): void {
  counters.set(metric, (counters.get(metric) ?? 0) + by);
}

export function recordDuration(metric: string, ms: number): void {
  if (!durations.has(metric)) durations.set(metric, []);
  durations.get(metric)!.push(ms);
}

export function getCounter(metric: string): number {
  return counters.get(metric) ?? 0;
}

export function getDurationSummary(metric: string): { count: number; avg: number; min: number; max: number } | null {
  const vals = durations.get(metric);
  if (!vals || vals.length === 0) return null;
  const total = vals.reduce((a, b) => a + b, 0);
  return { count: vals.length, avg: total / vals.length, min: Math.min(...vals), max: Math.max(...vals) };
}

export function getAllCounters(): Record<string, number> {
  return Object.fromEntries(counters.entries());
}

export function resetMetrics(): void {
  counters.clear();
  durations.clear();
}
