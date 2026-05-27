/**
 * performance-utils.ts
 * Performance timing extraction and threshold helpers.
 */

export interface NavigationTiming {
  loadTimeMs:          number;
  domContentLoadedMs:  number;
  firstByteMs?:        number;
  renderTimeMs?:       number;
}

export const PERF_THRESHOLDS = {
  LOAD_TIME_WARN_MS:    3_000,
  LOAD_TIME_FAIL_MS:   10_000,
  INTERACTION_WARN_MS:    500,
  INTERACTION_FAIL_MS:  2_000,
} as const;

export function isWithinLoadThreshold(loadTimeMs: number): boolean {
  return loadTimeMs < PERF_THRESHOLDS.LOAD_TIME_FAIL_MS;
}

export function isWithinInteractionThreshold(ms: number): boolean {
  return ms < PERF_THRESHOLDS.INTERACTION_FAIL_MS;
}

export function elapsed(startMs: number): number {
  return Date.now() - startMs;
}

export function elapsedFrom(start: Date): number {
  return Date.now() - start.getTime();
}

export function formatMs(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function clampTimeout(requested?: number, max = 30_000, fallback = 10_000): number {
  if (!requested || requested <= 0) return fallback;
  return Math.min(requested, max);
}
