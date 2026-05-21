/**
 * server/memory/infrastructure/clock.ts
 *
 * Clock — time abstraction for deterministic testing and TTL calculations.
 * All memory modules receive a Clock instance via DI — never call Date.now() directly.
 */

export interface Clock {
  now(): number;
  nowIso(): string;
}

export class SystemClock implements Clock {
  now(): number    { return Date.now(); }
  nowIso(): string { return new Date().toISOString(); }
}

export class FixedClock implements Clock {
  private _ts: number;
  constructor(initial: number = 0) { this._ts = initial; }
  now(): number    { return this._ts; }
  nowIso(): string { return new Date(this._ts).toISOString(); }
  advance(ms: number): void { this._ts += ms; }
  set(ts: number): void     { this._ts = ts; }
}
