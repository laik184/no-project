export function nowMs(): number {
  return Date.now();
}

export function windowResetTime(windowStart: number, windowMs: number): number {
  return windowStart + windowMs;
}

export function isWithinWindow(timestamp: number, windowStart: number, windowMs: number): boolean {
  return timestamp >= windowStart && timestamp < windowStart + windowMs;
}

export function currentWindowStart(windowMs: number): number {
  return Math.floor(Date.now() / windowMs) * windowMs;
}

export function pruneOldTimestamps(timestamps: readonly number[], windowMs: number): readonly number[] {
  const cutoff = Date.now() - windowMs;
  return Object.freeze(timestamps.filter((t) => t > cutoff));
}
