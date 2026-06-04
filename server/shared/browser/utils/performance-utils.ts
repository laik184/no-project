/**
 * server/agents/browser/utils/performance-utils.ts
 *
 * Lightweight timing helpers used across both the tools layer
 * and the browser agent orchestration layer.
 */

const DEFAULT_MAX_TIMEOUT_MS = 30_000;

// ── Performance thresholds ────────────────────────────────────────────────────

export const PERF_THRESHOLDS = {
  LOAD_TIME_WARN_MS:  3_000,
  LOAD_TIME_FAIL_MS:  8_000,
  RENDER_TIME_WARN_MS: 1_500,
  RENDER_TIME_FAIL_MS: 4_000,
} as const;

/**
 * Returns true if loadTimeMs is within the acceptable load threshold.
 */
export function isWithinLoadThreshold(
  loadTimeMs: number,
  thresholdMs: number = PERF_THRESHOLDS.LOAD_TIME_FAIL_MS,
): boolean {
  return loadTimeMs > 0 && loadTimeMs <= thresholdMs;
}

/**
 * Formats milliseconds as a human-readable string.
 */
export function formatMs(ms: number): string {
  if (ms < 1_000)  return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1_000)}s`;
}

/**
 * Returns elapsed milliseconds since a start timestamp (from Date.now()).
 */
export function elapsed(startMs: number): number {
  return Date.now() - startMs;
}

/**
 * Clamps a timeout to [minMs, maxMs].
 * Useful for preventing runaway waits or zero-duration timeouts.
 */
export function clampTimeout(
  ms:    number,
  maxMs: number = DEFAULT_MAX_TIMEOUT_MS,
  minMs: number = 100,
): number {
  return Math.min(Math.max(ms, minMs), maxMs);
}

/**
 * Returns a promise that resolves after `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Returns the current high-resolution timestamp in ms (same epoch as Date.now()).
 */
export function now(): number {
  return Date.now();
}

/**
 * Returns a human-readable duration string from milliseconds.
 */
export function formatDuration(ms: number): string {
  if (ms < 1_000)  return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1_000)}s`;
}
