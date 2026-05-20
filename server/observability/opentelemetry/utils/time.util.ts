export function nowMs(): number {
  return Date.now();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function hrNowMs(): number {
  const [sec, nano] = process.hrtime();
  return sec * 1_000 + nano / 1_000_000;
}

export function msSince(startMs: number): number {
  return Math.max(0, Date.now() - startMs);
}

export function msToSeconds(ms: number): number {
  return ms / 1_000;
}
