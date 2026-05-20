import { clamp } from "./scoring.util";

export function normalizeLatency(latencyMs: number): number {
  if (latencyMs <= 50) return 1;
  if (latencyMs >= 5000) return 0;
  return clamp(1 - (latencyMs - 50) / (5000 - 50));
}

export function normalizeSuccessRate(rate: number): number {
  return clamp(rate);
}

export function normalizeFailRate(rate: number): number {
  return clamp(1 - rate);
}

export function normalizeThroughput(eventsPerSec: number, maxExpected = 100): number {
  if (eventsPerSec <= 0) return 0;
  return clamp(eventsPerSec / maxExpected);
}

export function normalizeCount(count: number, max: number): number {
  if (max <= 0) return 0;
  return clamp(count / max);
}
