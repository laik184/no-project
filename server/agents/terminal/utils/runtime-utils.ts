import { randomUUID } from 'crypto';

export function generateRunId(): string {
  return `run_${randomUUID()}`;
}

export function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function now(): Date {
  return new Date();
}

export function elapsedMs(since: Date): number {
  return Date.now() - since.getTime();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function safeParseInt(value: string, fallback: number): number {
  const n = parseInt(value, 10);
  return isNaN(n) ? fallback : n;
}

export function memoize<T>(fn: () => T): () => T {
  let cache: T | undefined;
  let ready = false;
  return () => {
    if (!ready) { cache = fn(); ready = true; }
    return cache!;
  };
}
