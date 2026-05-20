export function remaining(maxRequests: number, count: number): number {
  return Math.max(0, maxRequests - count);
}

export function isAllowed(count: number, maxRequests: number): boolean {
  return count < maxRequests;
}

export function refillTokens(
  currentTokens: number,
  capacity: number,
  refillRatePerMs: number,
  elapsedMs: number,
): number {
  const refilled = currentTokens + refillRatePerMs * elapsedMs;
  return Math.min(capacity, refilled);
}
